// The plugin «Неделя» (ТЗ 36): the plan and the review of a week. An outside plugin: it sees the app only through
// `ctx` (API 1.7) and keeps everything in weeks.org, an ordinary Org file.
import { definePlugin } from '@panopticon/api';
import { mount, unmount } from 'svelte';
import { week } from './state.svelte';
import { isoWeek, keyOf, parseKey } from './weeks';
import WeekView from './WeekView.svelte';
import TodayGoals from './TodayGoals.svelte';
import { openPlan } from './plan';

export default definePlugin({
  activate(ctx) {
    week.init(ctx);

    // the tab «Неделя»: its state is the week's key
    ctx.ui.view<string>('week.view', {
      title: () => 'Неделя',
      crumbs: (k) => ['Неделя', `${(parseKey(k) ?? isoWeek(new Date())).week} неделя`],
      restore: (raw) => (typeof raw === 'string' && parseKey(raw) ? raw : keyOf(isoWeek(new Date()))),
      render: (el, state, tab) => {
        const app = mount(WeekView, { target: el, props: { initial: state, setState: (k: string) => tab.setState(k) } });
        return () => void unmount(app);
      },
    });
    ctx.commands.on('week.open', () => void ctx.ui.open('week.view', keyOf(isoWeek(new Date()))));
    ctx.commands.on('week.plan', () => openPlan(isoWeek(new Date())));

    ctx.ui.todayBlock('week.goals', (el) => {
      const app = mount(TodayGoals, { target: el });
      return () => void unmount(app);
    });
  },
});
