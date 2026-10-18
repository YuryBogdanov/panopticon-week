<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { week as st, type PlanGoal } from './state.svelte';
  import { addWeeks, keyOf, rangeTitle, WEEKDAYS, type Goal, type WeekId } from './weeks';

  // «План на N неделю» (ТЗ 36 §5): what to carry from the week before, 3–5 goals, and what is on the week already.
  let { id, step, close, back }: { id: WeekId; step: boolean; close: () => void; back?: () => void } = $props();

  const prevId = $derived(addWeeks(id, -1));
  const prev = $derived(st.week(prevId));
  // the week before: the goals not reached by its review («Частично» on, «Нет» off); no review — its open ones, off
  const reviewed = $derived(!!prev?.review?.reviewed);
  // svelte-ignore state_referenced_locally
  const carry = $state(
    (st.week(id)?.goals.length ? [] : (prev?.goals ?? [])) // a plan being changed: its goals are there already
      .filter((g) => (prev?.review?.reviewed ? g.result === 'partial' || g.result === 'missed' : !g.done && g.result !== 'done'))
      .map((g) => ({ g, on: !!prev?.review?.reviewed && g.result === 'partial' })),
  );
  // svelte-ignore state_referenced_locally
  const have = st.week(id)?.goals ?? [];
  // svelte-ignore state_referenced_locally
  let fields = $state(
    [...have.map((g) => ({ title: g.title, ref: g.ref, task: false, wasTask: !!g.keyword })), ...Array.from({ length: Math.max(0, st.settings.maxGoals - have.length) }, () => ({ title: '', task: false, wasTask: false }))].slice(0, Math.max(st.settings.maxGoals, have.length)),
  );
  const room = $derived(Math.max(0, st.settings.maxGoals - carry.filter((c) => c.on).length));
  const RESULT: Record<string, [string, string]> = { partial: ['частично', 'var(--wait)'], missed: ['нет', 'var(--todo)'] };

  let inputs: HTMLInputElement[] = $state([]);
  let saveBtn: HTMLButtonElement | undefined = $state();
  onMount(() => void tick().then(() => inputs[fields.findIndex((f) => !f.title)]?.focus()));
  function key(e: KeyboardEvent, i: number) {
    if (e.key === 'Enter' && !e.metaKey && !fields[i].title.trim()) {
      e.preventDefault();
      saveBtn?.focus();
    }
  }
  let busy = $state(false);
  async function save() {
    if (busy) return;
    busy = true;
    const list: PlanGoal[] = [
      ...carry.filter((c) => c.on).map((c): PlanGoal => ({ title: c.g.title, from: { ref: c.g.ref, note: st.note(c.g) } })),
      ...fields.filter((f) => f.title.trim() || f.ref).map((f): PlanGoal => ({ title: f.title, ...(f.ref ? { ref: f.ref } : {}), task: f.task })),
    ].filter((g) => g.title.trim());
    const ok = await st.savePlan(id, list);
    busy = false;
    if (ok) {
      close();
      st.ctx.ui.notify(`План на ${id.week} неделю сохранён`, [{ label: 'Отменить', run: () => void st.ctx.edit!.undo() }]);
    }
  }
  function keys(e: KeyboardEvent) {
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      void save();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }
  const ahead = $derived(st.days(id));
  // «ЦЕЛИ КВАРТАЛА — для ориентира»: my active goals, when «Цели квартала» is on and gives them (API 1.8)
  let quarter = $state<{ title: string }[]>([]);
  onMount(() => void st.ctx.plugins.call<{ title: string }[]>('quarter-goals', 'myActiveGoals').then((l) => (quarter = Array.isArray(l) ? l : [])));
  const load = (n: number) => `${Math.min(100, Math.round((n / 8) * 100))}%`;
  const carriedTitle = (g: Goal) => carry.some((c) => c.on && c.g.title === g.title);
  // the new interface (ТЗ 51 §3): the sheet of ТЗ 44, 860 pt; the goals in the file's text's font
  const nx = $derived(st.next);
  const shownFile = $derived(nx ? st.settings.file.replace(/\.org$/i, '') : st.settings.file);
  const dayOf = (d: Date) => (nx ? `${WEEKDAYS[d.getDay()]} ${d.getDate()}` : WEEKDAYS[d.getDay()]);
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="wk-sheet" class:nx role="dialog" aria-label="План на {id.week} неделю" tabindex="-1" onkeydown={keys}>
  <div class="wk-sh">
    <b>План на {id.week} неделю</b>
    <span>{rangeTitle(id)}{step ? ' · шаг 2 из 2' : ''}</span>
  </div>
  <div class="wk-sb">
    <div class="wk-left">
      {#if carry.length}
        <div>
          <div class="wk-cap2">ПЕРЕНЕСТИ С {prevId.week} НЕДЕЛИ <span>— {reviewed ? 'не достигнуты по итогам' : 'не выполнены'}</span></div>
          {#each carry as c (c.g.ref.line)}
            <label class="wk-crow">
              <input type="checkbox" bind:checked={c.on} />
              <span class="wk-ct">{c.g.title}</span>
              {#if c.g.result && RESULT[c.g.result]}<span class="wk-cr" style:color={RESULT[c.g.result][1]} style:--c={RESULT[c.g.result][1]}>{nx ? RESULT[c.g.result][0].toUpperCase() : RESULT[c.g.result][0]}</span>{/if}
            </label>
          {/each}
        </div>
      {/if}
      <div>
        <div class="wk-cap2">ЦЕЛИ НЕДЕЛИ <span>— 3–{st.settings.maxGoals} ориентиров</span></div>
        {#each carry.filter((c) => c.on) as c, i (c.g.ref.line)}
          <div class="wk-field carried">{#if !nx}<span class="wk-fn">{i + 1}</span>{/if}<span class="wk-ft">{c.g.title}</span><span class="wk-from">с {prevId.week} недели</span></div>
        {/each}
        {#each fields.slice(0, Math.max(have.length, room)) as f, i (i)}
          <div class="wk-field">
            {#if !nx}<span class="wk-fn">{carry.filter((c) => c.on).length + i + 1}</span>{/if}
            <input bind:this={inputs[i]} bind:value={f.title} onkeydown={(e) => key(e, i)} placeholder={i === 0 ? 'Главная цель недели' : nx ? 'Ещё цель — Tab' : 'Ещё цель… (Tab — следующая)'} aria-label="Цель {i + 1}" spellcheck="false" />
            {#if f.title.trim() && !f.wasTask && !carriedTitle({ title: f.title } as Goal)}
              <label class="wk-task"><input type="checkbox" bind:checked={f.task} /> задачей</label>
            {/if}
          </div>
        {/each}
      </div>
    </div>
    <div class="wk-right">
      <div class="wk-cap2">УЖЕ НА НЕДЕЛЕ</div>
      {#each ahead as d (+d.date)}
        <div class="wk-arow">
          <span class="wk-ad">{dayOf(d.date)}</span>
          <span class="wk-bar"><span style:width={load(d.meetings.length)}></span></span>
          <span class="wk-at" class:red={d.deadlines.length > 0}>
            {[d.meetings.length ? `${d.meetings.length} ${d.meetings.length === 1 ? 'встреча' : d.meetings.length < 5 ? 'встречи' : 'встреч'}` : '', ...d.deadlines.slice(0, 1).map((t) => (nx ? `⚑ ${t}` : `дедлайн: ${t}`))].filter(Boolean).join(nx ? ' · ' : ', ') || '—'}
          </span>
        </div>
      {/each}
      {#if quarter.length}
        <div class="wk-quarter" aria-label="Цели квартала">
          <div class="wk-cap2">ЦЕЛИ КВАРТАЛА <span>— для ориентира</span></div>
          {#each quarter as q, i (i)}
            <div class="wk-qg"><span class="wk-act">ACTIVE</span><span>{q.title}</span></div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
  <div class="wk-sf">
    <span class="wk-path">Запишется в <code>{shownFile} › {keyOf(id)} › Цели</code></span>
    {#if back}<button class="wk-btn" onclick={back}>Назад к итогам</button>{:else}<button class="wk-btn" onclick={close}>Отмена</button>{/if}
    <button class="wk-btn pri" bind:this={saveBtn} disabled={busy} onclick={() => void save()}>Сохранить план ⌘↩</button>
  </div>
</div>

<style>
  .wk-sheet { width: 980px; max-width: calc(100vw - 48px); box-sizing: border-box; display: flex; flex-direction: column; background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5); overflow: hidden; font: 13px var(--ui, -apple-system, system-ui, sans-serif); outline: none; }
  .wk-sh { display: flex; flex-direction: column; justify-content: center; height: 54px; padding: 0 20px; background: var(--bar); border-bottom: 1px solid var(--line); line-height: 1.25; }
  .wk-sh b { font-size: 15px; }
  .wk-sh span { font-size: 11.5px; color: var(--fg2); }
  .wk-sb { display: flex; }
  .wk-left { flex: 1.4; min-width: 0; padding: 14px 20px; display: flex; flex-direction: column; gap: 14px; border-right: 1px solid var(--line); }
  .wk-right { flex: 1; min-width: 0; padding: 14px 20px; background: var(--side); }
  .wk-cap2 { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; color: var(--fg2); margin-bottom: 6px; }
  .wk-cap2 span { font-weight: 400; letter-spacing: 0; color: var(--fg3); }
  .wk-crow { display: flex; align-items: center; gap: 10px; min-height: 32px; border-top: 1px solid var(--line); }
  .wk-crow input { width: 15px; height: 15px; margin: 0; accent-color: var(--acc); }
  .wk-ct { flex: 1; }
  .wk-cr { font-size: 12px; }
  .wk-field { display: flex; align-items: center; gap: 10px; height: 36px; margin-bottom: 6px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); }
  .wk-field:focus-within { border: 2px solid var(--acc); padding: 0 9px; }
  .wk-field.carried { background: var(--side); }
  .wk-fn { color: var(--fg3); font-weight: 700; }
  .wk-field input:not([type]) { flex: 1; min-width: 0; border: 0; outline: none; background: none; font: inherit; color: var(--fg); }
  .wk-ft { flex: 1; }
  .wk-from { font-size: 11px; color: var(--fg3); }
  .wk-task { display: flex; align-items: center; gap: 4px; font-size: 11.5px; color: var(--fg3); white-space: nowrap; }
  .wk-task input { margin: 0; accent-color: var(--acc); }
  .wk-arow { display: flex; align-items: center; gap: 8px; min-height: 26px; font-size: 12.5px; }
  .wk-ad { flex: 0 0 28px; color: var(--fg2); }
  .wk-bar { flex: 0 0 60px; height: 6px; border-radius: 3px; background: var(--field); overflow: hidden; }
  .wk-bar span { display: block; height: 6px; background: var(--acc); }
  .wk-at { flex: 1; min-width: 0; color: var(--fg2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .wk-at.red { color: var(--todo); }
  .wk-quarter { margin-top: 16px; display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; }
  .wk-quarter .wk-cap2 { margin-bottom: 0; }
  .wk-qg { display: flex; align-items: baseline; gap: 6px; }
  .wk-act { padding: 1px 5px; border-radius: 4px; font-size: 10.5px; font-weight: 700; color: var(--next); background: color-mix(in srgb, var(--next) 16%, transparent); }
  .wk-sf { display: flex; align-items: center; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--line); }
  .wk-path { margin-right: auto; font-size: 11.5px; color: var(--fg2); }
  .wk-path code { font: 11.5px var(--mono, ui-monospace, Menlo, monospace); }
  .wk-btn { height: 28px; padding: 0 12px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg); color: var(--fg); font: inherit; }
  .wk-btn.pri { border: 0; padding: 0 14px; background: var(--acc); color: var(--onacc); font-weight: 600; }

  /* ---- the new interface (ТЗ 51 §3): the sheet of ТЗ 44 from under the toolbar, 860 pt ---- */
  .wk-sheet.nx { position: fixed; left: 50%; top: 52px; transform: translateX(-50%); width: 860px; max-width: calc(100vw - 32px); max-height: calc(100vh - 80px); overflow: auto; border: 1px solid var(--rule); border-top: 0; border-radius: 0 0 14px 14px; background: var(--card); color: var(--ink); box-shadow: var(--popshadow); }
  .nx .wk-sh { height: auto; padding: 22px 24px 14px; background: none; border: 0; }
  .nx .wk-sh b { font: 400 26px/1.05 var(--font-display, Georgia, serif); }
  .nx .wk-sh span { margin-top: 5px; font-size: 12.5px; color: var(--ink3); }
  .nx .wk-sb { gap: 20px; padding: 0 24px; }
  .nx .wk-left { padding: 0; border: 0; gap: 18px; }
  .nx .wk-right { flex: 0 0 300px; box-sizing: border-box; align-self: flex-start; padding: 14px 16px; border-radius: 10px; background: var(--side); }
  .nx .wk-cap2 { margin-bottom: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; color: var(--ink3); }
  .nx .wk-cap2 span { font-weight: 400; color: var(--ink3); }
  .nx .wk-crow { gap: 10px; min-height: 36px; border-top: 1px solid var(--rule); }
  .nx .wk-crow input { width: 15px; height: 15px; accent-color: var(--lamp); }
  .nx .wk-ct { font: 600 18px/1.25 var(--font-text, Georgia, serif); color: var(--ink); }
  .nx .wk-cr { display: inline-flex; align-items: center; height: 18px; padding: 0 6px; border-radius: 4px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.02em; background: color-mix(in srgb, var(--c) 16%, transparent); }
  .nx .wk-field { height: 40px; gap: 10px; margin-bottom: 6px; padding: 0 10px; border: 0; border-radius: 8px; background: var(--field); box-shadow: inset 0 0 0 1px var(--rule); }
  .nx .wk-field:focus-within { border: 0; padding: 0 10px; box-shadow: inset 0 0 0 1.5px var(--lampline); }
  .nx .wk-field.carried { background: var(--field); }
  .nx .wk-field input:not([type]), .nx .wk-ft { font: 600 18px var(--font-text, Georgia, serif); color: var(--ink); }
  .nx .wk-field input:not([type])::placeholder { font-weight: 400; color: var(--ink3); }
  .nx .wk-from { display: inline-flex; align-items: center; height: 20px; padding: 0 7px; border-radius: 5px; background: var(--chip); color: var(--ink2); font-size: 11px; white-space: nowrap; }
  .nx .wk-task { font-size: 11.5px; color: var(--ink3); }
  .nx .wk-task input { accent-color: var(--lamp); }
  .nx .wk-arow { gap: 8px; min-height: 28px; font-size: 12px; }
  .nx .wk-ad { flex: 0 0 40px; font: 11px var(--font-mono, ui-monospace, monospace); color: var(--ink3); }
  .nx .wk-bar { height: 5px; border-radius: 3px; background: var(--track); }
  .nx .wk-bar span { height: 5px; background: var(--lamp); }
  .nx .wk-at { color: var(--ink); }
  .nx .wk-at.red { color: var(--todo); }
  .nx .wk-quarter { gap: 0; margin-top: 16px; }
  .nx .wk-quarter .wk-cap2 { margin-bottom: 6px; }
  .nx .wk-qg { align-items: center; gap: 8px; min-height: 28px; }
  .nx .wk-act { display: inline-flex; align-items: center; height: 18px; padding: 0 6px; font-size: 10.5px; }
  .nx .wk-sf { gap: 8px; padding: 18px 24px 20px; border: 0; }
  .nx .wk-path { font-size: 11px; color: var(--ink3); }
  .nx .wk-path code { font: 11px var(--font-mono, ui-monospace, monospace); }
  .nx .wk-btn { height: 30px; padding: 0 14px; border: 0; border-radius: 7px; background: var(--chip2); color: var(--ink); font-size: 13px; }
  .nx .wk-btn.pri { background: var(--lamp); color: var(--onlamp); font-weight: 600; }
  .nx .wk-btn:focus-visible { outline: 2px solid var(--lampline); outline-offset: 2px; }
</style>
