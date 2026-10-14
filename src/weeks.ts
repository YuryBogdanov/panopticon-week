// The weeks (ISO: from Monday) and `weeks.org` as the plugin reads it from the outline the app gives. Pure: no ctx.
//
//   * 2026-W42 · 12–18 октября      a week: found by «YYYY-Www» at the start of its title
//   ** Цели                         its goals: headings of the 3rd level, a status optional, :RESULT: done|partial|missed
//   ** Итоги                        :REVIEWED: or :SKIPPED:, the answers as its subheadings

import type { HeadingInfo, HeadingRef, OrgDate } from '@panopticon/api';

export interface WeekId {
  year: number;
  week: number;
}
export type Result = 'done' | 'partial' | 'missed';
export interface Goal {
  ref: HeadingRef;
  title: string;
  keyword: string | null;
  done: boolean;
  scheduled?: OrgDate;
  result: Result | null;
  /** The :ID: of a task the goal was made into elsewhere (its note links it). */
  link: string | null;
}
export interface Week {
  id: WeekId;
  ref: HeadingRef;
  goalsRef: HeadingRef | null;
  goals: Goal[];
  review: { ref: HeadingRef; reviewed: string | null; skipped: string | null; answers: { title: string; ref: HeadingRef }[] } | null;
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
export const WEEKDAYS_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const pad = (n: number) => String(n).padStart(2, '0');
const day0 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** The ISO week of a day: the week of its Thursday. */
export function isoWeek(d: Date): WeekId {
  const t = day0(d);
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7)); // that week's Thursday
  const jan4 = new Date(t.getFullYear(), 0, 4);
  const week = 1 + Math.round((+t - +jan4) / 86400000 / 7 - 3 / 7 + ((jan4.getDay() + 6) % 7) / 7);
  return { year: t.getFullYear(), week };
}
/** Monday of an ISO week. */
export function mondayOf(w: WeekId): Date {
  const jan4 = new Date(w.year, 0, 4);
  const mon1 = new Date(w.year, 0, 4 - ((jan4.getDay() + 6) % 7));
  return new Date(mon1.getFullYear(), mon1.getMonth(), mon1.getDate() + (w.week - 1) * 7);
}
export const daysOf = (w: WeekId) => Array.from({ length: 7 }, (_, i) => {
  const m = mondayOf(w);
  return new Date(m.getFullYear(), m.getMonth(), m.getDate() + i);
});
export const addWeeks = (w: WeekId, n: number): WeekId => {
  const m = mondayOf(w);
  return isoWeek(new Date(m.getFullYear(), m.getMonth(), m.getDate() + 7 * n));
};
export const cmpWeek = (a: WeekId, b: WeekId) => a.year - b.year || a.week - b.week;
export const keyOf = (w: WeekId) => `${w.year}-W${pad(w.week)}`;
export function parseKey(s: string): WeekId | null {
  const m = /^(\d{4})-W(\d{2})\b/.exec(s.trim());
  return m ? { year: +m[1], week: +m[2] } : null;
}

/** «12 – 18 октября», «28 сентября – 4 октября». */
export function rangeTitle(w: WeekId): string {
  const [a, b] = [mondayOf(w), daysOf(w)[6]];
  return a.getMonth() === b.getMonth() ? `${a.getDate()} – ${b.getDate()} ${MONTHS[b.getMonth()]}` : `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]}`;
}
/** «12–18 окт», «28 сен – 4 окт». */
export function rangeShort(w: WeekId): string {
  const [a, b] = [mondayOf(w), daysOf(w)[6]];
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MONTHS_SHORT[b.getMonth()]}` : `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]} – ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]}`;
}
/** The week's heading in the file: «2026-W42 · 12–18 октября» (the part after « · » is for people). */
export function headingTitle(w: WeekId): string {
  const [a, b] = [mondayOf(w), daysOf(w)[6]];
  const dates = a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]}` : `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]}`;
  return `${keyOf(w)} · ${dates}`;
}
/** «[2026-10-16 Пт 16:40]», as Org writes an inactive stamp. */
export function stamp(d: Date): string {
  return `[${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${WEEKDAYS[d.getDay()]} ${pad(d.getHours())}:${pad(d.getMinutes())}]`;
}
/** The date of an inactive stamp, or null. */
export function stampDate(s: string | null | undefined): Date | null {
  const m = s && /\[(\d{4})-(\d{2})-(\d{2})(?:\s+\S+)?(?:\s+(\d{1,2}):(\d{2}))?/.exec(s);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0)) : null;
}
export const dateOf = (d: OrgDate) => new Date(d.y, d.m - 1, d.d);

