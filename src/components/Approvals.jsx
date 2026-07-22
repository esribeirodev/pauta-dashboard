import React from 'react';
import ContentList from './ContentList';

export default function Approvals({ items, user, open }) {
  const queue = items.filter(
    item => item.status === 'in_review' && item.current_assignee === user
  );

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Sua fila de aprovação</h2>
      </div>
      <ContentList items={queue} open={open} />
    </section>
  );
}
