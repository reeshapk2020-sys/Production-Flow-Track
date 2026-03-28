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

interface WorkSlot { start: number; end: number; effective?: number; }
export const WORK_SLOTS: WorkSlot[] = [
  { start: 8 * 60, end: 13 * 60 + 20 },
  { start: 14 * 60 + 30, end: 20 * 60, effective: 270 },
  { start: 20 * 60 + 30, end: 23 * 60 },
];
export const MINUTES_PER_POINT = 20;

export function calcExpectedCompletion(startDateTime: Date, totalMinutes: number): Date {
  let remaining = totalMinutes;
  let current = new Date(startDateTime);
  const dayStartUTC = (d: Date) => { const r = new Date(d); r.setUTCHours(0, 0, 0, 0); return r; };
  const minuteOfDayUTC = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();
  for (let guard = 0; guard < 365 && remaining > 0; guard++) {
    const todayBase = dayStartUTC(current);
    const curMinute = minuteOfDayUTC(current);
    for (const slot of WORK_SLOTS) {
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
  for (let guard = 0; guard < 365; guard++) {
    const todayBase = dayStartUTC(current);
    const isEndDay = todayBase.getTime() === endDayStart;
    const curMinute = minuteOfDayUTC(current);
    for (const slot of WORK_SLOTS) {
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
