<script lang="ts">
  import { onMount } from 'svelte';
  import { week as st } from './state.svelte';
  import { keyOf, rangeShort, refKey, type Goal } from './weeks';
  import { openPlan } from './plan';

  // «Цели недели» on «Сегодня» (ТЗ 36 §5): the week's goals as tiles; a goal that is a task is a task of the lists
  // (ТЗ 34): a click chooses it, the app's menu and keys act on it.
  const id = $derived(st.current);
  const goals = $derived(st.week(id)?.goals ?? []);
  const openWeek = () => void st.ctx.ui.open('week.view', keyOf(id));
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
<div class="wk-today" bind:this={root} tabindex="-1">
  <div class="wk-th">
    <b>Цели недели</b>
    <span class="wk-sub">{id.week} неделя · {rangeShort(id)}</span>
    <span class="wk-plug" title="Блок плагина «Неделя»">Неделя</span>
    <button class="wk-more" onclick={openWeek}>Открыть неделю ›</button>
  </div>
  {#if goals.length}
    <div class="wk-tiles">
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
  .wk-today { outline: none; }
  .wk-th { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .wk-sub { font-size: 12px; color: var(--fg2); }
  .wk-plug { padding: 1px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; color: var(--purple); background: color-mix(in srgb, var(--purple) 14%, transparent); }
  .wk-more { margin-left: auto; border: 0; background: none; padding: 0; font: inherit; font-size: 12px; color: var(--acc); }
  .wk-more.inline { margin: 0; font-size: inherit; }
  .wk-more:hover { text-decoration: underline; }
  .wk-tiles { display: flex; gap: 10px; flex-wrap: wrap; padding-bottom: 4px; }
  .wk-tile { flex: 1 1 240px; min-width: 0; display: flex; align-items: center; gap: 8px; min-height: 34px; padding: 0 10px; border: 0; border-radius: 8px; background: var(--side); color: var(--fg); font: inherit; text-align: left; }
  .wk-tile.sel { background: var(--sel); box-shadow: inset 0 0 0 1.5px var(--acc); }
  .wk-tn { font-weight: 700; color: var(--fg3); }
  .wk-cap { padding: 1px 5px; border-radius: 4px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.02em; color: var(--c); background: color-mix(in srgb, var(--c) 16%, transparent); }
  .wk-tt { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .wk-tt.done { text-decoration: line-through; color: var(--fg3); }
  .wk-none { color: var(--fg2); padding: 6px 0 8px; }
</style>
