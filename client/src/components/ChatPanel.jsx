import { useState, useEffect, useRef } from 'react';
import socket from '../socket';

const ROLE_COLOR = { white: '#e0ddd8', black: '#a0a0c0', spectator: '#7c6af7' };
const ROLE_DOT   = { white: '#f0ede4', black: '#3a3a4a', spectator: '#7c6af7' };
const ROLE_BORDER= { white: '#c0bdb4', black: '#6a6a7a', spectator: '#5a4ad7' };

export function RoleDot({ role, size = 9 }) {
  return (
    <span
      className="role-dot"
      style={{
        width: size,
        height: size,
        background: ROLE_DOT[role] || '#888',
        border: `1.5px solid ${ROLE_BORDER[role] || '#555'}`,
      }}
      title={role}
    />
  );
}

export default function ChatPanel({ messages }) {
  const [input, setInput] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function send(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    socket.emit('chat', { message: text });
    setInput('');
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="chat-panel">
      <h3 className="chat-title">Chat</h3>
      <div className="chat-messages">
        {messages.length === 0 && <p className="chat-empty">No messages yet.</p>}
        {messages.map((m, i) => (
          <div key={i} className="chat-msg">
            <RoleDot role={m.role} />
            <span className="chat-name" style={{ color: ROLE_COLOR[m.role] || '#aaa' }}>
              {m.nickname}
            </span>
            <span className="chat-text">{m.message}</span>
            <span className="chat-ts">{formatTime(m.ts)}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="chat-form">
        <input
          className="input chat-input"
          placeholder="Say something…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={200}
        />
        <button className="btn btn-primary chat-send" type="submit" disabled={!input.trim()}>
          ↑
        </button>
      </form>
    </div>
  );
}
