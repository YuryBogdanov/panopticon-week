<script lang="ts">
  import { week as st } from './state.svelte';
  import { keyOf, rangeTitle } from './weeks';

  // The banner of «Сегодня» (ТЗ 36 §5): the review due — the last week's in its time, this one's from Friday 12:00.
  // Gone when made or skipped, or when the reminder is off.
  let { setHidden }: { setHidden: (h: boolean) => void } = $props();
  const id = $derived(st.settings.remind ? st.due() : null);
  $effect(() => setHidden(!id));
  const review = () => id && void st.ctx.ui.open('week.view', keyOf(id) + '/review');
  async function skip() {
    if (id && (await st.skip(id))) st.ctx.ui.notify(`Итоги ${id.week} недели пропущены`, [{ label: 'Отменить', run: () => void st.ctx.edit!.undo() }]);
  }
</script>

{#if id}
  <div class="wk-ban">
    <span class="wk-mark" aria-hidden="true"></span>
    <b>Итоги {id.week} недели не подведены</b>
    <span class="wk-bd">{rangeTitle(id)} · займёт минут пять</span>
    <button class="wk-bs" onclick={() => void skip()}>Пропустить неделю</button>
    <button class="wk-bp" onclick={review}>Подвести итоги</button>
  </div>
{/if}

<style>
  .wk-ban { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font: 13px var(--ui, -apple-system, system-ui, sans-serif); color: var(--fg); }
  .wk-mark { width: 8px; height: 8px; border-radius: 2px; background: var(--purple); }
  .wk-bd { color: var(--fg2); }
  .wk-bs { margin-left: auto; border: 0; background: none; padding: 0; font: inherit; font-size: 12.5px; color: var(--fg2); }
  .wk-bs:hover { color: var(--fg); text-decoration: underline; }
  .wk-bp { height: 26px; padding: 0 12px; border: 0; border-radius: 6px; background: var(--acc); color: var(--onacc); font: inherit; font-size: 12.5px; font-weight: 600; }
</style>
