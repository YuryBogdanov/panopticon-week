<script lang="ts">
  import { week as st } from './state.svelte';
  import { keyOf, parseKey } from './weeks';
  import WeekView from './WeekView.svelte';
  import Review from './Review.svelte';

  // The tab «Неделя»: a week («2026-W42») or its review («2026-W42/review») — the tab's state. In the new interface
  // (ТЗ 51 §0) on `bg` with the grid of 24 pt, as the app's screens.
  let { initial, setState }: { initial: string; setState: (key: string) => void } = $props();
  // svelte-ignore state_referenced_locally
  let key = $state(initial);
  const go = (k: string) => {
    key = k;
    setState(k);
  };
  const id = $derived(parseKey(key) ?? st.current);
</script>

<div class="wk-tab" class:nx={st.next}>
{#if key.endsWith('/review')}
  {#key key}
    <Review {id} back={() => go(keyOf(id))} again={() => go(keyOf(id) + '/review')} />
  {/key}
{:else}
  <WeekView {key} {go} />
{/if}
</div>

<style>
  .wk-tab { height: 100%; min-height: 0; display: flex; flex-direction: column; }
  .wk-tab > :global(*) { flex: 1; min-height: 0; }
  .wk-tab.nx { background-color: var(--bg); background-image: linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px); background-size: 24px 24px; background-position: -1px -1px; color: var(--ink); font-family: var(--ui, -apple-system, system-ui, sans-serif); }
</style>
