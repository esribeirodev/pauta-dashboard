import React from 'react';
import { ClipboardList } from 'lucide-react';
import { local } from '../utils';
import StatusBadge from './StatusBadge';

export default function ContentList({ items, open = () => {} }) {
  if (!items.length) {
    return (
      <div className="empty">
        <ClipboardList size={30} />
        <p>Nenhuma demanda encontrada.</p>
      </div>
    );
  }

  return (
    <div className="table">
      {items.map(item => (
        <div className="row" key={item.id} onClick={() => open(item.id)}>
          <div className="title">
            <b>{item.title}</b>
            <small>{item.content_type} · prazo {local(item.due_at)}</small>
          </div>
          <span>{item.assignee?.full_name || 'Sem responsável'}</span>
          <StatusBadge item={item} />
        </div>
      ))}
    </div>
  );
}
