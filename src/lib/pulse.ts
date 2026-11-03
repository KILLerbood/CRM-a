import type { Booking, Lead, Task } from '../api/schemas';
import { ACTIVE } from '../api/schemas';
import { dayKey, todayKey } from './time';
import { isLate } from './rules';
import { buildNow } from './now';

export type Pulse = {
  /** Confirmed meetings still ahead (or running) today. */
  meetingsToday: number;
  /** Start of the next confirmed meeting today, as a timestamp, or null. */
  nextMeetingAt: number | null;
  /** Open tasks past their due time. */
  overdue: number;
  /** New leads nobody has answered yet. */
  unanswered: number;
  /** Sum of the deal value of every open deal (SAR). */
  moneyInPlay: number;
  /** Open deals that carry a value. */
  dealsInPlay: number;
  /** Everything waiting for this person right now (the length of «Do this now»). */
  waiting: number;
};

/** The numbers behind the live strip on top of every screen. Pure, so it is easy to test. */
export function computePulse(data: { leads: Lead[]; tasks: Task[]; bookings: Booking[] }, now: number, staleDays: number): Pulse {
  const t0 = todayKey();
  const meets = data.bookings
    .filter((b) => b.status === 'مؤكد' && dayKey(b.start) === t0 && Date.parse(b.start) + 45 * 60e3 > now)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const open = data.leads.filter((l) => ACTIVE.includes(l.stage));
  const items = buildNow(data, now, staleDays);
  return {
    meetingsToday: meets.length,
    nextMeetingAt: meets.length ? Date.parse(meets[0].start) : null,
    overdue: data.tasks.filter(isLate).length,
    unanswered: items.filter((i) => i.kind === 'lead-noreply').length,
    moneyInPlay: open.reduce((a, l) => a + (Number(l.dealValue) || 0), 0),
    dealsInPlay: open.filter((l) => Number(l.dealValue) > 0).length,
    waiting: items.length
  };
}

/** 1 250 000 -> «1.25M», 48 300 -> «48.3K», 900 -> «900». Keeps the strip short. */
export function compactMoney(n: number): string {
  const a = Math.abs(n);
  const f = (x: number, s: string) => (Math.round(x * 10) / 10).toString().replace(/\.0$/, '') + s;
  if (a >= 1e6) return f(n / 1e6, 'M');
  if (a >= 1e3) return f(n / 1e3, 'K');
  return String(Math.round(n));
}
