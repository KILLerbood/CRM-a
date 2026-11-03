import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compactMoney, computePulse } from '../pulse';
import { GO_KEYS, stepChord, stepIndex } from '../keys';

const NOW = Date.parse('2026-11-03T09:00:00Z');
const lead = (o: object) => ({ id: 'L-1', business: 'X', name: 'Y', stage: 'تفاوض', type: 'متوقع', firstReply: 'x', dealValue: 1000, lastContact: new Date(NOW - 864e5).toISOString(), created: new Date(NOW - 20 * 864e5).toISOString(), nextFollowUp: '', renewal: '', ...o }) as never;
const booking = (o: object) => ({ id: 'B-1', leadId: 'L-1', start: new Date(NOW + 30 * 60e3).toISOString(), status: 'مؤكد', ...o }) as never;

describe('computePulse', () => {
  beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterAll(() => { vi.useRealTimers(); });
  it('adds up the money in open deals only', () => {
    const p = computePulse({ leads: [lead({}), lead({ id: 'L-2', dealValue: 500 }), lead({ id: 'L-3', stage: 'خسرناه', dealValue: 9000 })], tasks: [], bookings: [] }, NOW, 7);
    expect(p.moneyInPlay).toBe(1500);
    expect(p.dealsInPlay).toBe(2);
  });
  it('counts confirmed meetings still ahead today and reports the next start', () => {
    const p = computePulse({ leads: [lead({})], tasks: [], bookings: [booking({}), booking({ id: 'B-2', status: 'ملغي' })] }, NOW, 7);
    expect(p.meetingsToday).toBe(1);
    expect(p.nextMeetingAt).toBe(NOW + 30 * 60e3);
  });
  it('counts overdue tasks and unanswered new leads', () => {
    const p = computePulse({ leads: [lead({ stage: 'جديد', firstReply: '' })], tasks: [{ id: 'T', leadId: 'L-1', task: 'x', due: new Date(NOW - 3600e3).toISOString(), status: 'مفتوحة' } as never], bookings: [] }, NOW, 7);
    expect(p.overdue).toBe(1);
    expect(p.unanswered).toBe(1);
    expect(p.waiting).toBe(2);
  });
});

describe('compactMoney', () => {
  it('shortens thousands and millions', () => {
    expect(compactMoney(900)).toBe('900');
    expect(compactMoney(48300)).toBe('48.3K');
    expect(compactMoney(1250000)).toBe('1.3M');
    expect(compactMoney(2000000)).toBe('2M');
  });
});

describe('keyboard chords', () => {
  it('arms on g and jumps on the next letter', () => {
    expect(stepChord(false, 'g')).toEqual({ armed: true });
    expect(stepChord(true, 'c')).toEqual({ armed: false, go: GO_KEYS.c });
  });
  it('disarms on an unknown key and ignores letters when not armed', () => {
    expect(stepChord(true, 'z')).toEqual({ armed: false });
    expect(stepChord(false, 'c')).toEqual({ armed: false });
  });
  it('accepts the Arabic keyboard layout', () => {
    expect(stepChord(false, 'ل')).toEqual({ armed: true });
  });
  it('walks a list without wrapping', () => {
    expect(stepIndex(3, -1, 1)).toBe(0);
    expect(stepIndex(3, -1, -1)).toBe(2);
    expect(stepIndex(3, 2, 1)).toBe(2);
    expect(stepIndex(3, 0, -1)).toBe(0);
    expect(stepIndex(0, -1, 1)).toBe(-1);
  });
});
