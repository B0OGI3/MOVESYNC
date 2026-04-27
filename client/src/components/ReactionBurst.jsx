import { useEffect, useState } from 'react';

export default function ReactionBurst({ reactions }) {
  return (
    <div className="reaction-burst-layer" aria-hidden="true">
      {reactions.map((r) => (
        <BurstItem key={r.id} emoji={r.emoji} role={r.role} />
      ))}
    </div>
  );
}

function BurstItem({ emoji, role }) {
  const left = Math.random() * 80 + 10;
  const dur = 1.8 + Math.random() * 0.8;

  return (
    <span
      className="burst-emoji"
      style={{
        left: `${left}%`,
        animationDuration: `${dur}s`,
      }}
      title={role}
    >
      {emoji}
    </span>
  );
}
