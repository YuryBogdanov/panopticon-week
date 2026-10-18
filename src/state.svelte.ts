// The plugin's state: weeks.org read through the index (its outline, the goals' notes), what the week holds in the
// other files (meetings, deadlines, tasks closed), and the writes — every one a transaction of the app (one ⌘Z).

import type { Ctx, HeadingInfo, HeadingRef, Tx } from '@panopticon/api';
import { addWeeks, dateOf, daysOf, headingTitle, isoWeek, keyOf, canReview, overdueReview, readWeeks, refKey, stamp, type Goal, type Result, type Week, type WeekId } from './weeks';

export interface Settings {
  file: string;
  maxGoals: number;
  until: number; // the review can be made until this day of the next week: 1 Mon … 4 Thu
  remind: boolean;
  questions: string[];
}
/** A goal as the plan sheet writes it: an existing one (`ref`), or a new one; `task` — with a status at once. */
export interface PlanGoal {
  title: string;
  ref?: HeadingRef;
  from?: { ref: HeadingRef; note: string }; // carried from the week before: its note goes along
  task?: boolean;
}
/** A day of a week, from the files: meetings, deadlines, tasks closed. */
export interface DayInfo {
  date: Date;
  meetings: { title: string; time?: string }[];
  deadlines: string[];
  closed: number;
}
/** «Неделя в цифрах»: from the files, never written. */
export interface Stats {
  closed: number;
  /** Tasks whose SCHEDULED was moved in the week (by :LOGBOOK:); null — the journal is off, nothing noted. */
  moved: number | null;
  overdue: number;
  meetings: number;
}
/** Where a goal that is a task is and how it stands. */
export interface TaskInfo {
  keyword: string | null;
  done: boolean;
  file: string;
  scheduled?: Date;
  closed?: Date;
  ref: HeadingRef;
}

const num = (v: unknown, d: number) => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' && !isNaN(+v) ? +v : d);
const str = (v: unknown, d: string) => (typeof v === 'string' && v.trim() ? v.trim() : d);

class State {
  ctx!: Ctx;
  /** The app's new interface (API 1.14 `ui.look`, ТЗ 51): the plugin draws its new look there; an older app — the old. */
  get next() {
    return this.ctx?.ui.look === 'next';
  }
  settings = $state<Settings>({ file: 'weeks.org', maxGoals: 5, until: 3, remind: true, questions: ['Что получилось', 'Что не получилось', 'Что меняю на следующей неделе'] });
  /** The weeks of the file by key; the goals' notes (first lines of their text). */
  weeks = $state.raw<Map<string, Week>>(new Map());
  notes = $state.raw<Map<string, string>>(new Map());
  /** The review's answers: the text of each question's heading, by its ref. */
  answers = $state.raw<Map<string, string>>(new Map());
  /** Every heading of the folder (the outlines), for the days and the goals made tasks elsewhere. */
  all = $state.raw<HeadingInfo[]>([]);
  /** The statuses of the default set (the first one of the file's sets). */
  statuses = $state.raw<{ open: string[]; done: string[] }>({ open: ['TODO', 'NEXT', 'WAIT'], done: ['DONE', 'CANCELLED'] });
  now = $state(new Date());
  /** The workflow keeps a journal: moves of dates are noted (the tile «перенесено»). */
  logbook = $state(false);
  loaded = $state(false);
  private n = 0;

  init(ctx: Ctx) {
    this.ctx = ctx;
    this.readSettings();
    ctx.settings.onChange(() => {
      this.readSettings();
      void this.load();
    });
    ctx.events.on('file.changed', () => void this.load());
    ctx.events.on('folder.changed', () => void this.load());
    ctx.events.on('day.changed', () => (this.now = new Date()));
    setInterval(() => (this.now = new Date()), 60_000);
    void this.load();
  }
  readSettings() {
    const v = this.ctx.settings.values();
    this.settings = {
      file: str(v.file, 'weeks.org'),
      maxGoals: num(v.maxGoals, 5),
      until: Math.max(1, Math.min(4, num(v.until, 3))),
      remind: v.remind !== false,
      questions: [str(v.q1, 'Что получилось'), str(v.q2, 'Что не получилось'), str(v.q3, 'Что меняю на следующей неделе')],
    };
  }

