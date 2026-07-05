export function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function formNumber(formData: FormData, key: string) {
  const value = formText(formData, key);
  if (!value) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function commaList(value: string | null) {
  if (!value) return [];

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function firstSentence(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  return value.split(".")[0] || fallback;
}
