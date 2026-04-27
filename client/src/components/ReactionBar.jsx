const EMOJIS = ['♟️', '🔥', '😬', '👑', '😂'];

export default function ReactionBar({ onReact }) {
  return (
    <div className="reaction-bar">
      {EMOJIS.map((emoji) => (
        <button key={emoji} className="reaction-btn" onClick={() => onReact(emoji)} title="React">
          {emoji}
        </button>
      ))}
    </div>
  );
}