  /** Everything again: weeks.org, its goals' notes, the outlines of the folder. */
  async load() {
    const n = ++this.n;
    const idx = this.ctx.index!;
    const files = await idx.files();
    const outlines = await Promise.all(files.map(async (f) => ({ f, o: await idx.outline(f.path) })));
    if (n !== this.n) return;
    const mine = outlines.find((x) => x.f.path === this.settings.file)?.o ?? [];
    // the first line of each goal's text: its note (a link to a task made of it elsewhere is there)
    // and the whole text of each answer of a review
    const notes = new Map<string, string>();
    const answers = new Map<string, string>();
    let part: string | null = null;
    for (const h of mine) {
      if (h.level <= 2) part = h.level === 2 ? h.title.trim().toLowerCase() : null;
      else if (h.level === 3 && part === 'цели') {
        const body = (await idx.body(h.ref)) ?? '';
        notes.set(refKey(h.ref), body.split('\n').find((l) => l.trim())?.trim() ?? '');
      } else if (h.level === 3 && part === 'итоги') answers.set(refKey(h.ref), ((await idx.body(h.ref)) ?? '').replace(/^\n+|\s+$/g, ''));
    }
    if (n !== this.n) return;
    try {
      const wf = await idx.workflow(files[0]?.path ?? this.settings.file);
      const set = wf.sets[0];
      this.logbook = !!wf.logbook;
      if (set) this.statuses = { open: set.states.filter((s) => !s.done).map((s) => s.name), done: set.states.filter((s) => s.done).map((s) => s.name) };
    } catch {
      /* no file yet: the default statuses */
    }
    this.notes = notes;
    this.answers = answers;
    this.weeks = readWeeks(mine, notes);
    this.all = outlines.flatMap((x) => x.o);
    this.loaded = true;
    void this.skipOverdue();
  }
  /** The weeks whose time to review has gone by, neither reviewed nor skipped: marked skipped, quietly (once a run). */
  private tried = new Set<string>();
  private async skipOverdue() {
    const late = [...this.weeks.values()].filter((w) => !this.tried.has(keyOf(w.id)) && overdueReview(w, new Date(), this.settings.until));
    if (!late.length) return;
    for (const w of late) this.tried.add(keyOf(w.id));
    const at = stamp(new Date());
    await this.write(late.length === 1 ? `Итоги ${late[0].id.week} недели пропущены` : 'Итоги недель пропущены', (tx) => {
      for (const w of late) {
        const r = this.reviewIn(tx, w.id);
        if (r) tx.setProperty(r, 'SKIPPED', at);
      }
    });
  }

