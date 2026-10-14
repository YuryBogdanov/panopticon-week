// The sheet «План на N неделю» (ТЗ 36 §5): drawn by the plugin over the app's dimmed window.
import { mount, unmount } from 'svelte';
import { week as st } from './state.svelte';
import type { WeekId } from './weeks';
import PlanSheet from './PlanSheet.svelte';

export function openPlan(id: WeekId, o: { step?: boolean; back?: () => void } = {}) {
  void st.ctx.ui.sheet({
    title: `План на ${id.week} неделю`,
    bare: true,
    render: (el, sheet) => {
      const app = mount(PlanSheet, { target: el, props: { id, step: !!o.step, close: () => sheet.close(), back: o.back ? () => (sheet.close(), o.back!()) : undefined } });
      return () => void unmount(app);
    },
  });
}
