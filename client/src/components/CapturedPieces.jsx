const PIECE_SYMBOLS = {
  'w-q': '♕', 'w-r': '♖', 'w-b': '♗', 'w-n': '♘', 'w-p': '♙',
  'b-q': '♛', 'b-r': '♜', 'b-b': '♝', 'b-n': '♞', 'b-p': '♟',
};

export default function CapturedPieces({ pieces, color }) {
  if (!pieces || pieces.length === 0) return <div className="captured-row" />;

  return (
    <div className={`captured-row captured-${color}`}>
      {pieces.map((p, i) => (
        <span key={i} className="captured-piece">
          {PIECE_SYMBOLS[`${p.color}-${p.type}`]}
        </span>
      ))}
    </div>
  );
}
