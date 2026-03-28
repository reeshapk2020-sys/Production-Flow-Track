import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a code+name pair for display: "CODE - Name"
 * Falls back gracefully if code or name is missing.
 */
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
