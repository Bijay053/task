import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── GS Department ────────────────────────────────────────────────────────────
export const GS_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  "GS Rejected":                    { bg: "#F8D7DA", text: "#842029" },
  "GS approved":                    { bg: "#D1E7DD", text: "#0F5132" },
  "GS document pending":            { bg: "#FFF3CD", text: "#664D03" },
  "GS onhold":                      { bg: "#E2E3E5", text: "#41464B" },
  "GS submitted":                   { bg: "#CFE2FF", text: "#084298" },
  "GS additional document request": { bg: "#FAD7F0", text: "#7B1A5F" },
  "In Review":                      { bg: "#E7D9FF", text: "#410B98" },
  "Refund Requested":               { bg: "#FCE5CD", text: "#7D4005" },
  "Visa Refused":                   { bg: "#F4CCCC", text: "#7A1414" },
  "Visa Granted":                   { bg: "#D9EAD3", text: "#194D0C" },
  "Visa Lodged":                    { bg: "#D0E0E3", text: "#0C434A" },
  "CoE Requested":                  { bg: "#FFF2CC", text: "#665100" },
  "CoE Approved":                   { bg: "#D9D2E9", text: "#2A185C" },
};

export const GS_STATUS_CHOICES = Object.keys(GS_STATUS_COLORS);

// ─── Offer Department ──────────────────────────────────────────────────────────
export const OFFER_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  "On Hold":            { bg: "#E2E3E5", text: "#41464B" },
  "Not Eligible":       { bg: "#F8D7DA", text: "#842029" },
  "Offer Request":      { bg: "#FFF3CD", text: "#664D03" },
  "Offer Received":     { bg: "#D1E7DD", text: "#0F5132" },
  "Offer Rejected":     { bg: "#F5C2C7", text: "#7A1414" },
  "Document Requested": { bg: "#CFE2FF", text: "#084298" },
};

export const OFFER_STATUS_CHOICES = Object.keys(OFFER_STATUS_COLORS);

export const OFFER_CHANNEL_CHOICES = ["Direct", "Expert", "KC overseas", "SIUK"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Returns status color map for a given department */
export function getStatusColors(department: string): Record<string, { bg: string; text: string }> {
  return department === "offer" ? OFFER_STATUS_COLORS : GS_STATUS_COLORS;
}

export function getStatusChoices(department: string): string[] {
  return department === "offer" ? OFFER_STATUS_CHOICES : GS_STATUS_CHOICES;
}

// Legacy aliases (used by kanban-board and older components)
export const STATUS_COLORS = GS_STATUS_COLORS;
export const STATUS_CHOICES = GS_STATUS_CHOICES;
