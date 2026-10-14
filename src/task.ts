// «Сделать задачей…» (ТЗ 36 §3): a status (the default set's first open one), a day of the week or none; left in
// weeks.org, or made in another file with the goal's note linking it.
import { week as st } from './state.svelte';
import { daysOf, WEEKDAYS, type Goal, type WeekId } from './weeks';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function makeTaskMenu(g: Goal, id: WeekId, _anchor?: HTMLElement) {
  const days = daysOf(id);
  const v = await st.ctx.ui.form({
    title: `Задачей: ${g.title}`,
    groups: [{
      fields: [
        { type: 'choice', key: 'status', look: 'menu', label: 'Статус', options: st.statuses.open.map((s) => ({ value: s, label: s })) },
        { type: 'choice', key: 'day', look: 'menu', label: 'Запланировать', options: [{ value: '', label: 'Нет' }, ...days.map((d) => ({ value: iso(d), label: `${WEEKDAYS[d.getDay()]} ${d.getDate()}` }))] },
        { type: 'choice', key: 'where', look: 'segments', label: 'Где', options: [{ value: 'here', label: `Оставить в ${st.settings.file}` }, { value: 'move', label: 'Перенести в файл…' }] },
      ],
    }],
    submit: 'Сделать задачей',
    initial: { status: st.statuses.open[0] ?? 'TODO', day: '', where: 'here' },
  });
  if (!v) return;
  const status = String(v.status);
  const day = typeof v.day === 'string' && v.day ? new Date(+v.day.slice(0, 4), +v.day.slice(5, 7) - 1, +v.day.slice(8, 10)) : null;
  if (v.where !== 'move') return void st.makeTask(g, status, day);
  const at = await st.ctx.ui.pickPlace({ kind: 'heading', title: `Куда перенести «${g.title}»` });
  if (at) await st.makeTaskIn(g, at, status, day);
}
