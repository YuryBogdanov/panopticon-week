<script lang="ts">
  import { week as st } from './state.svelte';
  import { addWeeks, canReview, cmpWeek, isoWeek, keyOf, parseKey, phase, rangeTitle, stampDate, WEEKDAYS, WEEKDAYS_FULL, type Goal, type WeekId } from './weeks';
  import { openPlan } from './plan';
  import { makeTaskMenu } from './task';

  // The tab «Неделя» (ТЗ 36 §3): the week's goals on the left, its days and the weeks' reviews on the right. One tab,
  // moved from week to week (its state: the week's key).
  let { key, go: goKey }: { key: string; go: (key: string) => void } = $props();
  const id = $derived(parseKey(key) ?? st.current);
  const go = (w: WeekId) => goKey(keyOf(w));
  const review = (w: WeekId) => goKey(keyOf(w) + '/review');
  // its review: open while it can be made; a past week's, once made, to correct
  const rv = $derived(w?.review ?? null);
  const reviewable = $derived(canReview(id, st.now, st.settings.until) || !!rv?.reviewed);
  const stats = $derived(st.stats(id));
  const ph = $derived(phase(id, st.now));
  const w = $derived(st.week(id));
  const goals = $derived(w?.goals ?? []);
  const days = $derived(st.days(id));
  const today = $derived(+new Date(st.now.getFullYear(), st.now.getMonth(), st.now.getDate()));
  const kicker = $derived(
    ph === 'current' ? `${id.week} НЕДЕЛЯ · СЕЙЧАС ${WEEKDAYS_FULL[st.now.getDay()].toUpperCase()}` : ph === 'past' ? `${id.week} НЕДЕЛЯ · ПРОШЛА` : `${id.week} НЕДЕЛЯ · ВПЕРЕДИ`,
  );

  // ---- the goals --------------------------------------------------------------------------------------------------
  let adding = $state('');
  let addEl: HTMLInputElement | undefined = $state();
  async function add(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      adding = '';
      addEl?.blur();
    } else if (e.key === 'Enter' && adding.trim()) {
      e.preventDefault();
      const t = adding;
      adding = '';
      await st.addGoal(id, t);
      queueMicrotask(() => addEl?.focus());
    }
  }
  const RESULT: Record<string, [string, string]> = { done: ['Да', 'var(--done)'], partial: ['Частично', 'var(--wait)'], missed: ['Нет', 'var(--todo)'] };
  const tone = (kw: string | null, done: boolean) => (done ? 'var(--done)' : kw === 'WAIT' ? 'var(--wait)' : kw === 'NEXT' ? 'var(--next)' : 'var(--todo)');
  const nx = $derived(st.next);
  /** A file's name as the new interface shows it: without «.org» (ТЗ 44 §11). */
  const shown = (f: string) => (nx ? f.replace(/\.org$/i, '') : f);
  /** «Задача в midterm.org · запланирована на чт», «… · выполнена во вт». */
  function where(g: Goal): string {
    const t = st.taskOf(g);
    if (!t) return '';
    const day = (d: Date) => WEEKDAYS[d.getDay()].toLowerCase();
    const how = t.done ? (t.closed ? `выполнена в${t.closed.getDay() === 2 ? 'о' : ''} ${day(t.closed)}` : 'выполнена') : t.scheduled ? `запланирована на ${day(t.scheduled)}` : 'без даты';
    return `Задача в ${shown(t.file)} · ${how}`;
  }
  const open = (g: Goal) => void st.ctx.commands.run('file.open', { path: g.ref.path, line: g.ref.line });
  const openTask = (g: Goal) => {
    const t = st.taskOf(g);
    if (t) void st.ctx.commands.run('file.open', { path: t.ref.path, line: t.ref.line });
  };

  // ---- the days ---------------------------------------------------------------------------------------------------
  const plural = (n: number, one: string, few: string, many: string) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many}`;
  function what(d: (typeof days)[number]): string {
    const parts: string[] = [];
    if (d.meetings.length === 1) parts.push(d.meetings[0].title);
    else if (d.meetings.length) parts.push(plural(d.meetings.length, 'встреча', 'встречи', 'встреч'));
    for (const t of d.deadlines.slice(0, 2)) parts.push(nx ? `⚑ ${t}` : `дедлайн: ${t}`);
    if (+d.date === today && !nx) parts.unshift('сегодня');
    return parts.join(' · ') || '—';
  }

  // ---- the reviews of the weeks: the last eight -------------------------------------------------------------------------
  const strip = $derived(
    Array.from({ length: 8 }, (_, i) => addWeeks(st.current, i - 7)).map((x) => {
      const r = st.week(x)?.review;
      const now = cmpWeek(x, st.current) === 0;
      return { id: x, state: now ? 'now' : r?.reviewed ? 'ok' : 'skip', tip: now ? 'Текущая' : r?.reviewed ? 'Подведены' : 'Пропущены' };
    }),
  );
  /** Under the strip: the last week's review — when it was made, or that it can be made now. */
  const last = $derived.by(() => {
    const p = addWeeks(st.current, -1);
    const r = st.week(p)?.review;
    const at = stampDate(r?.reviewed);
    if (at) return { id: p, text: `${p.week} неделя — подведены ${WEEKDAYS_IN[at.getDay()]}, ${at.getHours()}:${String(at.getMinutes()).padStart(2, '0')}`, review: false };
    if (st.week(p) && !r?.skipped && canReview(p, st.now, st.settings.until)) return { id: p, text: `${p.week} неделя без итогов — подвести сейчас`, review: true };
    return null;
  });
  const WEEKDAYS_IN = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу'];
</script>

<div class="wk-view" class:nx={st.next}>
  <div class="wk-wrap">
    <header>
      <div class="wk-ttl">
        <div class="wk-kick">{kicker}</div>
        <h1>{rangeTitle(id)}</h1>
      </div>
      <nav class="wk-nav" aria-label="Соседние недели">
        <button aria-label="Предыдущая неделя" onclick={() => go(addWeeks(id, -1))}>‹ {addWeeks(id, -1).week}</button>
        {#if ph !== 'current'}<button class="wk-now" onclick={() => go(isoWeek(new Date()))}>Сейчас</button>{:else if !nx}<span>·</span>{/if}
        <button aria-label="Следующая неделя" onclick={() => go(addWeeks(id, 1))}>{addWeeks(id, 1).week} ›</button>
      </nav>
      {#if reviewable && ph !== 'future'}
        <button class="wk-btn wk-rvb" class:pri={!rv?.reviewed} onclick={() => review(id)}>{rv?.reviewed ? 'Итоги…' : 'Подвести итоги…'}</button>
      {/if}
      {#if ph === 'current'}
        <button class="wk-btn" onclick={() => openPlan(id)}>Изменить план</button>
      {:else if ph === 'future'}
        <button class="wk-btn pri" onclick={() => openPlan(id)}>Запланировать…</button>
      {/if}
    </header>

    <div class="wk-cols">
      <section class="wk-goals" aria-label="Цели недели">
        <div class="wk-h"><b>Цели недели</b><span>ориентиры, не обязательно задачи</span></div>
        {#each goals as g, i (g.ref.line + ':' + g.title)}
          {@const t = st.taskOf(g)}
          <div class="wk-goal">
            <span class="wk-n" class:done={t?.done || g.done}>{i + 1}</span>
            <div class="wk-gm">
              <div class="wk-gt">
                {#if t?.keyword}<span class="wk-cap" style:--c={tone(t.keyword, t.done)}>{t.keyword}</span>{/if}
                <span class="wk-gtitle" class:done={t?.done}>{g.title}</span>
              </div>
              {#if st.note(g)}<div class="wk-note">{st.note(g)}</div>{/if}
              <div class="wk-gl">
                {#if ph === 'past'}
                  {#if g.result}<span class="wk-cap" style:--c={RESULT[g.result][1]}>{RESULT[g.result][0]}</span>{:else}<span class="wk-dim">не оценена</span>{/if}
                {:else if t}
                  <button class="wk-link dim" onclick={() => openTask(g)}>{where(g)}</button>
                {:else}
                  <button class="wk-link" onclick={(e) => makeTaskMenu(g, id, e.currentTarget as HTMLElement)}>Сделать задачей…</button>
                {/if}
                <button class="wk-link faint" onclick={() => open(g)}>Открыть в {shown(st.settings.file)}{nx ? ' ›' : ''}</button>
              </div>
            </div>
          </div>
        {:else}
          <div class="wk-empty">{ph === 'past' ? 'На эту неделю целей не было' : 'Целей пока нет — добавьте 3–5 ориентиров'}</div>
        {/each}
        {#if ph !== 'past' && goals.length < st.settings.maxGoals}
          <label class="wk-add">
            <span aria-hidden="true">+</span>
            <input bind:this={addEl} bind:value={adding} onkeydown={add} placeholder="Цель · до {st.settings.maxGoals} на неделю" aria-label="Новая цель" spellcheck="false" />
          </label>
        {/if}
      </section>

      <aside class="wk-side">
        {#if ph === 'past'}
          <section class="wk-card" aria-label="Итоги недели">
            <b>{nx ? 'Итоги' : 'Итоги недели'}</b>
            {#if rv?.reviewed}
              {#each st.settings.questions as q (q)}
                {@const a = st.answer(id, q)}
                <div class="wk-ans">
                  <div class="wk-aq">{q}</div>
                  {#if a}<div class="wk-at">{a}</div>{:else}<div class="wk-at dim">—</div>{/if}
                </div>
              {/each}
            {:else}
              <div class="wk-ans dim">{rv?.skipped ? 'Итоги не подводились' : 'Итоги не подведены'}</div>
            {/if}
          </section>
          <section class="wk-card" aria-label="Неделя в цифрах">
            <b>Неделя в цифрах</b>
            <div class="wk-nums">
              <div><b style:color="var(--done)">{stats.closed}</b><span>{plural(stats.closed, 'задача закрыта', 'задачи закрыты', 'задач закрыто').replace(/^\d+ /, '')}</span></div>
              {#if stats.moved !== null}<div><b style:color="var(--wait)">{stats.moved}</b><span>перенесено</span></div>{/if}
              <div><b style:color="var(--todo)">{stats.overdue}</b><span>просрочено</span></div>
              <div><b>{stats.meetings}</b><span>{plural(stats.meetings, 'встреча', 'встречи', 'встреч').replace(/^\d+ /, '')}</span></div>
            </div>
          </section>
        {:else}
        <section class="wk-card" aria-label="Неделя по дням">
          <b>Неделя по дням{#if nx}<span class="wk-hs">закрыто задач — справа</span>{/if}</b>
          {#each days as d (+d.date)}
            <div class="wk-day" class:today={+d.date === today} class:future={+d.date > today}>
              <span class="wk-dn">{WEEKDAYS[d.date.getDay()]} {d.date.getDate()}</span>
              <span class="wk-dw">{what(d)}</span>
              {#if d.closed}<span class="wk-dc">✓ {d.closed}</span>{/if}
            </div>
          {/each}
        </section>
        {/if}
        <section class="wk-card" aria-label="Итоги недель">
          <b>Итоги недель{#if nx}<span class="wk-hs">8 последних</span>{/if}</b>
          <div class="wk-strip">
            {#each strip as s (keyOf(s.id))}
              <button class="wk-sq {s.state}" title="{s.id.week} неделя — {s.tip.toLowerCase()}" onclick={() => go(s.id)}>{s.id.week}</button>
            {/each}
          </div>
          {#if !nx}<div class="wk-legend"><span><i class="ok"></i> подведены</span><span><i></i> пропущены</span></div>{/if}
          {#if last}
            <button class="wk-last" class:go={last.review} onclick={() => (last.review ? review(last.id) : go(last.id))}>{last.text} ›</button>
          {/if}
        </section>
      </aside>
    </div>
  </div>
</div>

<style>
  .wk-view { height: 100%; overflow: auto; background: var(--stage, var(--side)); color: var(--fg); font: 13px var(--ui, -apple-system, system-ui, sans-serif); }
  /* the new interface (ТЗ 51): on the tab's grid, the tokens and fonts of the app */
  .wk-view.nx { background: transparent; color: var(--ink); }
  /* ---- the new interface (ТЗ 51 §1): the header as the app's screens, the goals in the file's text's font ---- */
  .nx .wk-wrap { max-width: 1440px; padding: 26px 36px 32px; gap: 20px; }
  .nx header { gap: 8px; }
  .nx .wk-kick { margin-bottom: 8px; font: 500 11px var(--font-mono, ui-monospace, monospace); letter-spacing: 0.06em; color: var(--ink3); }
  .nx h1 { margin: 0; font: 400 38px/1.05 var(--font-display, Georgia, serif); color: var(--ink); }
  .nx .wk-nav { gap: 8px; margin-right: 8px; }
  .nx .wk-nav button, .nx .wk-btn { height: 30px; padding: 0 14px; border: 0; border-radius: 7px; background: var(--chip2); color: var(--ink); font: 12.5px var(--ui, -apple-system, system-ui, sans-serif); white-space: nowrap; }
  .nx .wk-nav button:hover, .nx .wk-btn:hover { filter: brightness(0.97); }
  .nx .wk-btn.pri { background: var(--lamp); color: var(--onlamp); font-weight: 600; }
  .nx .wk-rvb { order: 1; } /* the review last, by the plan (the mockup) */
  .nx .wk-btn:focus-visible, .nx .wk-nav button:focus-visible { outline: 2px solid var(--lampline); outline-offset: 2px; }
  .nx .wk-cols { gap: 20px; flex-wrap: nowrap; }
  .nx .wk-goals { flex: 1 1 auto; gap: 10px; }
  .nx .wk-h { margin-bottom: 0; }
  .nx .wk-h b { font-size: 13.5px; font-weight: 700; }
  .nx .wk-h span { color: var(--ink3); }
  .nx .wk-goal { padding: 14px 16px 12px; border: 1px solid var(--rule); border-radius: 12px; background: var(--card); }
  .nx .wk-n { flex: 0 0 24px; width: 24px; height: 24px; border-radius: 12px; background: var(--chip2); color: var(--ink2); font-size: 12px; }
  .nx .wk-n.done { background: color-mix(in srgb, var(--done) 18%, transparent); color: var(--done); }
  .nx .wk-cap { display: inline-flex; align-items: center; height: 18px; padding: 0 6px; font-size: 10.5px; }
  .nx .wk-gtitle { font: 600 21px/1.2 var(--font-text, Georgia, serif); color: var(--ink); }
  .nx .wk-gtitle.done { color: var(--ink3); }
  .nx .wk-note { margin-top: 3px; font: 500 16.5px/1.35 var(--font-text, Georgia, serif); color: var(--ink2); }
  .nx .wk-gl { gap: 14px; margin-top: 9px; }
  .nx .wk-link { color: var(--lampink); }
  .nx .wk-link.dim, .nx .wk-link.faint, .nx .wk-dim { color: var(--ink3); }
  .nx .wk-link.faint { margin-left: auto; }
  .nx .wk-empty { border: 1px solid var(--rule); background: var(--card); color: var(--ink2); }
  .nx .wk-add { height: 44px; border: 1.5px dashed var(--rule); color: var(--ink3); font-size: 13px; }
  .nx .wk-add:focus-within { border: 1.5px solid var(--lampline); }
  .nx .wk-add input { font: 600 19px var(--font-text, Georgia, serif); color: var(--ink); }
  .nx .wk-add input::placeholder { font: 13px var(--ui, -apple-system, system-ui, sans-serif); color: var(--ink3); }
  .nx .wk-side { flex: 0 0 380px; gap: 16px; }
  .nx .wk-card { padding: 14px 16px 12px; border: 1px solid var(--rule); border-radius: 12px; background: var(--card); }
  .nx .wk-card > b { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; font-size: 13.5px; font-weight: 700; }
  .wk-hs { font-size: 12px; font-weight: 400; color: var(--ink3); }
  .nx .wk-day { gap: 10px; height: 32px; min-height: 0; border-top: 1px solid var(--rule); }
  .nx .wk-day.future { opacity: 0.55; }
  .nx .wk-dn { flex: 0 0 44px; font: 11.5px var(--font-mono, ui-monospace, monospace); color: var(--ink3); }
  .nx .wk-day.today .wk-dn { color: var(--lampink); font-weight: 600; }
  .nx .wk-dw { font-size: 13px; color: var(--ink); }
  .nx .wk-day.today .wk-dw { font-weight: 600; }
  .nx .wk-dc { font-weight: 600; }
  .nx .wk-strip { gap: 6px; margin: 4px 0 10px; }
  .nx .wk-sq { flex: 0 0 32px; width: 32px; height: 32px; box-sizing: border-box; border-radius: 7px; border: 0; background: var(--chip); color: var(--ink3); font: 700 12px var(--ui, -apple-system, system-ui, sans-serif); }
  .nx .wk-sq.ok { background: color-mix(in srgb, var(--done) 16%, transparent); color: var(--done); }
  .nx .wk-sq.now { background: transparent; border: 1.5px solid var(--lamp); color: var(--lampink); }
  .nx .wk-last { margin: 0; padding: 0; border: 0; font-size: 12.5px; color: var(--lampink); }
  .nx .wk-last.go { color: var(--lampink); }
  .nx .wk-ans { padding: 8px 0; border-top: 1px solid var(--rule); }
  .nx .wk-ans.dim { color: var(--ink3); }
  .nx .wk-aq { font-size: 12.5px; font-weight: 600; color: var(--ink2); }
  .nx .wk-at { margin-top: 3px; font: 500 16px/1.4 var(--font-text, Georgia, serif); color: var(--ink); }
  .nx .wk-at.dim { color: var(--ink3); }
  .nx .wk-nums { gap: 10px; margin: 2px 0 4px; }
  .nx .wk-nums > div { padding: 12px 14px; border: 0; border-radius: 10px; background: var(--chip); }
  .nx .wk-nums b { font: 400 30px/1.1 var(--font-display, Georgia, serif); }
  .nx .wk-nums span { font-size: 12px; color: var(--ink2); }
  .wk-wrap { max-width: 1340px; margin: 0 auto; padding: 22px 32px 28px; box-sizing: border-box; display: flex; flex-direction: column; gap: 16px; }
  header { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
  .wk-ttl { flex: 1; min-width: 0; }
  .wk-kick { font-size: 12px; font-weight: 600; letter-spacing: 0.05em; color: var(--fg3); }
  h1 { margin: 2px 0 0; font-size: 26px; font-weight: 700; line-height: 1.2; }
  .wk-nav { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--fg3); }
  .wk-nav button { border: 0; background: none; padding: 2px 4px; color: var(--fg3); font: inherit; border-radius: 4px; }
  .wk-nav button:hover { color: var(--fg); background: var(--field); }
  .wk-btn { height: 30px; padding: 0 12px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg); color: var(--fg); font: inherit; }
  .wk-btn.pri { border: 0; background: var(--acc); color: var(--onacc); font-weight: 600; }
  .wk-cols { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
  .wk-goals { flex: 1.6 1 420px; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
  .wk-h { display: flex; align-items: baseline; gap: 8px; }
  .wk-h b { font-size: 15px; }
  .wk-h span { font-size: 12px; color: var(--fg3); }
  .wk-goal { display: flex; gap: 12px; padding: 14px 16px; border-radius: 12px; background: var(--bg); border: 1px solid var(--line); }
  .wk-n { flex: 0 0 26px; width: 26px; height: 26px; border-radius: 13px; background: var(--field); display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--fg2); }
  .wk-gm { flex: 1; min-width: 0; }
  .wk-gt { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .wk-gtitle { font-size: 14.5px; font-weight: 600; }
  .wk-gtitle.done { text-decoration: line-through; color: var(--fg3); }
  .wk-cap { display: inline-block; padding: 1px 5px; border-radius: 4px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.02em; color: var(--c); background: color-mix(in srgb, var(--c) 16%, transparent); }
  .wk-note { font-size: 12.5px; color: var(--fg2); margin-top: 3px; }
  .wk-gl { display: flex; align-items: center; gap: 12px; margin-top: 9px; font-size: 12px; }
  .wk-link { border: 0; background: none; padding: 0; font: inherit; color: var(--acc); }
  .wk-link.dim { color: var(--fg2); }
  .wk-link.faint { color: var(--fg3); }
  .wk-link:hover { text-decoration: underline; }
  .wk-dim { color: var(--fg3); }
  .wk-empty { padding: 14px 16px; border-radius: 12px; background: var(--bg); border: 1px solid var(--line); color: var(--fg2); }
  .wk-add { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 16px; border-radius: 12px; border: 1px dashed var(--line); color: var(--fg3); }
  .wk-add:focus-within { border-style: solid; border-color: var(--acc); }
  .wk-add input { flex: 1; border: 0; outline: none; background: none; font: inherit; color: var(--fg); }
  .wk-side { flex: 1 1 300px; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
  .wk-card { padding: 12px 16px 8px; border-radius: 12px; background: var(--bg); border: 1px solid var(--line); }
  .wk-card > b { display: block; margin-bottom: 4px; }
  .wk-day { display: flex; align-items: center; gap: 10px; min-height: 30px; border-top: 1px solid var(--line); }
  .wk-day.future { opacity: 0.6; }
  .wk-dn { flex: 0 0 74px; }
  .wk-day.today .wk-dn { font-weight: 700; color: var(--acc); }
  .wk-dw { flex: 1; min-width: 0; font-size: 12px; color: var(--fg2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .wk-dc { font-size: 12px; color: var(--done); }
  .wk-strip { display: flex; gap: 6px; margin-top: 10px; }
  .wk-sq { flex: 1; height: 26px; border-radius: 5px; border: 1px solid transparent; background: var(--field); color: var(--fg3); font: inherit; font-size: 10.5px; padding: 0; }
  .wk-sq.ok { background: color-mix(in srgb, var(--done) 16%, transparent); color: var(--done); }
  .wk-sq.now { background: transparent; border: 1.5px solid var(--acc); color: var(--acc); }
  .wk-legend { display: flex; gap: 12px; margin: 8px 0 4px; font-size: 11.5px; color: var(--fg2); }
  .wk-legend i { display: inline-block; width: 8px; height: 8px; border-radius: 2px; background: var(--field); }
  .wk-legend i.ok { background: var(--done); }
  .wk-last { display: block; width: 100%; text-align: left; margin: 2px 0 4px; padding: 6px 0 0; border: 0; border-top: 1px solid var(--line); background: none; font: inherit; font-size: 12.5px; color: var(--fg2); }
  .wk-last.go { color: var(--acc); }
  .wk-last:hover { text-decoration: underline; }
  .wk-ans { padding: 7px 0; border-top: 1px solid var(--line); }
  .wk-ans.dim { color: var(--fg3); }
  .wk-aq { font-size: 12px; font-weight: 600; color: var(--fg2); }
  .wk-at { margin-top: 2px; font-size: 12.5px; white-space: pre-wrap; }
  .wk-at.dim { color: var(--fg3); }
  .wk-nums { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 6px 0 8px; }
  .wk-nums > div { flex: 1; padding: 8px 10px; border-radius: 9px; background: var(--side); border: 1px solid var(--line); }
  .wk-nums b { display: block; font-size: 18px; }
  .wk-nums span { font-size: 11.5px; color: var(--fg2); white-space: nowrap; }
  .wk-nums > div { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
</style>
