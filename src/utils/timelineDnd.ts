export function clampMinute(minutes: number) {
  return Math.max(0, Math.min(1439, Math.round(minutes)));
}

export function minutesToTime(minutes: number) {
  const clamped = clampMinute(minutes);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function getDropMinuteFromTranslatedRect(
  translatedRect: { top: number; height: number },
  containerRect: DOMRect,
  containerScrollTop: number,
  minutePx: number,
  paddingTop: number
) {
  const centerY = translatedRect.top + translatedRect.height / 2;
  const relativeY = centerY - containerRect.top + containerScrollTop - paddingTop;
  return clampMinute(relativeY / minutePx);
}

export function isPastDropMinute(selectedDate: string, minute: number, nowMs = Date.now()) {
  const candidate = new Date(`${selectedDate}T${minutesToTime(minute)}`).getTime();
  return candidate < nowMs;
}
