import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a code+name pair for display: "CODE - Name"
 * Falls back gracefully if code or name is missing.
 */
export function fmtCode(
  code: string | null | undefined,
  name: string | null | undefined
): string {
  const c = code?.trim();
  const n = name?.trim();
  if (c && n) return `${c} - ${n}`;
  return n || c || "";
}
