import React, { useState, useEffect, useRef } from 'react';

export default function ChatSidebar({ messages, onSend, onClose, currentUser }) {
  const [text, setText] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const submit = e => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <div className="chat-sidebar">
      <header className="chat-header">
        <h2>Chat</h2>
        <button onClick={onClose}>✕</button>
      </header>

      <ul className="chat-list">
        {messages.map((m, i) => {
          const mine = m.user === currentUser;
          return (
            <li key={i} className={mine ? 'mine' : 'other'}>
              {m.text}
            </li>
          );
        })}
        <div ref={endRef} />
      </ul>

      <form className="chat-form" onSubmit={submit}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Escribe mensaje…"
        />
        <button type="submit">Enviar</button>
      </form>
    </div>
  );
}
