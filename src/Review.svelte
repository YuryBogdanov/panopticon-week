<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { week as st } from './state.svelte';
  import { addWeeks, canReview, keyOf, rangeTitle, refKey, stampDate, WEEKDAYS_FULL, type Goal, type Result, type WeekId } from './weeks';
  import { openPlan } from './plan';

  // «Итоги недели» (ТЗ 36 §4): the goals marked, the week in numbers, three answers; then the plan of the next one.
  // A scene of the tab «Неделя»: `back` shows the week again.
  let { id, back, again }: { id: WeekId; back: () => void; again: () => void } = $props();

  const w = $derived(st.week(id));
  const goals = $derived(w?.goals ?? []);
  const next = $derived(addWeeks(id, 1));
  const stats = $derived(st.stats(id));
  const reviewed = $derived(w?.review?.reviewed ?? null);

  // ---- the marks: written at once; a goal that is a task done comes marked «Да» (written with the review) ----------
  const SEG: [Result, string, string][] = [['done', 'Да', 'var(--done)'], ['partial', 'Частично', 'var(--wait)'], ['missed', 'Нет', 'var(--todo)']];
  const markOf = (g: Goal): Result | null => g.result ?? (st.taskOf(g)?.done ? 'done' : null);
  const mark = (g: Goal, r: Result) => void st.setResult(g, markOf(g) === r && g.result ? null : r);

  // ---- the answers: typed here, written after a pause (and before leaving) ----------------------------------------
  const HINTS = ['- Что сделано, чем доволен', '- Что не вышло и почему', 'Например: созвоны с США — только вт и чт'];
  // svelte-ignore state_referenced_locally
  let texts = $state(st.settings.questions.map((q) => st.answer(id, q)));
  let timer: ReturnType<typeof setTimeout> | undefined;
  let saving: Promise<unknown> = Promise.resolve();
  const typed = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), 700);
  };
  function flush() {
    clearTimeout(timer);
    timer = undefined;
    const t = [...texts];
    saving = saving.then(() => st.saveAnswers(id, t));
    return saving;
  }
  onDestroy(() => {
    if (timer) void flush();
  });

  // ---- the end ----------------------------------------------------------------------------------------------------
  let busy = $state(false);
  async function done(plan: boolean) {
    if (busy) return;
    busy = true;
    await flush();
    const ok = await st.finish(id);
    busy = false;
    if (!ok) return;
    back();
    if (plan) openPlan(next, { step: true, back: again });
  }
  async function skip() {
    clearTimeout(timer);
    timer = undefined;
    if (await st.skip(id)) {
      back();
      st.ctx.ui.notify(`Итоги ${id.week} недели пропущены`, [{ label: 'Отменить', run: () => void st.ctx.edit!.undo() }]);
    }
  }
  function keys(e: KeyboardEvent) {
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      void done(true);
    }
  }

  /** One line about the time: on Friday — there is time; later — now is good too; a review made — when. */
  const when = $derived.by(() => {
    const now = st.now;
    const day = WEEKDAYS_FULL[now.getDay()];
    const hm = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (reviewed) {
      const d = stampDate(reviewed);
      return d ? `Подведены: ${WEEKDAYS_FULL[d.getDay()]}, ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}. Можно поправить` : 'Подведены. Можно поправить';
    }
    if (!canReview(id, now, st.settings.until)) return 'Займёт минут пять';
    if (keyOf(id) === keyOf(st.current) && now.getDay() === 5) return `Пятница, ${hm} — займёт минут пять; можно и в выходные или в понедельник утром`;
    return `Сегодня ${day} — подвести сейчас тоже хорошо. Займёт минут пять`;
  });
  const plural = (n: number, one: string, few: string, many: string) => (n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many);

  const nx = $derived(st.next);
  const shownFile = $derived(nx ? st.settings.file.replace(/\.org$/i, '') : st.settings.file);
  let root: HTMLDivElement | undefined = $state();
  onMount(() => root?.querySelector<HTMLTextAreaElement>('textarea')?.focus({ preventScroll: true }));
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="wk-rv" class:nx={st.next} bind:this={root} onkeydown={keys} role="region" aria-label="Итоги {id.week} недели">
  <div class="wk-rc">
    <div class="wk-rh">
      {#if nx}
        <div class="wk-rt">
          <div class="wk-rk"><div class="wk-kick">Итоги · {rangeTitle(id).replace(' – ', '–')}</div><h1>Итоги {id.week} недели</h1></div>
          <i>шаг 1 из 2 · дальше план</i>
        </div>
      {:else}
        <div class="wk-rt"><b>Итоги {id.week} недели</b><span>{rangeTitle(id)}</span><i>шаг 1 из 2 · дальше план</i></div>
      {/if}
      <div class="wk-when">{when}</div>
    </div>
    <div class="wk-rb">
      <div>
        <div class="wk-cap2">ЦЕЛИ НЕДЕЛИ</div>
        {#each goals as g, gi (refKey(g.ref))}
          {@const m = markOf(g)}
          <div class="wk-rg">
            {#if nx}<span class="wk-n" class:done={m === 'done'}>{gi + 1}</span>{/if}
            <span class="wk-rgt">{g.title}</span>
            <div class="wk-seg" role="radiogroup" aria-label="Оценка: {g.title}">
              {#each SEG as [r, label, c] (r)}
                <button role="radio" aria-checked={m === r} class:on={m === r} style:--c={c} onclick={() => mark(g, r)}>{label}</button>
              {/each}
            </div>
          </div>
        {:else}
          <div class="wk-rg dim">На эту неделю целей не было</div>
        {/each}
      </div>
      <div>
        <div class="wk-cap2">НЕДЕЛЯ В ЦИФРАХ <span>— из файлов, само</span></div>
        <div class="wk-stats">
          <div><b style:color="var(--done)">{stats.closed}</b><span>{plural(stats.closed, 'задача закрыта', 'задачи закрыты', 'задач закрыто')}</span></div>
          {#if stats.moved !== null}<div><b style:color="var(--wait)">{stats.moved}</b><span>перенесено</span></div>{/if}
          <div><b style:color="var(--todo)">{stats.overdue}</b><span>просрочено</span></div>
          <div><b>{stats.meetings}</b><span>{plural(stats.meetings, 'встреча', 'встречи', 'встреч')}</span></div>
        </div>
      </div>
      <div class="wk-qs">
        {#each st.settings.questions as q, i (i)}
          <label class="wk-q">
            <span>{q}</span>
            <textarea bind:value={texts[i]} oninput={typed} onblur={() => timer && void flush()} placeholder={HINTS[i]} rows="5" spellcheck="false"></textarea>
          </label>
        {/each}
      </div>
    </div>
    <div class="wk-rf">
      <button class="wk-skip" onclick={() => void skip()}>Пропустить эту неделю</button>
      <span class="wk-path">{shownFile} › {keyOf(id)} › Итоги</span>
      <button class="wk-btn" disabled={busy} onclick={() => void done(false)}>Только итоги</button>
      <button class="wk-btn pri" disabled={busy} onclick={() => void done(true)}>Дальше — план на {next.week} неделю ⌘↩</button>
    </div>
  </div>
</div>

<style>
  .wk-rv { height: 100%; overflow: auto; box-sizing: border-box; padding: 22px 24px; display: flex; justify-content: center; align-items: flex-start; background: var(--stage, var(--side)); color: var(--fg); font: 13px var(--ui, -apple-system, system-ui, sans-serif); }
  .wk-rv.nx { background: transparent; color: var(--ink); padding: 26px 24px 32px; }
  /* ---- the new interface (ТЗ 51 §2): the card of 880 pt, the goals and the answers in the file's text's font ---- */
  .nx .wk-rc { width: 880px; border: 1px solid var(--rule); border-radius: 14px; background: var(--card); box-shadow: none; overflow: visible; }
  .nx .wk-rh { padding: 24px 28px 0; border: 0; }
  .nx .wk-rt { align-items: flex-end; gap: 12px; }
  .nx .wk-rk { flex: 1; min-width: 0; }
  .nx .wk-kick { margin-bottom: 8px; font: 500 11px var(--font-mono, ui-monospace, monospace); letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink3); }
  .nx h1 { margin: 0; font: 400 32px/1.05 var(--font-display, Georgia, serif); color: var(--ink); }
  .nx .wk-rt i { font: 11px var(--font-mono, ui-monospace, monospace); color: var(--ink3); white-space: nowrap; }
  .nx .wk-when { margin-top: 8px; font-size: 13px; color: var(--ink2); }
  .nx .wk-rb { padding: 20px 28px; gap: 22px; }
  .nx .wk-cap2 { margin-bottom: 8px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; color: var(--ink3); }
  .nx .wk-cap2 span { font-weight: 400; color: var(--ink3); }
  .nx .wk-rg { gap: 12px; min-height: 42px; border-top: 1px solid var(--rule); }
  .nx .wk-rg.dim { color: var(--ink3); }
  .nx .wk-n { flex: 0 0 24px; width: 24px; height: 24px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: var(--chip2); color: var(--ink2); font-size: 12px; font-weight: 700; }
  .nx .wk-n.done { background: color-mix(in srgb, var(--done) 18%, transparent); color: var(--done); }
  .nx .wk-rgt { font: 600 19px/1.25 var(--font-text, Georgia, serif); color: var(--ink); }
  .nx .wk-seg { padding: 2px; gap: 2px; border-radius: 8px; background: var(--chip); }
  .nx .wk-seg button { height: 26px; padding: 0 12px; border-radius: 6px; color: var(--ink2); font-size: 12.5px; }
  .nx .wk-seg button.on { background: var(--segon); color: var(--c); font-weight: 700; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18); }
  .nx .wk-seg button:focus-visible { outline: 2px solid var(--lampline); outline-offset: 1px; }
  .nx .wk-stats { gap: 10px; }
  .nx .wk-stats > div { padding: 12px 14px; border: 0; border-radius: 10px; background: var(--chip); }
  .nx .wk-stats b { font: 400 30px/1.1 var(--font-display, Georgia, serif); }
  .nx .wk-stats b:not([style]) { color: var(--ink); }
  .nx .wk-stats span { font-size: 12px; color: var(--ink2); }
  .nx .wk-qs { gap: 12px; flex-wrap: nowrap; }
  .nx .wk-q { gap: 6px; }
  .nx .wk-q span { font-size: 12.5px; font-weight: 600; color: var(--ink); }
  .nx .wk-q textarea { min-height: 96px; height: 120px; padding: 10px 12px; border: 1px solid var(--rule); border-radius: 9px; background: var(--field); color: var(--ink); font: 500 17px/1.4 var(--font-text, Georgia, serif); }
  .nx .wk-q textarea:focus { border: 1.5px solid var(--lampline); padding: 9.5px 11.5px; }
  .nx .wk-q textarea::placeholder { font: 500 17px/1.4 var(--font-text, Georgia, serif); color: var(--ink3); }
  .nx .wk-rf { gap: 8px; padding: 16px 28px 22px; border: 0; background: none; }
  .nx .wk-skip { font-size: 12.5px; color: var(--ink3); }
  .nx .wk-skip:hover { color: var(--ink); }
  .nx .wk-path { font: 11px var(--font-mono, ui-monospace, monospace); color: var(--ink3); margin-right: 4px; }
  .nx .wk-btn { height: 30px; padding: 0 14px; border: 0; border-radius: 7px; background: var(--chip2); color: var(--ink); font-size: 13px; }
  .nx .wk-btn.pri { background: var(--lamp); color: var(--onlamp); font-weight: 600; }
  .nx .wk-btn:focus-visible { outline: 2px solid var(--lampline); outline-offset: 2px; }
  .wk-rc { width: 860px; max-width: 100%; box-sizing: border-box; display: flex; flex-direction: column; background: var(--bg); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.08); overflow: hidden; }
  .wk-rh { padding: 16px 22px 12px; border-bottom: 1px solid var(--line); }
  .wk-rt { display: flex; align-items: baseline; gap: 10px; }
  .wk-rt b { font-size: 18px; }
  .wk-rt span { color: var(--fg2); }
  .wk-rt i { margin-left: auto; font-style: normal; font-size: 12px; color: var(--fg3); }
  .wk-when { font-size: 12.5px; color: var(--fg2); margin-top: 3px; }
  .wk-rb { padding: 14px 22px; display: flex; flex-direction: column; gap: 16px; }
  .wk-cap2 { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; color: var(--fg2); margin-bottom: 6px; }
  .wk-cap2 span { font-weight: 400; letter-spacing: 0; color: var(--fg3); }
  .wk-rg { display: flex; align-items: center; gap: 12px; min-height: 38px; border-top: 1px solid var(--line); }
  .wk-rg.dim { color: var(--fg3); }
  .wk-rgt { flex: 1; min-width: 0; font-size: 13.5px; }
  .wk-seg { display: flex; padding: 2px; gap: 2px; background: var(--field); border-radius: 8px; }
  .wk-seg button { height: 24px; padding: 0 10px; border: 0; border-radius: 6px; background: transparent; color: var(--fg2); font: inherit; font-size: 12.5px; }
  .wk-seg button.on { background: var(--segon); color: var(--c); font-weight: 700; box-shadow: var(--shadow); }
  .wk-stats { display: flex; gap: 10px; }
  .wk-stats > div { flex: 1; padding: 10px 12px; border-radius: 9px; background: var(--side); border: 1px solid var(--line); }
  .wk-stats b { display: block; font-size: 20px; }
  .wk-stats span { font-size: 12px; color: var(--fg2); }
  .wk-qs { display: flex; gap: 12px; flex-wrap: wrap; }
  .wk-q { flex: 1 1 240px; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
  .wk-q span { font-size: 12.5px; font-weight: 600; }
  .wk-q textarea { height: 92px; box-sizing: border-box; padding: 8px 10px; resize: vertical; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--fg); font: 12px/1.55 var(--mono, ui-monospace, Menlo, monospace); outline: none; }
  .wk-q textarea:focus { border: 2px solid var(--acc); padding: 7px 9px; }
  .wk-q textarea::placeholder { color: var(--fg3); }
  .wk-rf { display: flex; align-items: center; gap: 8px; padding: 12px 22px; border-top: 1px solid var(--line); background: var(--bar); }
  .wk-skip { border: 0; background: none; padding: 0; font: inherit; font-size: 12px; color: var(--fg2); }
  .wk-skip:hover { color: var(--fg); text-decoration: underline; }
  .wk-path { margin-left: auto; font-size: 11.5px; color: var(--fg3); }
  .wk-btn { height: 30px; padding: 0 12px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg); color: var(--fg); font: inherit; }
  .wk-btn.pri { border: 0; padding: 0 14px; background: var(--acc); color: var(--onacc); font-weight: 600; }
</style>
