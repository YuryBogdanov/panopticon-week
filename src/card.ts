// The card of a week over the calendar (ТЗ 36 §6): 320 pt to the right of its button; ⎋ or a click aside closes it.
import { mount, unmount } from 'svelte';
import type { WeekId } from './weeks';
import WeekCard from './WeekCard.svelte';

let open: (() => void) | null = null;

export function openCard(id: WeekId, at: HTMLElement) {
  const here = !!open && !!at.dataset.cardOpen; // a second click on its button closes it
  closeCard();
  if (here) return;
  const r = at.getBoundingClientRect();
  const host = document.createElement('div');
  host.className = 'wk-pop';
  host.style.cssText = `position:fixed;z-index:60;left:${Math.round(r.right + 8)}px;top:${Math.round(r.top - 4)}px`;
  document.body.append(host);
  const app = mount(WeekCard, { target: host, props: { id, close: () => closeCard() } });
  // kept on the screen: moved up (and left) when it would leave it
  const b = host.getBoundingClientRect();
  if (b.bottom > innerHeight - 8) host.style.top = `${Math.max(8, innerHeight - 8 - b.height)}px`;
  if (b.right > innerWidth - 8) host.style.left = `${Math.max(8, r.left - 8 - b.width)}px`;
  at.dataset.cardOpen = '1';
  const away = (e: MouseEvent) => {
    if (!host.contains(e.target as Node) && e.target !== at && !at.contains(e.target as Node)) closeCard();
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeCard();
    }
  };
  setTimeout(() => document.addEventListener('mousedown', away, true));
  document.addEventListener('keydown', key, true);
  open = () => {
    document.removeEventListener('mousedown', away, true);
    document.removeEventListener('keydown', key, true);
    delete at.dataset.cardOpen;
    void unmount(app);
    host.remove();
  };
}
export function closeCard() {
  const o = open;
  open = null;
  o?.();
}
