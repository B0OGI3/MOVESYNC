import { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import useStockfish from '../hooks/useStockfish';

function reconstructFens(history) {
  const chess = new Chess();
  const fens = [chess.fen()];
  for (const san of history) {
    try { chess.move(san); fens.push(chess.fen()); } catch { break; }
  }
  return fens;
}

function cpToPercent(cp) {
  const clamped = Math.max(-800, Math.min(800, cp));
  return 50 + (clamped / 800) * 45;
}

function formatScore(score, isMate, mateIn) {
  if (isMate) return mateIn > 0 ? `M${mateIn}` : `-M${Math.abs(mateIn)}`;
  const p = score / 100;
  return p >= 0 ? `+${p.toFixed(1)}` : p.toFixed(1);
}

export default function AnalysisPanel({ history, boardOrientation, onClose }) {
  const [fens]       = useState(() => reconstructFens(history));
  const [index, setIndex] = useState(fens.length - 1);
  const [evals, setEvals] = useState({});
  const [busy, setBusy]   = useState(false);
  const { evaluate, stop } = useStockfish();

  const fen      = fens[index];
  const evalData = evals[index];
  const whitePct = evalData ? cpToPercent(evalData.score) : 50;

  // Analyze position on demand, cache results
  useEffect(() => {
    if (evals[index] !== undefined) return;
    let active = true;
    setBusy(true);
    evaluate(fen, 14).then((result) => {
      if (!active) return;
      setEvals(prev => ({ ...prev, [index]: result }));
      setBusy(false);
    });
    return () => { active = false; stop(); };
  }, [index, fen]);

  // Arrow-key navigation
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft')  setIndex(i => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIndex(i => Math.min(fens.length - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fens.length]);

  const bestMoveStyles = {};
  if (evalData?.bestmove?.length >= 4) {
    bestMoveStyles[evalData.bestmove.slice(0, 2)] = { background: 'rgba(0,200,100,0.45)' };
    bestMoveStyles[evalData.bestmove.slice(2, 4)] = { background: 'rgba(0,200,100,0.7)' };
  }

  return (
    <div className="analysis-wrap">
      <div className="analysis-header">
        <span>Analysis</span>
        <span className="analysis-hint">← → keys to navigate</span>
        <button className="btn-back" onClick={onClose}>✕ Close</button>
      </div>

      <div className="analysis-board-row">
        {/* Eval bar */}
        <div className="eval-bar" title={evalData ? formatScore(evalData.score, evalData.isMate, evalData.mateIn) : '='}>
          <div className="eval-bar-black" style={{ height: `${100 - whitePct}%` }} />
          <div className="eval-bar-white" style={{ height: `${whitePct}%` }} />
        </div>

        {/* Board */}
        <div className="analysis-board">
          <Chessboard
            position={fen}
            boardOrientation={boardOrientation}
            arePiecesDraggable={false}
            customSquareStyles={bestMoveStyles}
            customBoardStyle={{ borderRadius: '8px', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}
          />
        </div>
      </div>

      {/* Score */}
      <div className="analysis-score">
        {busy ? 'Analyzing…' : evalData ? formatScore(evalData.score, evalData.isMate, evalData.mateIn) : '='}
      </div>

      {/* Navigation */}
      <div className="analysis-nav">
        <button className="analysis-nav-btn" onClick={() => setIndex(0)} disabled={index === 0}>⏮</button>
        <button className="analysis-nav-btn" onClick={() => setIndex(i => Math.max(0, i - 1))} disabled={index === 0}>◀</button>
        <span className="analysis-move-num">{index === 0 ? 'Start' : `Move ${index}`}</span>
        <button className="analysis-nav-btn" onClick={() => setIndex(i => Math.min(fens.length - 1, i + 1))} disabled={index === fens.length - 1}>▶</button>
        <button className="analysis-nav-btn" onClick={() => setIndex(fens.length - 1)} disabled={index === fens.length - 1}>⏭</button>
      </div>

      {/* Best move */}
      <div className="analysis-bestmove">
        {busy && 'Calculating best move…'}
        {!busy && evalData?.bestmove && (
          <>💡 Best: <strong>{evalData.bestmove.slice(0,2)}→{evalData.bestmove.slice(2,4)}</strong>
            {evalData.bestmove.length > 4 && ` (promote to ${evalData.bestmove[4].toUpperCase()})`}
          </>
        )}
      </div>
    </div>
  );
}
