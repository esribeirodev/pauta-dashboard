import React from 'react';
import { STATUS, PRIORITY } from '../constants';
import { dueInfo } from '../utils';

export default function StatusBadge({ item, showPriority = true }) {
  const due = dueInfo(item);

  return (
    <div className="badges">
      <span className={`status ${item.status}`}>{STATUS[item.status] || item.status}</span>
      {showPriority && item.priority && (
        <span className={`priority ${item.priority}`}>{PRIORITY[item.priority] || item.priority}</span>
      )}
      {due && <small className={`delivery ${due.cls}`}>{due.label}</small>}
    </div>
  );
}
