<script lang="ts">
  import { week as st } from './state.svelte';
  import { cmpWeek, keyOf, rangeTitle } from './weeks';

  // The banner of «Сегодня» (ТЗ 36 §5): the review due — the last week's in its time, this one's from Friday 12:00.
  // Gone when made or skipped, or when the reminder is off.
  let { setHidden, setSummary }: { setHidden: (h: boolean) => void; setSummary?: (s: { text: string; tone?: 'alert' | 'wait' } | null) => void } = $props();
  const id = $derived(st.settings.remind ? st.due() : null);
  $effect(() => setHidden(!id));
  // the app's panel «Сегодня» (ТЗ 51 §4): this week's from Friday — «можно»; the last week's — till the day it may wait
  const UNTIL = ['', 'до пн', 'до вт', 'до ср', 'до чт'];
  $effect(() => setSummary?.(id ? (cmpWeek(id, st.current) === 0 ? { text: 'можно', tone: 'alert' } : { text: UNTIL[st.settings.until] ?? 'можно', tone: 'alert' }) : null));
  const nx = $derived(st.next);
  const review = () => id && void st.ctx.ui.open('week.view', keyOf(id) + '/review');
  async function skip() {
    // the week kept: once skipped the banner has none (`id` is null after the write)
    const w = id;
    if (w && (await st.skip(w))) st.ctx.ui.notify(`Итоги ${w.week} недели пропущены`, [{ label: 'Отменить', run: () => void st.ctx.edit!.undo() }]);
  }
</script>

{#if id && nx}
  <div class="wk-ban nx">
    <svg class="wk-ic" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h14v13H3zM3 8h14M7 2.5v3M13 2.5v3M7 12l2 2 4-4" /></svg>
    <b>Итоги {id.week} недели — можно подвести</b>
    <span class="wk-bd">{rangeTitle(id).replace(' – ', '–')} · займёт минут пять</span>
    <button class="wk-bs" onclick={() => void skip()}>Пропустить неделю</button>
    <button class="wk-bp" onclick={review}>Подвести итоги</button>
  </div>
{:else if id}
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
  /* the new interface (ТЗ 51 §4): its own ground over the core's card — `plug` 8% on `card`, a frame of 30% `plug` */
  .wk-ban.nx { margin: -13px -17px -9px; padding: 12px 16px; border-radius: 12px; background: color-mix(in srgb, var(--plug) 8%, var(--card)); border: 1px solid color-mix(in srgb, var(--plug) 30%, var(--rule)); color: var(--ink); }
  .nx .wk-ic { flex: 0 0 16px; color: var(--plug); }
  .nx b { font-size: 13.5px; font-weight: 700; }
  .nx .wk-bd { font-size: 12.5px; color: var(--ink3); }
  .nx .wk-bs { color: var(--ink3); }
  .nx .wk-bs:hover { color: var(--ink); }
  .nx .wk-bp { height: 28px; padding: 0 14px; border-radius: 7px; background: var(--lamp); color: var(--onlamp); }
  .nx .wk-bp:focus-visible, .nx .wk-bs:focus-visible { outline: 2px solid var(--lampline); outline-offset: 2px; }
</style>
