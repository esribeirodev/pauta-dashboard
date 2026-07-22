import React from 'react';

export default function CalendarView({ items, month, setMonth }) {
  const year = month.getFullYear();
  const currentMonth = month.getMonth();
  const daysInMonth = new Date(year, currentMonth + 1, 0).getDate();

  return (
    <section className="panel">
      <div className="calendar-toolbar">
        <button onClick={() => setMonth(new Date(year, currentMonth - 1, 1))}>‹</button>
        <h2>
          {month.toLocaleString('pt-BR', { month: 'long' })} <small>{year}</small>
        </h2>
        <button onClick={() => setMonth(new Date(year, currentMonth + 1, 1))}>›</button>
      </div>

      <div className="calendar-grid">
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const dayItems = items.filter(item => {
            if (!item.due_at) return false;
            const date = new Date(item.due_at);
            return (
              date.getDate() === day &&
              date.getMonth() === currentMonth &&
              date.getFullYear() === year
            );
          });

          return (
            <div key={day}>
              <b>{day}</b>
              {dayItems.slice(0, 3).map(item => (
                <small className="dot" key={item.id}>{item.title}</small>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
