export type SoundName = "begin" | "finish" | "notice";

export function playSound(name: SoundName) {
  if (typeof window === "undefined") return;
  const audio = new Audio(`/${name}.mp3`);
  audio.play().catch(() => {});
}
