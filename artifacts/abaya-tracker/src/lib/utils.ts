import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmtUTC(d: Date | string, fmt: string = "MMM d, yyyy HH:mm"): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const utc = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
    date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
  return format(utc, fmt);
}

export function fmtCode(
  code: string | null | undefined,
  name: string | null | undefined
): string {
  const c = code?.trim();
  const n = name?.trim();
  if (c && n) return `${c} - ${n}`;
  return n || c || "";
}

export interface WorkSlot { start: number; end: number; effective?: number; }

let _workSlots: WorkSlot[] = [
  { start: 8 * 60, end: 13 * 60 + 20 },
  { start: 14 * 60 + 30, end: 20 * 60, effective: 270 },
  { start: 20 * 60 + 30, end: 23 * 60 },
];
let _minutesPerPoint = 20;

let _weeklyOffDays: Set<number> = new Set();
let _holidayDates: Set<string> = new Set();

export function setTimeSettings(slots: WorkSlot[], minutesPerPoint: number) {
  _workSlots = slots;
  _minutesPerPoint = minutesPerPoint;
}

export function setOffDays(weeklyDays: number[], holidays: string[]) {
  _weeklyOffDays = new Set(weeklyDays);
  _holidayDates = new Set(holidays);
}

export function getWorkSlots(): WorkSlot[] { return _workSlots; }
export function getMinutesPerPoint(): number { return _minutesPerPoint; }

function isOffDay(d: Date): boolean {
  if (_weeklyOffDays.has(d.getUTCDay())) return true;
  const ds = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  return _holidayDates.has(ds);
}

export function calcExpectedCompletion(startDateTime: Date, totalMinutes: number): Date {
  let remaining = totalMinutes;
  let current = new Date(startDateTime);
  const dayStartUTC = (d: Date) => { const r = new Date(d); r.setUTCHours(0, 0, 0, 0); return r; };
  const minuteOfDayUTC = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();
  for (let guard = 0; guard < 730 && remaining > 0; guard++) {
    const todayBase = dayStartUTC(current);
    if (isOffDay(todayBase)) {
      current = new Date(todayBase.getTime() + 24 * 60 * 60000);
      current.setUTCHours(0, 0, 0, 0);
      continue;
    }
    const curMinute = minuteOfDayUTC(current);
    for (const slot of _workSlots) {
      if (remaining <= 0) break;
      const effectiveStart = Math.max(curMinute, slot.start);
      if (effectiveStart >= slot.end) continue;
      const rawAvail = slot.end - effectiveStart;
      const slotTotal = slot.end - slot.start;
      const effectiveTotal = slot.effective || slotTotal;
      const ratio = effectiveTotal / slotTotal;
      const available = Math.floor(rawAvail * ratio);
      if (remaining <= available) {
        const rawNeeded = Math.ceil(remaining / ratio);
        current = new Date(todayBase.getTime() + (effectiveStart + rawNeeded) * 60000);
        remaining = 0;
        break;
      }
      remaining -= available;
    }
    if (remaining > 0) {
      current = new Date(todayBase.getTime() + 24 * 60 * 60000);
      current.setUTCHours(0, 0, 0, 0);
    }
  }
  return current;
}

export function calcWorkingMinutesBetween(startDt: Date, endDt: Date): number {
  if (endDt <= startDt) return 0;
  let total = 0;
  let current = new Date(startDt);
  const dayStartUTC = (d: Date) => { const r = new Date(d); r.setUTCHours(0, 0, 0, 0); return r; };
  const minuteOfDayUTC = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();
  const endMinuteOfDay = minuteOfDayUTC(endDt);
  const endDayStart = dayStartUTC(endDt).getTime();
  for (let guard = 0; guard < 730; guard++) {
    const todayBase = dayStartUTC(current);
    const isEndDay = todayBase.getTime() === endDayStart;
    if (isOffDay(todayBase)) {
      if (isEndDay) break;
      current = new Date(todayBase.getTime() + 24 * 60 * 60000);
      current.setUTCHours(0, 0, 0, 0);
      continue;
    }
    const curMinute = minuteOfDayUTC(current);
    for (const slot of _workSlots) {
      const effectiveStart = Math.max(curMinute, slot.start);
      const slotEnd = isEndDay ? Math.min(slot.end, endMinuteOfDay) : slot.end;
      if (effectiveStart >= slotEnd) continue;
      const rawAvail = slotEnd - effectiveStart;
      const slotTotal = slot.end - slot.start;
      const effectiveTotal = slot.effective || slotTotal;
      const ratio = effectiveTotal / slotTotal;
      total += Math.floor(rawAvail * ratio);
    }
    if (isEndDay) break;
    current = new Date(todayBase.getTime() + 24 * 60 * 60000);
    current.setUTCHours(0, 0, 0, 0);
  }
  return total;
}