  get current(): WeekId {
    return isoWeek(this.now);
  }
  week(id: WeekId): Week | undefined {
    return this.weeks.get(keyOf(id));
  }
  note(g: Goal): string {
    return (this.notes.get(refKey(g.ref)) ?? '').replace(/\[\[id:[^\]]+\](?:\[[^\]]*\])?\]\s*/g, '').trim();
  }

  /** The days of a week: meetings (events), open tasks due, tasks closed — over every file. */
  days(id: WeekId): DayInfo[] {
    const days = daysOf(id);
    const at = (d?: { y: number; m: number; d: number }) => (d ? days.findIndex((x) => +x === +dateOf(d)) : -1);
    const out: DayInfo[] = days.map((date) => ({ date, meetings: [], deadlines: [], closed: 0 }));
    for (const h of this.all) {
      const e = at(h.event);
      if (e >= 0) out[e].meetings.push({ title: h.title.replace(/<\d{4}-[^>]*>/g, '').replace(/\s+/g, ' ').trim(), ...(h.event?.time ? { time: h.event.time } : {}) });
      const dl = at(h.deadline);
      if (dl >= 0 && h.keyword && !h.done) out[dl].deadlines.push(h.title);
      const c = at(h.closed);
      if (c >= 0) out[c].closed++;
    }
    return out;
  }
  /** «Неделя в цифрах»: tasks closed in the week, open ones whose date in it has passed, the meetings. */
  stats(id: WeekId): Stats {
    const days = daysOf(id);
    const [from, to] = [+days[0], +days[6] + 86400000];
    const now = new Date(this.now.getFullYear(), this.now.getMonth(), this.now.getDate());
    const inWeek = (d?: { y: number; m: number; d: number }) => !!d && +dateOf(d) >= from && +dateOf(d) < to;
    let closed = 0, overdue = 0, meetings = 0, moved = 0;
    for (const h of this.all) {
      if (h.reschedules?.some((r) => inWeek(r.at))) moved++;
      if (inWeek(h.closed)) closed++;
      if (inWeek(h.event)) meetings++;
      const due = [h.scheduled, h.deadline].filter((d) => inWeek(d) && dateOf(d!) < now);
      if (h.keyword && !h.done && due.length) overdue++;
    }
    return { closed, moved: this.logbook ? moved : null, overdue, meetings };
  }
  /** The answer to a question of a week's review (its heading's text), or ''. */
  answer(id: WeekId, question: string): string {
    const a = this.week(id)?.review?.answers.find((x) => x.title.trim().toLowerCase() === question.trim().toLowerCase());
    return a ? (this.answers.get(refKey(a.ref)) ?? '') : '';
  }

  /** A goal that is a task: here (its status in weeks.org) or elsewhere (by the :ID: its note links). */
  taskOf(g: Goal): TaskInfo | null {
    if (g.keyword) return { keyword: g.keyword, done: g.done, file: this.settings.file, ...(g.scheduled ? { scheduled: dateOf(g.scheduled) } : {}), ref: g.ref };
    if (!g.link) return null;
    const h = this.all.find((x) => x.properties?.ID === g.link);
    return h ? { keyword: h.keyword, done: h.done, file: h.ref.path, ...(h.scheduled ? { scheduled: dateOf(h.scheduled) } : {}), ...(h.closed ? { closed: dateOf(h.closed) } : {}), ref: h.ref } : null;
  }

  // ---- writing ------------------------------------------------------------------------------------------------------

  private async write(label: string, build: (tx: Tx) => void): Promise<boolean> {
    const r = await this.ctx.edit!.transaction(label, build);
    if (r !== 'ok') {
      if (r === 'conflict') this.ctx.ui.notify('Файл недель изменился — попробуйте ещё раз');
      return false;
    }
    await this.load();
    return true;
  }
  /** The week's heading in the transaction: found, or made in its place among the weeks (they go in order). */
  private weekIn(tx: Tx, id: WeekId): HeadingRef | null {
    const have = this.week(id);
    if (have) return have.ref;
    const before = [...this.weeks.values()].filter((w) => keyOf(w.id) < keyOf(id)).sort((a, b) => keyOf(b.id).localeCompare(keyOf(a.id)))[0];
    return before ? tx.insertHeading({ after: before.ref }, `* ${headingTitle(id)}`) : tx.insertHeading({ file: this.settings.file, position: 'end' }, `* ${headingTitle(id)}`);
  }
  /** The week's «Итоги» in the transaction: found or made (with the week). */
  private reviewIn(tx: Tx, id: WeekId): HeadingRef | null {
    const w = this.weekIn(tx, id);
    return w && tx.ensureChild(w, 'Итоги');
  }
  /** A goal's mark of the review: :RESULT:, at once. */
  async setResult(g: Goal, r: Result | null) {
    return this.write(`Цель: ${r === 'done' ? 'да' : r === 'partial' ? 'частично' : r === 'missed' ? 'нет' : 'без оценки'}`, (tx) => tx.setProperty(g.ref, 'RESULT', r));
  }
  /**
   * The review's answers as typed: each question a heading under «Итоги» (in the questions' order), an empty one
   * left out (removed when it was there). Nothing changed — nothing written.
   */
  async saveAnswers(id: WeekId, texts: string[]) {
    const qs = this.settings.questions;
    const have = this.week(id)?.review?.answers ?? [];
    const find = (q: string) => have.find((x) => x.title.trim().toLowerCase() === q.trim().toLowerCase());
    const clean = texts.map((t) => t.replace(/\s+$/, '').replace(/^\n+/, ''));
    if (qs.every((q, i) => (clean[i] ?? '') === this.answer(id, q))) return true;
    if (!(await this.ctx.edit!.ensureFile(this.settings.file))) return false;
    return this.write(`Итоги ${id.week} недели`, (tx) => {
      const r = this.reviewIn(tx, id);
      if (!r) return;
      qs.forEach((q, i) => {
        const t = clean[i] ?? '';
        if (t === this.answer(id, q)) return;
        const a = find(q);
        // a line starting with a star would be a heading: kept as text
        const body = t.replace(/^\*/gm, ' *');
        if (a && !t) tx.remove(a.ref);
        else if (a) tx.replaceBody(a.ref, body);
        else {
          const later = qs.slice(i + 1).map(find).find(Boolean);
          tx.insertHeading(later ? { under: r, before: later.ref } : { under: r, position: 'last' }, `* ${q}\n${body}`);
        }
      });
    });
  }
  /**
   * The review made: :REVIEWED: (kept when there already), :SKIPPED: gone; a goal that is a task done and not marked
   * gets «Да».
   */
  async finish(id: WeekId) {
    if (!(await this.ctx.edit!.ensureFile(this.settings.file))) return false;
    const w = this.week(id);
    const auto = (w?.goals ?? []).filter((g) => !g.result && this.taskOf(g)?.done);
    return this.write(`Итоги ${id.week} недели подведены`, (tx) => {
      const r = this.reviewIn(tx, id);
      if (!r) return;
      if (!w?.review?.reviewed) tx.setProperty(r, 'REVIEWED', stamp(new Date()));
      if (w?.review?.skipped) tx.setProperty(r, 'SKIPPED', null);
      for (const g of auto) tx.setProperty(g.ref, 'RESULT', 'done');
    });
  }
  /** «Пропустить неделю»: :SKIPPED: on its «Итоги». */
  async skip(id: WeekId) {
    if (!(await this.ctx.edit!.ensureFile(this.settings.file))) return false;
    return this.write(`Итоги ${id.week} недели пропущены`, (tx) => {
      const r = this.reviewIn(tx, id);
      if (r) tx.setProperty(r, 'SKIPPED', stamp(new Date()));
    });
  }
  /** The week whose review is due now: the last one (in its window, not made), else this one from Friday 12:00. */
  due(): WeekId | null {
    for (const id of [addWeeks(this.current, -1), this.current]) {
      const w = this.week(id);
      if (w && !w.review?.reviewed && !w.review?.skipped && canReview(id, this.now, this.settings.until)) return id;
    }
    return null;
  }

  /** «+ Цель»: a goal at the end of the week's goals (the week and «Цели» made when there are none). */
  async addGoal(id: WeekId, title: string) {
    const t = title.replace(/\s+/g, ' ').trim();
    if (!t || !(await this.ctx.edit!.ensureFile(this.settings.file))) return false;
    await this.load();
    return this.write(`Цель недели: ${t}`, (tx) => {
      const w = this.weekIn(tx, id);
      const goals = w && tx.ensureChild(w, 'Цели');
      if (goals) tx.insertHeading({ under: goals, position: 'last' }, `* ${t}`);
    });
  }
  /**
   * «Сохранить план»: the week made if it is not there, its goals as listed — those kept renamed when edited, those
   * carried copied with their notes (no :RESULT:), new ones added, those taken out removed. One transaction.
   */
  async savePlan(id: WeekId, list: PlanGoal[]): Promise<boolean> {
    if (!(await this.ctx.edit!.ensureFile(this.settings.file))) return false;
    await this.load();
    const before = this.week(id)?.goals ?? [];
    const status = this.statuses.open[0] ?? 'TODO';
    const carried = new Map<string, string>();
    for (const g of list) if (g.from) carried.set(refKey(g.from.ref), (await this.ctx.index!.body(g.from.ref)) ?? g.from.note);
    return this.write(`План на ${id.week} неделю`, (tx) => {
      const w = this.weekIn(tx, id);
      const goals = w && tx.ensureChild(w, 'Цели');
      if (!goals) return;
      for (const g of before) if (!list.some((x) => x.ref && refKey(x.ref) === refKey(g.ref))) tx.remove(g.ref);
      for (const g of list) {
        const t = g.title.replace(/\s+/g, ' ').trim();
        if (!t) continue;
        if (g.ref) {
          const was = before.find((x) => refKey(x.ref) === refKey(g.ref!));
          if (was && was.title !== t) tx.setTitle(g.ref, t);
          if (g.task && was && !was.keyword) tx.setStatus(g.ref, status);
          continue;
        }
        const note = g.from ? (carried.get(refKey(g.from.ref)) ?? '').trim() : '';
        const ref = tx.insertHeading({ under: goals, position: 'last' }, `* ${t}${note ? '\n' + note : ''}`);
        if (ref && g.task) tx.setStatus(ref, status);
      }
    });
  }
  /** «Сделать задачей…», left in weeks.org: a status (and a day). */
  async makeTask(g: Goal, status: string, day: Date | null) {
    return this.write(`Цель — задачей: ${g.title}`, (tx) => {
      tx.setStatus(g.ref, status);
      if (day) tx.setPlanning(g.ref, 'SCHEDULED', day);
    });
  }
  /** «Сделать задачей…», moved to a file: the task made there with an :ID:, the goal's note linking it. */
  async makeTaskIn(g: Goal, at: { path: string } | HeadingRef, status: string, day: Date | null) {
    const id = crypto.randomUUID();
    const note = this.note(g);
    return this.write(`Цель — задачей: ${g.title}`, (tx) => {
      const ref = 'line' in at ? tx.insertHeading({ under: at, position: 'last' }, `* ${g.title}`) : tx.insertHeading({ file: at.path, position: 'end' }, `* ${g.title}`);
      if (!ref) return;
      tx.setStatus(ref, status);
      if (day) tx.setPlanning(ref, 'SCHEDULED', day);
      tx.setProperty(ref, 'ID', id);
      if (note) tx.replaceBody(ref, note);
      tx.replaceBody(g.ref, `Задача: [[id:${id}][${g.title}]]${note ? '\n' + note : ''}`);
    });
  }
  /** The week before a week (its goals carried in the plan). */
  prev(id: WeekId) {
    return this.week(addWeeks(id, -1));
  }
}

export const week = new State();
