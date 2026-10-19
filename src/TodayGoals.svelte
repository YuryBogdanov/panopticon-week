<script lang="ts">
  import { onMount } from 'svelte';
  import { week as st } from './state.svelte';
  import { keyOf, rangeShort, refKey, type Goal } from './weeks';
  import { openPlan } from './plan';
  import Plug from './Plug.svelte';

  // «Цели недели» on «Сегодня» (ТЗ 36 §5): the week's goals as tiles; a goal that is a task is a task of the lists
  // (ТЗ 34): a click chooses it, the app's menu and keys act on it.
  let { setSummary }: { setSummary?: (s: { text: string; tone?: 'alert' | 'wait' } | null) => void } = $props();
  const id = $derived(st.current);
  const nx = $derived(st.next);
  const goals = $derived(st.week(id)?.goals ?? []);
  const openWeek = () => void st.ctx.ui.open('week.view', keyOf(id));
  const isDone = (g: Goal) => !!(st.taskOf(g)?.done || g.done);
  // the app's panel «Сегодня» (ТЗ 51 §4): «N из M» of the goals; no plan — «нет плана»
  $effect(() => setSummary?.(goals.length ? { text: `${goals.filter(isDone).length} из ${goals.length}` } : { text: 'нет плана', tone: 'wait' }));
  const tone = (kw: string | null, done: boolean) => (done ? 'var(--done)' : kw === 'WAIT' ? 'var(--wait)' : kw === 'NEXT' ? 'var(--next)' : 'var(--todo)');

  let root: HTMLDivElement | undefined = $state();
  let chosen = $state<string | null>(null);
  const goalOf = (k: string | null) => goals.find((g) => refKey(g.ref) === k);
  let list: { menu(at: { x: number; y: number }): void; dispose(): void } | null = null;
  onMount(() => {
    if (!root) return;
    list = st.ctx.ui.taskList(root, {
      selected: () => {
        const g = goalOf(chosen);
        const t = g && st.taskOf(g);
        return t ? { ref: t.ref } : null;
      },
      open: () => {
        const g = goalOf(chosen);
        const t = g && st.taskOf(g);
        if (t) void st.ctx.commands.run('file.open', { path: t.ref.path, line: t.ref.line });
      },
      clear: () => (chosen = null),
    });
    return () => list?.dispose();
  });
  function pick(g: Goal) {
    chosen = st.taskOf(g) ? refKey(g.ref) : null;
  }
  /** Right click on a goal that is a task: chosen, the app's menu of the task. */
  function menu(e: MouseEvent, g: Goal) {
    if (!st.taskOf(g)) return;
    e.preventDefault();
    chosen = refKey(g.ref);
    root?.focus({ preventScroll: true });
    list?.menu({ x: e.clientX, y: e.clientY });
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="wk-today" class:nx bind:this={root} tabindex="-1">
  {#if nx}
    <div class="wk-th">
      <b>Цели недели</b>
      <Plug />
      <span class="wk-sub">{id.week} неделя · {rangeShort(id)}</span>
      <button class="wk-more" onclick={openWeek}>Открыть неделю ›</button>
    </div>
  {:else}
  <div class="wk-th">
    <b>Цели недели</b>
    <span class="wk-sub">{id.week} неделя · {rangeShort(id)}</span>
    <span class="wk-plug" title="Блок плагина «Неделя»">Неделя</span>
    <button class="wk-more" onclick={openWeek}>Открыть неделю ›</button>
  </div>
  {/if}
  {#if goals.length && nx}
    <div class="wk-tiles" style:--n={goals.length > 4 ? 2 : Math.max(1, goals.length)}>
      {#each goals as g, i (refKey(g.ref))}
        {@const t = st.taskOf(g)}
        <button class="wk-tile" class:sel={chosen === refKey(g.ref)} class:task={!!t} class:done={isDone(g)} onclick={() => pick(g)} ondblclick={() => (t ? void st.ctx.commands.run('file.open', { path: t.ref.path, line: t.ref.line }) : openWeek())} oncontextmenu={(e) => menu(e, g)}>
          <span class="wk-tn" class:ok={isDone(g)}>{i + 1}</span>
          <span class="wk-tb">
            {#if t?.keyword}<span class="wk-cap" style:--c={tone(t.keyword, t.done)}>{t.keyword}</span>{/if}
            <span class="wk-tt" class:done={t?.done}>{g.title}</span>
          </span>
        </button>
      {/each}
    </div>
  {:else if goals.length}
    <div class="wk-tiles" style:--n={goals.length > 4 ? 2 : Math.max(1, goals.length)}>
      {#each goals as g, i (refKey(g.ref))}
        {@const t = st.taskOf(g)}
        <button class="wk-tile" class:sel={chosen === refKey(g.ref)} class:task={!!t} onclick={() => pick(g)} ondblclick={() => (t ? void st.ctx.commands.run('file.open', { path: t.ref.path, line: t.ref.line }) : openWeek())} oncontextmenu={(e) => menu(e, g)}>
          <span class="wk-tn">{i + 1}</span>
          {#if t?.keyword}<span class="wk-cap" style:--c={tone(t.keyword, t.done)}>{t.keyword}</span>{/if}
          <span class="wk-tt" class:done={t?.done}>{g.title}</span>
        </button>
      {/each}
    </div>
  {:else}
    <div class="wk-none">План на неделю не составлен · <button class="wk-more inline" onclick={() => openPlan(id)}>Спланировать</button></div>
  {/if}
</div>

<style>
  /* fix #294: the tiles' row by the block's own width */
  .wk-today { outline: none; container-type: inline-size; }
  .wk-th { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .wk-sub { font-size: 12px; color: var(--fg2); }
  .wk-plug { padding: 1px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; color: var(--purple); background: color-mix(in srgb, var(--purple) 14%, transparent); }
  .wk-more { margin-left: auto; border: 0; background: none; padding: 0; font: inherit; font-size: 12px; color: var(--acc); }
  .wk-more.inline { margin: 0; font-size: inherit; }
  .wk-more:hover { text-decoration: underline; }
  /* fix #294: the goals in a row of equal tiles, the titles up to 3 lines; more than 4 goals, or a block under 720 pt —
     two a row */
  .wk-tiles { display: grid; grid-template-columns: repeat(var(--n, 4), minmax(0, 1fr)); gap: 10px; padding-bottom: 4px; }
  @container (max-width: 720px) { .wk-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .wk-tile { min-width: 0; display: flex; align-items: flex-start; gap: 8px; min-height: 34px; padding: 8px 10px; border: 0; border-radius: 8px; background: var(--side); color: var(--fg); font: inherit; text-align: left; }
  .wk-tile.sel { background: var(--sel); box-shadow: inset 0 0 0 1.5px var(--acc); }
  .wk-tn { font-weight: 700; color: var(--fg3); }
  .wk-cap { padding: 1px 5px; border-radius: 4px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.02em; color: var(--c); background: color-mix(in srgb, var(--c) 16%, transparent); }
  .wk-tt { flex: 1; min-width: 0; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; overflow: hidden; overflow-wrap: anywhere; }
  .wk-tt.done { text-decoration: line-through; color: var(--fg3); }
  .wk-none { color: var(--fg2); padding: 6px 0 8px; }
  /* ---- the new interface (ТЗ 51 §4): the core's card; its head with the plugin's mark; the goals in a row ---- */
  .nx .wk-th { gap: 8px; margin-bottom: 8px; }
  .nx .wk-th b { font-size: 13.5px; font-weight: 700; color: var(--ink); }
  .nx .wk-sub { color: var(--ink3); }
  .nx .wk-more { font-size: 12px; color: var(--lampink); white-space: nowrap; }
  .nx .wk-tiles { gap: 16px; padding-bottom: 2px; }
  .nx .wk-tile { align-items: flex-start; gap: 9px; min-height: 0; padding: 10px 0 2px; border-top: 1px solid var(--rule); border-radius: 0; background: none; color: var(--ink); }
  .nx .wk-tile.done { opacity: 0.55; }
  .nx .wk-tile.sel { background: var(--lampsoft); box-shadow: none; border-radius: 6px; }
  .nx .wk-tile:focus-visible { outline: 2px solid var(--lampline); outline-offset: 2px; }
  .nx .wk-tn { flex: 0 0 24px; width: 24px; height: 24px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: var(--chip2); color: var(--ink2); font-size: 12px; font-weight: 700; }
  .nx .wk-tn.ok { background: color-mix(in srgb, var(--done) 18%, transparent); color: var(--done); }
  .wk-tb { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 3px; }
  .nx .wk-cap { display: inline-flex; align-items: center; height: 18px; padding: 0 6px; font-size: 10.5px; }
  .nx .wk-tt { font: 600 17px/1.2 var(--font-text, Georgia, serif); white-space: normal; overflow-wrap: anywhere; color: var(--ink); }
  .nx .wk-tt.done { color: var(--ink); }
  .nx .wk-tile.done .wk-tt { text-decoration: line-through; }
  .nx .wk-none { color: var(--ink2); }
</style>
