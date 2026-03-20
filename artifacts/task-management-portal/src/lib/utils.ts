import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STATUS_COLORS: Record<string, { bg: string, text: string }> = {
  "GS Rejected": { bg: "#F8D7DA", text: "#842029" },
  "GS approved": { bg: "#D1E7DD", text: "#0F5132" },
  "GS document pending": { bg: "#FFF3CD", text: "#664D03" },
  "GS onhold": { bg: "#E2E3E5", text: "#41464B" },
  "GS submitted": { bg: "#CFE2FF", text: "#084298" },
  "GS additional document request": { bg: "#FAD7F0", text: "#7B1A5F" },
  "In Review": { bg: "#E7D9FF", text: "#410B98" },
  "Refund Requested": { bg: "#FCE5CD", text: "#7D4005" },
  "Visa Refused": { bg: "#F4CCCC", text: "#7A1414" },
  "Visa Granted": { bg: "#D9EAD3", text: "#194D0C" },
  "Visa Lodged": { bg: "#D0E0E3", text: "#0C434A" },
  "CoE Requested": { bg: "#FFF2CC", text: "#665100" },
  "CoE Approved": { bg: "#D9D2E9", text: "#2A185C" },
};

export const STATUS_CHOICES = Object.keys(STATUS_COLORS);
