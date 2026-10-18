<script lang="ts">
  import { week as st } from './state.svelte';
  import { canReview, keyOf, phase, rangeTitle, refKey, type WeekId } from './weeks';
  import Plug from './Plug.svelte';

  // The card of the week now (or of one planned ahead): its goals, «Открыть неделю», the review from Friday 12:00.
  let { id, close }: { id: WeekId; close: () => void } = $props();
  const goals = $derived(st.week(id)?.goals ?? []);
  const done = $derived(goals.filter((g) => st.taskOf(g)?.done || g.done).length);
  const now = $derived(phase(id, st.now) === 'current');
  const open = $derived(canReview(id, st.now, st.settings.until));
  const reviewed = $derived(!!st.week(id)?.review?.reviewed);
  const DONE = ['', 'одна уже выполнена', 'две уже выполнены', 'три уже выполнены', 'четыре уже выполнены'];
  const nx = $derived(st.next);
  const go = (review: boolean) => {
    close();
    void st.ctx.ui.open('week.view', keyOf(id) + (review ? '/review' : ''));
  };
</script>

<div class="wk-card" class:nx role="dialog" aria-label="{id.week} неделя">
  <div class="wk-ch">
    {#if nx}<Plug />{:else}<span class="wk-mark" aria-hidden="true"></span>{/if}
    <b>{id.week} неделя</b>
    <span>{rangeTitle(id).replace(' – ', '–')}{now ? ' · сейчас' : ''}</span>
  </div>
  <div class="wk-cs">
    {#if goals.length}Цели: {goals.length}{done ? ` · ${DONE[done] ?? `${done} уже выполнено`}` : ''}{:else}Целей пока нет{/if}
  </div>
  {#if goals.length}
    <div class="wk-cl">
      {#each goals as g, i (refKey(g.ref))}
        {#if nx}
          <span class="wk-cg" class:done={st.taskOf(g)?.done || g.done}><i>{i + 1}</i><span>{g.title}</span></span>
        {:else}
          <span class:done={st.taskOf(g)?.done || g.done}>{i + 1}. {g.title}</span>
        {/if}
      {/each}
    </div>
  {/if}
  <div class="wk-cbtn">
    <button class="pri" onclick={() => go(false)}>Открыть неделю</button>
    {#if now}
      {#if reviewed}
        <button onclick={() => go(true)}>Итоги…</button>
      {:else}
        <button disabled={!open} onclick={() => go(true)}>{open ? 'Подвести итоги' : 'Итоги с пятницы'}</button>
      {/if}
    {/if}
  </div>
</div>

<style>
  .wk-card { width: 320px; box-sizing: border-box; display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22); font: 12.5px var(--ui, -apple-system, system-ui, sans-serif); text-align: left; }
  .wk-ch { display: flex; align-items: center; gap: 8px; }
  .wk-ch span:last-child { color: var(--fg2); }
  .wk-mark { width: 8px; height: 8px; border-radius: 2px; background: var(--purple); }
  .wk-cs { color: var(--fg2); }
  .wk-cl { display: flex; flex-direction: column; gap: 3px; }
  .wk-cl .done { color: var(--fg3); text-decoration: line-through; }
  .wk-cbtn { display: flex; gap: 8px; margin-top: 4px; white-space: nowrap; }
  .wk-cbtn button { height: 26px; padding: 0 12px; border: 0; border-radius: 6px; background: var(--field); color: var(--fg); font: inherit; }
  .wk-cbtn button.pri { background: var(--acc); color: var(--onacc); font-weight: 600; }
  .wk-cbtn button:disabled { color: var(--fg2); }
  /* ---- the new interface (ТЗ 51 §5): the popover of ТЗ 44, 320 pt ---- */
  .wk-card.nx { gap: 8px; padding: 14px 16px; border: 1px solid var(--rule); border-radius: 12px; background: var(--card); color: var(--ink); box-shadow: var(--popshadow); }
  .nx .wk-ch b { font-size: 13.5px; font-weight: 700; }
  .nx .wk-ch span:last-child { font-size: 12px; color: var(--ink3); }
  .nx .wk-cs { font-size: 12.5px; color: var(--ink2); }
  .nx .wk-cl { gap: 0; }
  .wk-cg { display: flex; align-items: center; gap: 8px; height: 26px; min-width: 0; }
  .wk-cg i { flex: 0 0 18px; width: 18px; height: 18px; border-radius: 9px; display: flex; align-items: center; justify-content: center; background: var(--chip2); color: var(--ink2); font: 700 10.5px var(--ui, -apple-system, system-ui, sans-serif); }
  .wk-cg span { min-width: 0; font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .nx .wk-cl .wk-cg.done { opacity: 0.55; color: var(--ink); text-decoration: none; }
  .nx .wk-cl .wk-cg.done span { text-decoration: line-through; }
  .nx .wk-cbtn { gap: 8px; margin-top: 6px; }
  .nx .wk-cbtn button { flex: 1; height: 28px; border-radius: 7px; background: var(--chip2); color: var(--ink); font-size: 12.5px; }
  .nx .wk-cbtn button.pri { background: var(--lamp); color: var(--onlamp); }
  .nx .wk-cbtn button:disabled { color: var(--ink3); }
  .nx .wk-cbtn button:focus-visible { outline: 2px solid var(--lampline); outline-offset: 2px; }
</style>