const RESULTS: Result[] = ['done', 'partial', 'missed'];
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const LINK = /\[\[id:([^\]]+)\]/;

/**
 * The weeks of the file, by key, from its outline (the headings in order with their levels). `notes`: the first line
 * of each goal's text, when known (a link `[[id:…]]` there makes the goal a task elsewhere).
 */
export function readWeeks(outline: HeadingInfo[], notes: Map<string, string> = new Map()): Map<string, Week> {
  const out = new Map<string, Week>();
  let week: Week | null = null;
  let part: 'goals' | 'review' | null = null;
  for (const h of outline) {
    if (h.level === 1) {
      const id = parseKey(h.title);
      week = id ? { id, ref: h.ref, goalsRef: null, goals: [], review: null } : null;
      part = null;
      if (week && !out.has(keyOf(id!))) out.set(keyOf(id!), week);
      continue;
    }
    if (!week) continue;
    if (h.level === 2) {
      if (same(h.title, 'Цели')) {
        part = 'goals';
        week.goalsRef = h.ref;
      } else if (same(h.title, 'Итоги')) {
        part = 'review';
        week.review = { ref: h.ref, reviewed: h.properties?.REVIEWED ?? null, skipped: h.properties?.SKIPPED ?? null, answers: [] };
      } else part = null;
      continue;
    }
    if (h.level === 3 && part === 'goals') {
      const r = h.properties?.RESULT?.toLowerCase() as Result | undefined;
      const note = notes.get(refKey(h.ref)) ?? '';
      week.goals.push({
        ref: h.ref, title: h.title, keyword: h.keyword, done: h.done, ...(h.scheduled ? { scheduled: h.scheduled } : {}),
        result: r && RESULTS.includes(r) ? r : null, link: LINK.exec(note)?.[1] ?? null,
      });
    } else if (h.level === 3 && part === 'review' && week.review) week.review.answers.push({ title: h.title, ref: h.ref });
  }
  return out;
}
export const refKey = (r: HeadingRef) => `${r.path}#${r.line}`;

/** What a week is now: before it, it, after it. */
export function phase(w: WeekId, now: Date): 'past' | 'current' | 'future' {
  const c = cmpWeek(w, isoWeek(now));
  return c < 0 ? 'past' : c > 0 ? 'future' : 'current';
}
/** The review of a week can be made from its Friday 12:00 to the end of the chosen day of the next week (1 Mon … 4 Thu). */
export function reviewWindow(w: WeekId, until: number): { from: Date; to: Date } {
  const days = daysOf(w);
  const fri = days[4];
  const next = mondayOf(addWeeks(w, 1));
  return { from: new Date(fri.getFullYear(), fri.getMonth(), fri.getDate(), 12), to: new Date(next.getFullYear(), next.getMonth(), next.getDate() + until) };
}
export function canReview(w: WeekId, now: Date, until: number): boolean {
  const r = reviewWindow(w, until);
  return now >= r.from && now < r.to;
}
/** A week whose time to review has gone by, neither reviewed nor skipped: it is marked skipped (quietly). */
export function overdueReview(week: Week | undefined, now: Date, until: number): boolean {
  if (!week || week.review?.reviewed || week.review?.skipped) return false;
  return now >= reviewWindow(week.id, until).to;
}
