import React from 'react';
import ContentList from './ContentList';

export default function Approvals({ items, user, open }) {
  const queue = items.filter(
    item =>
      item.status === 'in_review' &&
      (item.current_approver ? item.current_approver === user : item.current_assignee === user)
  );

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Sua fila de aprovação final</h2>
          <p className="sub">Aprovação de duas pessoas: só conclua depois do primeiro aceite registrado.</p>
        </div>
      </div>
      <ContentList items={queue} open={open} />
    </section>
  );
}
