/** Keyboard model of the command center: «g» then a letter jumps to a page; j / k walk the rows on screen. */

export const GO_KEYS: Record<string, string> = {
  h: '/', s: '/schedule', c: '/contacts', o: '/companies', t: '/tasks', p: '/sales-tools/pipeline', r: '/sales-tools/reports',
  i: '/inbox', a: '/announcements', e: '/settings', u: '/profile'
};

/** Arabic keyboard layout letters that sit on the same physical keys as g / h / s / c / ... */
const AR_TO_LATIN: Record<string, string> = { 'ل': 'g', 'ا': 'h', 'س': 's', 'ؤ': 'c', 'خ': 'o', 'ف': 't', 'ح': 'p', 'ق': 'r', 'ه': 'i', 'ش': 'a', 'ث': 'e', 'ع': 'u', 'ى': 'n', 'ة': 'm', 'ن': 'k', 'ت': 'j' };
export const latinKey = (k: string) => AR_TO_LATIN[k] || k.toLowerCase();

export type Chord = { armed: boolean; go?: string };
/** One step of the «g then x» chord. `armed` means «g» was just pressed and the next key picks the page. */
export function stepChord(armed: boolean, key: string): Chord {
  const k = latinKey(key);
  if (!armed) return { armed: k === 'g' };
  return GO_KEYS[k] ? { armed: false, go: GO_KEYS[k] } : { armed: false };
}

/** Next index when walking a list with j (+1) / k (-1). Starts at the first row when nothing is selected (-1). Never wraps. */
export function stepIndex(len: number, cur: number, dir: 1 | -1): number {
  if (len <= 0) return -1;
  if (cur < 0) return dir === 1 ? 0 : len - 1;
  return Math.max(0, Math.min(len - 1, cur + dir));
}