export function formatMinutes(m: number): string {
  if (!m || m <= 0) return "0 min";
  const hrs = Math.floor(m / 60);
  const mins = Math.round(m % 60);
  if (hrs === 0) return `${mins} min`;
  return mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
}

export interface TimingInput {
  issueDate?: string | Date | null;
  pointsPerPiece?: number;
  quantityIssued?: number;
  outsourceSendDate?: string | Date | null;
  outsourceReturnDate?: string | Date | null;
  outsourceSent?: number;
  outsourceReturned?: number;
  outsourceDamaged?: number;
  priorityPauses?: Array<{
    pauseStart?: string | null;
    pauseEnd?: string | null;
    orderCompleted?: boolean;
    orderBatchNumber?: string | null;
    orderAllocationNumber?: string | null;
  }>;
  manualPauses?: Array<{
    id?: number;
    pauseStart: string;
    pauseEnd: string;
    reason?: string | null;
    remarks?: string | null;
  }>;
  actualCompletionDate?: string | Date | null;
}

export interface TimingResult {
  totalPoints: number;
  totalMinutes: number;
  startDt: Date | null;
  oSendDate: Date | null;
  oReturnDate: Date | null;
  oSent: number;
  oReturned: number;
  oDamaged: number;
  hasOutsource: boolean;
  isInOutsource: boolean;
  outsourceFullyReturned: boolean;
  outsourcePending: number;
  preOutsourceUsed: number;
  remainingMinutes: number;
  expectedEnd: Date | null;
  actualCompletionDt: Date | null;
  actualMinutes: number;
  isPausedByOrder: boolean;
  hasPriorityPause: boolean;
  priorityPauses: TimingInput["priorityPauses"] & Array<any>;
  mergedPauses: Array<{ start: number; end: number }>;
}

function mergePauseIntervals(pauses: { start: number; end: number }[]): { start: number; end: number }[] {
  if (pauses.length === 0) return [];
  const sorted = [...pauses].sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      merged.push(sorted[i]);
    }
  }
  return merged;
}

