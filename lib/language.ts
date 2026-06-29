export type ConciergeLanguage = "en" | "ar";

const ARABIC_TEXT = /[\u0600-\u06ff]/;
const LATIN_TEXT = /[A-Za-z]/;

export function containsArabicText(value: string): boolean {
  return ARABIC_TEXT.test(value);
}

export function containsLatinText(value: string): boolean {
  return LATIN_TEXT.test(value);
}

export function detectLanguageFromText(
  value: string,
  fallback: ConciergeLanguage = "en"
): ConciergeLanguage {
  if (containsArabicText(value)) return "ar";
  if (containsLatinText(value)) return "en";
  return fallback;
}

export function detectSpokenLanguage(
  value: string,
  fallback: ConciergeLanguage = "en"
): ConciergeLanguage {
  return containsArabicText(value) ? "ar" : fallback;
}
