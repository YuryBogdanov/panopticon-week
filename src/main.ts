// The plugin «Неделя» (ТЗ 36): the plan and the review of a week. An outside plugin: it sees the app only through
// `ctx` (API 1.7) and keeps everything in weeks.org, an ordinary Org file.
import { definePlugin } from '@panopticon/api';
import { mount, unmount } from 'svelte';
import { week } from './state.svelte';
import { isoWeek, keyOf, parseKey } from './weeks';
import Tab from './Tab.svelte';
import TodayGoals from './TodayGoals.svelte';
import TodayBanner from './TodayBanner.svelte';
import WeekButton from './WeekButton.svelte';
import { openPlan } from './plan';

type Summary = { text: string; tone?: 'alert' | 'wait' } | null;

export default definePlugin({
  activate(ctx) {
    week.init(ctx);

    // the tab «Неделя»: its state is the week's key
    ctx.ui.view<string>('week.view', {
      title: (k) => (k.endsWith('/review') ? 'Итоги недели' : 'Неделя'),
      crumbs: (k) => ['Неделя', `${k.endsWith('/review') ? 'Итоги ' : ''}${(parseKey(k) ?? isoWeek(new Date())).week} ${k.endsWith('/review') ? 'недели' : 'неделя'}`],
      restore: (raw) => (typeof raw === 'string' && parseKey(raw) ? raw : keyOf(isoWeek(new Date()))),
      render: (el, state, tab) => {
        const app = mount(Tab, { target: el, props: { initial: state, setState: (k: string) => tab.setState(k) } });
        return () => void unmount(app);
      },
    });
    ctx.commands.on('week.open', () => void ctx.ui.open('week.view', keyOf(isoWeek(new Date()))));
    ctx.commands.on('week.plan', () => openPlan(isoWeek(new Date())));
    // the review due now (the last week's, or this one's from Friday), else this week's
    ctx.commands.on('week.review', () => void ctx.ui.open('week.view', keyOf(week.due() ?? isoWeek(new Date())) + '/review'));

    // the buttons of the weeks in the calendar (its place `calendar.weekCell`, API 1.8)
    ctx.ui.slot<{ year: number; week: number }>('calendar.weekCell', (el, d) => {
      const app = mount(WeekButton, { target: el, props: { id: { year: d.year, week: d.week } } });
      return () => void unmount(app);
    });
    ctx.ui.todayBlock('week.banner', (el, block) => {
      // the summary for the app's panel «Сегодня» (API 1.15; none in an older app)
      const app = mount(TodayBanner, { target: el, props: { setHidden: (h: boolean) => block.setHidden(h), setSummary: (s: Summary) => block.setSummary?.(s) } });
      return () => void unmount(app);
    });
    ctx.ui.todayBlock('week.goals', (el, block) => {
      const app = mount(TodayGoals, { target: el, props: { setSummary: (s: Summary) => block.setSummary?.(s) } });
      return () => void unmount(app);
    });
  },
});
