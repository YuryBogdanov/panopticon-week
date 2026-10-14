import { describe, expect, it } from 'vitest';
import type { HeadingInfo } from '@panopticon/api';
import { addWeeks, canReview, cellOf, headingTitle, isoWeek, keyOf, mondayOf, overdueReview, parseKey, phase, rangeShort, rangeTitle, readWeeks, stamp, stampDate, type Week } from '../src/weeks';

const d = (y: number, m: number, day: number, h = 0, min = 0) => new Date(y, m - 1, day, h, min);

describe('ISO weeks', () => {
  it('the week of a day, Monday first; across a year', () => {
    expect(keyOf(isoWeek(d(2026, 10, 14)))).toBe('2026-W42');
    expect(keyOf(isoWeek(d(2026, 10, 12)))).toBe('2026-W42');
    expect(keyOf(isoWeek(d(2026, 10, 18)))).toBe('2026-W42');
    expect(keyOf(isoWeek(d(2026, 10, 19)))).toBe('2026-W43');
    expect(keyOf(isoWeek(d(2026, 1, 1)))).toBe('2026-W01');
    expect(keyOf(isoWeek(d(2027, 1, 1)))).toBe('2026-W53');
    expect(keyOf(isoWeek(d(2024, 12, 30)))).toBe('2025-W01');
  });
  it('Monday, neighbours, the titles', () => {
    expect(mondayOf({ year: 2026, week: 42 })).toEqual(d(2026, 10, 12));
    expect(keyOf(addWeeks({ year: 2026, week: 53 }, 1))).toBe('2027-W01');
    expect(rangeTitle({ year: 2026, week: 42 })).toBe('12 – 18 октября');
    expect(rangeTitle({ year: 2026, week: 40 })).toBe('28 сентября – 4 октября');
    expect(rangeShort({ year: 2026, week: 42 })).toBe('12–18 окт');
    expect(headingTitle({ year: 2026, week: 42 })).toBe('2026-W42 · 12–18 октября');
    expect(parseKey('2026-W42 · что угодно')).toEqual({ year: 2026, week: 42 });
    expect(parseKey('Неделя 42')).toBeNull();
  });
  it('stamps', () => {
    expect(stamp(d(2026, 10, 16, 16, 40))).toBe('[2026-10-16 Пт 16:40]');
    expect(stampDate('[2026-10-16 Пт 16:40]')).toEqual(d(2026, 10, 16, 16, 40));
  });
});

describe('the time of a review', () => {
  const w = { year: 2026, week: 42 };
  it('from Friday 12:00 to the end of the chosen day of the next week', () => {
    expect(canReview(w, d(2026, 10, 16, 11, 59), 3)).toBe(false);
    expect(canReview(w, d(2026, 10, 16, 12), 3)).toBe(true);
    expect(canReview(w, d(2026, 10, 21, 23, 59), 3)).toBe(true); // Wednesday
    expect(canReview(w, d(2026, 10, 22, 0, 1), 3)).toBe(false);
    expect(canReview(w, d(2026, 10, 20, 0, 1), 1)).toBe(false); // «до понедельника»
    expect(phase(w, d(2026, 10, 14))).toBe('current');
    expect(phase(w, d(2026, 10, 19))).toBe('past');
  });
});

const H = (level: number, title: string, line: number, o: Partial<HeadingInfo> = {}): HeadingInfo =>
  ({ ref: { path: 'weeks.org', line, title }, level, keyword: null, done: false, priority: null, title, tags: [], properties: {}, ...o }) as HeadingInfo;

describe('weeks.org', () => {
  const outline = [
    H(1, '2026-W42 · 12–18 октября', 2),
    H(2, 'Цели', 3),
    H(3, 'Закрыть найм SRE', 4, { keyword: 'TODO', properties: { RESULT: 'done' } }),
    H(3, 'Согласовать бюджет', 9, { properties: { RESULT: 'partial' } }),
    H(2, 'Итоги', 13, { properties: { REVIEWED: '[2026-10-16 Пт 16:40]' } }),
    H(3, 'Что получилось', 16),
    H(1, 'Заметки', 18),
    H(1, '2026-W43 · 19–25 октября', 20),
    H(2, 'Итоги', 21, { properties: { SKIPPED: '[2026-10-29 Чт 09:00]' } }),
  ];
  it('weeks by key, goals with results and links, the review', () => {
    const notes = new Map([['weeks.org#9', 'Задача: [[id:abc][Бюджет]]']]);
    const ws = readWeeks(outline, notes);
    expect([...ws.keys()]).toEqual(['2026-W42', '2026-W43']);
    const w = ws.get('2026-W42')!;
    expect(w.goals.map((g) => [g.title, g.keyword, g.result, g.link])).toEqual([['Закрыть найм SRE', 'TODO', 'done', null], ['Согласовать бюджет', null, 'partial', 'abc']]);
    expect(w.review?.reviewed).toBe('[2026-10-16 Пт 16:40]');
    expect(w.review?.answers.map((a) => a.title)).toEqual(['Что получилось']);
    expect(ws.get('2026-W43')!.review?.skipped).toBe('[2026-10-29 Чт 09:00]');
    expect(ws.get('2026-W43')!.goals).toEqual([]);
  });
  it('a week left without a review past its time is overdue; a reviewed or skipped one is not', () => {
    const ws = readWeeks(outline);
    const w41 = { id: { year: 2026, week: 41 }, ref: { path: '', line: 0, title: '' }, goalsRef: null, goals: [], review: null };
    expect(overdueReview(w41, d(2026, 10, 15, 0, 1), 3)).toBe(true);
    expect(overdueReview(w41, d(2026, 10, 14, 23), 3)).toBe(false);
    expect(overdueReview(ws.get('2026-W42'), d(2026, 12, 1), 3)).toBe(false);
  });
});

describe('cellOf: the calendar button of a week', () => {
  const fri = new Date(2026, 9, 16, 16, 30); // W42
  const mon = new Date(2026, 9, 19, 9, 0); // W43
  const ref = (line: number) => ({ path: 'weeks.org', line, title: '' });
  const wk = (week: number, o: Partial<Week> = {}): Week => ({ id: { year: 2026, week }, ref: ref(week), goalsRef: null, goals: [], review: null, ...o });
  const goal = { ref: ref(100), title: 'Цель', keyword: null, done: false, result: null, link: null };
  it('past: reviewed, due in its time, else skipped; now; future: to plan or planned', () => {
    expect(cellOf(wk(41, { review: { ref: ref(1), reviewed: '[2026-10-12]', skipped: null, answers: [] } }), { year: 2026, week: 41 }, fri, 3).kind).toBe('ok');
    expect(cellOf(wk(42), { year: 2026, week: 42 }, mon, 3)).toEqual({ kind: 'due', tip: '42 неделя — без итогов · подвести сейчас' });
    expect(cellOf(undefined, { year: 2026, week: 42 }, mon, 3).kind).toBe('skip'); // no plan: nothing to review
    expect(cellOf(wk(41), { year: 2026, week: 41 }, mon, 3).kind).toBe('skip'); // its time gone
    expect(cellOf(wk(42), { year: 2026, week: 42 }, fri, 3).kind).toBe('now');
    expect(cellOf(undefined, { year: 2026, week: 44 }, fri, 3)).toEqual({ kind: 'plan', tip: '44 неделя — запланировать' });
    expect(cellOf(wk(43, { goals: [goal] }), { year: 2026, week: 43 }, fri, 3).kind).toBe('planned');
  });
});
