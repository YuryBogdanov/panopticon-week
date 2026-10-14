<script lang="ts">
  import { week as st } from './state.svelte';
  import { keyOf, parseKey } from './weeks';
  import WeekView from './WeekView.svelte';
  import Review from './Review.svelte';

  // The tab «Неделя»: a week («2026-W42») or its review («2026-W42/review») — the tab's state.
  let { initial, setState }: { initial: string; setState: (key: string) => void } = $props();
  // svelte-ignore state_referenced_locally
  let key = $state(initial);
  const go = (k: string) => {
    key = k;
    setState(k);
  };
  const id = $derived(parseKey(key) ?? st.current);
</script>

{#if key.endsWith('/review')}
  {#key key}
    <Review {id} back={() => go(keyOf(id))} again={() => go(keyOf(id) + '/review')} />
  {/key}
{:else}
  <WeekView {key} {go} />
{/if}
