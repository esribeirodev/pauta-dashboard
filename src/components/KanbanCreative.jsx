import React from 'react';
import StatusBadge from './StatusBadge';

export default function KanbanCreative({ items, user, open }) {
  const columns = [
    ['received', 'Demandas recebidas',
      item => item.status === 'received' && item.current_assignee === user],
    ['in_production', 'Em produção',
      item => item.status === 'in_production' && item.current_assignee === user],
    ['in_review', 'Em aprovação',
      item => item.status === 'in_review']
  ];

  return (
    <div className="columns">
      {columns.map(([key, label, filter]) => {
        const list = items.filter(filter);
        return (
          <section className="kanban" key={key}>
            <h2>{label}<span>{list.length}</span></h2>
            {list.map(item => (
              <article key={item.id} onClick={() => open(item.id)}>
                <b>{item.title}</b>
                <small>
                  {item.content_type} · por {item.creator?.full_name || '—'}
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
