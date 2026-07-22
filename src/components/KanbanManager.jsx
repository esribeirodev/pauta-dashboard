import React from 'react';
import StatusBadge from './StatusBadge';

const COLUMNS = [
  ['received', 'Recebidas'],
  ['in_production', 'Em produção'],
  ['in_review', 'Em aprovação']
];

export default function KanbanManager({ items, open }) {
  return (
    <div className="columns">
      {COLUMNS.map(([status, label]) => {
        const list = items.filter(item => item.status === status);
        return (
          <section className="kanban" key={status}>
            <h2>{label}<span>{list.length}</span></h2>
            {list.map(item => (
              <article key={item.id} onClick={() => open(item.id)}>
                <b>{item.title}</b>
                <small>
                  {item.content_type} · {item.assignee?.full_name || 'Sem responsável'}
                </small>
                <StatusBadge item={item} />
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}