export function computeTimingValues(input: TimingInput): TimingResult {
  const ppp = Number(input.pointsPerPiece) || 0;
  const qty = input.quantityIssued || 0;
  const totalPoints = ppp * qty;
  const totalMinutes = totalPoints * _minutesPerPoint;
  const startDt = input.issueDate ? new Date(input.issueDate) : null;

  const oSendDate = input.outsourceSendDate ? new Date(input.outsourceSendDate) : null;
  const oReturnDate = input.outsourceReturnDate ? new Date(input.outsourceReturnDate) : null;
  const oSent = input.outsourceSent || 0;
  const oReturned = input.outsourceReturned || 0;
  const oDamaged = input.outsourceDamaged || 0;
  const hasOutsource = oSendDate !== null && oSent > 0;
  const outsourcePending = oSent - oReturned - oDamaged;
  const isInOutsource = hasOutsource && outsourcePending > 0;
  const outsourceFullyReturned = hasOutsource && outsourcePending <= 0;

  const priorityPauses: any[] = input.priorityPauses || [];
  const hasPriorityPause = priorityPauses.length > 0;
  const activePriorityPause = priorityPauses.find((p: any) => !p.pauseEnd);
  const isPausedByOrder = !!activePriorityPause;

  const manualPauses: any[] = input.manualPauses || [];

  const completedPauseIntervals = priorityPauses
    .filter((p: any) => p.pauseStart && p.pauseEnd)
    .map((p: any) => ({ start: new Date(p.pauseStart).getTime(), end: new Date(p.pauseEnd).getTime() }));
  const manualPauseIntervals = manualPauses
    .filter((p: any) => p.pauseStart && p.pauseEnd)
    .map((p: any) => ({ start: new Date(p.pauseStart).getTime(), end: new Date(p.pauseEnd).getTime() }));
  const allPauseIntervals: { start: number; end: number }[] = [...completedPauseIntervals, ...manualPauseIntervals];
  if (hasOutsource && oSendDate) {
    const osEnd = outsourceFullyReturned && oReturnDate ? oReturnDate.getTime() : Date.now();
    allPauseIntervals.push({ start: oSendDate.getTime(), end: osEnd });
  }
  const mergedPauses = mergePauseIntervals(allPauseIntervals);

  let preOutsourceUsed = 0;
  let remainingMinutes = totalMinutes;
  let expectedEnd: Date | null = null;

  if (startDt && totalMinutes > 0) {
    if (hasOutsource && oSendDate) {
      preOutsourceUsed = calcWorkingMinutesBetween(startDt, oSendDate);
      remainingMinutes = Math.max(0, totalMinutes - preOutsourceUsed);
      if (outsourceFullyReturned && oReturnDate && remainingMinutes > 0) {
        let resumePoint = oReturnDate;
        let workedAfterResume = 0;
        for (const p of mergedPauses) {
          const pStart = new Date(p.start);
          const pEnd = new Date(p.end);
          if (pStart.getTime() > oReturnDate.getTime()) {
            workedAfterResume += calcWorkingMinutesBetween(resumePoint, pStart);
            resumePoint = pEnd;
          }
        }
        const adjustedRemaining = Math.max(0, remainingMinutes - workedAfterResume);
        if (isPausedByOrder) {
          remainingMinutes = adjustedRemaining;
        } else {
          remainingMinutes = adjustedRemaining;
          expectedEnd = calcExpectedCompletion(resumePoint, adjustedRemaining);
        }
      }
    } else {
      let workedBeforePauses = 0;
      let resumePoint: Date = startDt;
      const hasAnyPause = mergedPauses.length > 0;
      if (hasAnyPause) {
        for (const p of mergedPauses) {
          const pStart = new Date(p.start);
          const pEnd = new Date(p.end);
          if (pStart.getTime() > resumePoint.getTime()) {
            workedBeforePauses += calcWorkingMinutesBetween(resumePoint, pStart);
          }
          if (pEnd.getTime() > resumePoint.getTime()) {
            resumePoint = pEnd;
          }
        }
        remainingMinutes = Math.max(0, totalMinutes - workedBeforePauses);
        if (!isPausedByOrder) {
          expectedEnd = calcExpectedCompletion(resumePoint, remainingMinutes);
        }
      } else {
        expectedEnd = calcExpectedCompletion(startDt, totalMinutes);
      }
    }
  }

  const actualCompletionDt = input.actualCompletionDate ? new Date(input.actualCompletionDate) : null;
  let actualMinutes = startDt && actualCompletionDt ? calcWorkingMinutesBetween(startDt, actualCompletionDt) : 0;
  if (actualMinutes > 0 && mergedPauses.length > 0 && startDt && actualCompletionDt) {
    let pauseWorkMin = 0;
    for (const p of mergedPauses) {
      const pStart = new Date(Math.max(p.start, startDt.getTime()));
      const pEnd = new Date(Math.min(p.end, actualCompletionDt.getTime()));
      if (pStart < pEnd) {
        pauseWorkMin += calcWorkingMinutesBetween(pStart, pEnd);
      }
    }
    actualMinutes = Math.max(0, actualMinutes - pauseWorkMin);
  }

  return {
    totalPoints,
    totalMinutes,
    startDt,
    oSendDate,
    oReturnDate,
    oSent,
    oReturned,
    oDamaged,
    hasOutsource,
    isInOutsource,
    outsourceFullyReturned,
    outsourcePending,
    preOutsourceUsed,
    remainingMinutes,
    expectedEnd,
    actualCompletionDt,
    actualMinutes,
    isPausedByOrder,
    hasPriorityPause,
    priorityPauses,
    mergedPauses,
  };
}
