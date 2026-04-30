import { useEffect, useRef, useCallback } from 'react';

export default function useStockfish() {
  const workerRef = useRef(null);
  const resolverRef = useRef(null);
  const bestInfoRef = useRef(null);

  useEffect(() => {
    const worker = new Worker('/stockfish.js');
    worker.postMessage('uci');
    worker.postMessage('setoption name Threads value 1');
    worker.postMessage('isready');
    workerRef.current = worker;

    worker.onmessage = ({ data }) => {
      if (typeof data !== 'string') return;

      // Capture best info at highest depth seen
      const infoMatch = data.match(/^info depth (\d+).*score (cp|mate) (-?\d+).*pv (\S+)/);
      if (infoMatch) {
        const depth = parseInt(infoMatch[1]);
        const type  = infoMatch[2];
        const val   = parseInt(infoMatch[3]);
        const pv    = infoMatch[4];
        if (!bestInfoRef.current || depth > bestInfoRef.current.depth) {
          bestInfoRef.current = {
            depth,
            score:    type === 'cp' ? val : (val > 0 ? 30000 : -30000),
            isMate:   type === 'mate',
            mateIn:   type === 'mate' ? val : null,
            bestmove: pv,
          };
        }
      }

      if (data.startsWith('bestmove')) {
        const move = data.split(' ')[1];
        if (resolverRef.current) {
          const info = bestInfoRef.current || { score: 0, bestmove: null };
          if (!info.bestmove) info.bestmove = move === '(none)' ? null : move;
          resolverRef.current(info);
          resolverRef.current = null;
          bestInfoRef.current = null;
        }
      }
    };

    return () => {
      worker.postMessage('quit');
      worker.terminate();
    };
  }, []);

  const evaluate = useCallback((fen, depth = 14) => {
    return new Promise((resolve) => {
      const worker = workerRef.current;
      if (!worker) return resolve({ score: 0, bestmove: null });
      bestInfoRef.current = null;
      resolverRef.current = resolve;
      worker.postMessage('ucinewgame');
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${depth}`);
    });
  }, []);

  const stop = useCallback(() => {
    workerRef.current?.postMessage('stop');
  }, []);

  return { evaluate, stop };
}
