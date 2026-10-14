<script lang="ts">
  import { week as st } from './state.svelte';
  import { canReview, keyOf, phase, rangeTitle, refKey, type WeekId } from './weeks';

  // The card of the week now (or of one planned ahead): its goals, «Открыть неделю», the review from Friday 12:00.
  let { id, close }: { id: WeekId; close: () => void } = $props();
  const goals = $derived(st.week(id)?.goals ?? []);
  const done = $derived(goals.filter((g) => st.taskOf(g)?.done || g.done).length);
  const now = $derived(phase(id, st.now) === 'current');
  const open = $derived(canReview(id, st.now, st.settings.until));
  const reviewed = $derived(!!st.week(id)?.review?.reviewed);
  const DONE = ['', 'одна уже выполнена', 'две уже выполнены', 'три уже выполнены', 'четыре уже выполнены'];
  const go = (review: boolean) => {
    close();
    void st.ctx.ui.open('week.view', keyOf(id) + (review ? '/review' : ''));
  };
</script>

<div class="wk-card" role="dialog" aria-label="{id.week} неделя">
  <div class="wk-ch">
    <span class="wk-mark" aria-hidden="true"></span>
    <b>{id.week} неделя</b>
    <span>{rangeTitle(id).replace(' – ', '–')}{now ? ' · сейчас' : ''}</span>
  </div>
  <div class="wk-cs">
    {#if goals.length}Цели: {goals.length}{done ? ` · ${DONE[done] ?? `${done} уже выполнено`}` : ''}{:else}Целей пока нет{/if}
  </div>
  {#if goals.length}
    <div class="wk-cl">
      {#each goals as g, i (refKey(g.ref))}
        <span class:done={st.taskOf(g)?.done || g.done}>{i + 1}. {g.title}</span>
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
</style>
