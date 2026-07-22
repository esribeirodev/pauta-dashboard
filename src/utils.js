import { MANAGERS, CREATIVES } from './constants';

export const isManager = role => MANAGERS.includes(role);
export const isCreative = role => CREATIVES.includes(role);

/* Aceita qualquer URL http(s) — Drive, WeTransfer, Dropbox, etc. */
export const isValidUrl = url => /^https?:\/\/\S+\.\S+/i.test(url || '');

export const local = iso =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : '—';

const startOfDay = value => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

export function dueInfo(item) {
  if (!item?.due_at) return null;

  const due = new Date(item.due_at);

  if (['done', 'archived'].includes(item.status)) {
    if (!item.completed_at) return null;
    const lateDone = new Date(item.completed_at) > due;
    return {
      label: lateDone ? 'Entregue atrasado' : 'Entregue no prazo',
      cls: lateDone ? 'late' : 'on-time'
    };
  }

  const days = Math.floor((startOfDay(due) - startOfDay(new Date())) / 86400000);

  if (days < 0) {
    const n = Math.abs(days);
    return { label: `Atrasado (${n} ${n === 1 ? 'dia' : 'dias'})`, cls: 'late' };
  }
  if (days === 0) return { label: 'Vence hoje', cls: 'warn' };
  if (days === 1) return { label: '1 dia restante', cls: 'warn' };
  return { label: `No prazo (${days} dias)`, cls: 'on-time' };
}
