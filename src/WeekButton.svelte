<script lang="ts">
  import { week as st } from './state.svelte';
  import { cellOf, keyOf, type WeekId } from './weeks';
  import { openPlan } from './plan';
  import { openCard } from './card';

  // The button of a week in the calendar (ТЗ 36 §6, `calendar.weekCell`): how its review stands; a click — the
  // week, its review, its plan, or the card of the week now (or of a week planned).
  let { id }: { id: WeekId } = $props();
  const cell = $derived(cellOf(st.week(id), id, st.now, st.settings.until));
  const ICON: Record<string, string> = {
    ok: 'M5 10.5l3 3 7-7',
    due: 'M10 9.5h.01',
    skip: 'M10 9.5h.01',
    now: 'M10 3.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM10 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
    planned: 'M10 3.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM10 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
    plan: 'M10 5v10M5 10h10',
  };
  const nx = $derived(st.next);
  // the new interface's marks (ТЗ 51 §5): a dot for a review to make, «+» for a week to plan
  const NX: Record<string, string> = { ...ICON, due: 'M10 10h.01', skip: 'M10 10h.01' };
  function click(e: MouseEvent) {
    e.stopPropagation();
    const k = cell.kind;
    if (k === 'now' || k === 'planned') openCard(id, e.currentTarget as HTMLElement);
    else if (k === 'plan') openPlan(id);
    else void st.ctx.ui.open('week.view', keyOf(id) + (k === 'due' ? '/review' : ''));
  }
</script>

<button class="wk-cb {cell.kind}" class:nx title={cell.tip} aria-label={cell.tip} onclick={click} ondblclick={(e) => e.stopPropagation()}>
  <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={(nx ? NX : ICON)[cell.kind]} /></svg>
</button>

<style>
  .wk-cb { width: 22px; height: 22px; box-sizing: border-box; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 6px; border: 1px solid transparent; background: transparent; color: var(--fg3); }
  .wk-cb:hover { filter: brightness(0.95); background: var(--field); }
  .wk-cb.ok { color: var(--done); background: color-mix(in srgb, var(--done) 16%, transparent); }
  .wk-cb.now, .wk-cb.planned { color: var(--purple); background: color-mix(in srgb, var(--purple) 16%, transparent); }
  .wk-cb.due, .wk-cb.plan, .wk-cb.skip { border: 1px dashed var(--line); }
  .wk-cb.due { color: var(--fg2); border-color: var(--fg3); }
  .wk-cb.skip { opacity: 0.55; }
  /* ---- the new interface (ТЗ 51 §5): 24 × 24, radius 6; the colours of the states ---- */
  .wk-cb.nx { width: 24px; height: 24px; margin-top: 4px; border: 0; border-radius: 6px; color: var(--ink3); background: transparent; }
  .wk-cb.nx:hover { filter: none; background: var(--chip); }
  .wk-cb.nx svg { width: 13px; height: 13px; }
  .wk-cb.nx.ok { color: var(--done); background: color-mix(in srgb, var(--done) 16%, transparent); }
  .wk-cb.nx.due, .wk-cb.nx.skip, .wk-cb.nx.plan { color: var(--ink3); background: transparent; border: 1.5px dashed var(--ink3); }
  .wk-cb.nx.due svg, .wk-cb.nx.skip svg { stroke-width: 5; }
  .wk-cb.nx.skip { opacity: 0.5; }
  .wk-cb.nx.now, .wk-cb.nx.planned { color: var(--plug); background: color-mix(in srgb, var(--plug) 16%, transparent); }
  .wk-cb.nx.now { box-shadow: inset 0 0 0 2px var(--plug); }
  .wk-cb.nx:focus-visible { outline: 2px solid var(--lampline); outline-offset: 1px; }
</style>
