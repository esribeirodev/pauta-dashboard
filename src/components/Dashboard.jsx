import React from 'react';
import { isCreative } from '../utils';
import ContentList from './ContentList';

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>Atualizado agora</small>
    </div>
  );
}

export default function Dashboard({ items, role, user, open }) {
  const count = fn => items.filter(fn).length;

  const late = item =>
    item.due_at &&
    new Date(item.due_at) < new Date() &&
    !['done', 'archived'].includes(item.status);

  const stats = isCreative(role)
    ? [
        ['Recebidas', count(i => i.status === 'received' && i.current_assignee === user)],
        ['Em produção', count(i => i.status === 'in_production' && i.current_assignee === user)],
        ['Em aprovação', count(i => i.status === 'in_review')],
        ['Concluídas', count(i => i.status === 'done')]
      ]
    : [
        ['Demandas visíveis', items.length],
        ['Em produção', count(i => i.status === 'in_production')],
        ['Em aprovação', count(i => i.status === 'in_review')],
        ['Atrasadas', count(late)]
      ];

  return (
    <>
      <div className="stats">
        {stats.map(([label, value]) => <Stat key={label} label={label} value={value} />)}
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>{isCreative(role) ? 'Suas demandas' : 'Demandas recentes'}</h2>
        </div>
        <ContentList items={items.slice(0, 8)} open={open} />
      </section>
    </>
  );
}
