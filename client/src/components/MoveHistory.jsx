import { useEffect, useRef } from 'react';

export default function MoveHistory({ history }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const pairs = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push([history[i], history[i + 1]]);
  }

  return (
    <div className="move-history">
      <h3 className="history-title">Move History</h3>
      <div className="history-list">
        {pairs.length === 0 && <p className="history-empty">No moves yet.</p>}
        {pairs.map(([white, black], i) => (
          <div key={i} className="history-row">
            <span className="move-num">{i + 1}.</span>
            <span className="move-white">{white}</span>
            <span className="move-black">{black ?? ''}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
