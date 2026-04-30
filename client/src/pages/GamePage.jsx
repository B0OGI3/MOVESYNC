import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import socket from '../socket';
import ReactionBar from '../components/ReactionBar';
import ReactionBurst from '../components/ReactionBurst';
import MoveHistory from '../components/MoveHistory';
import CapturedPieces from '../components/CapturedPieces';
import ChatPanel, { RoleDot } from '../components/ChatPanel';
import { playMove, playCapture, playCheck, playGameOver, playDrawOffer } from '../sounds';

function computeCaptured(fen) {
  try {
    const chess = new Chess(fen);
    const board = chess.board().flat().filter(Boolean);
    const counts = { w: { p:8, n:2, b:2, r:2, q:1 }, b: { p:8, n:2, b:2, r:2, q:1 } };
    board.forEach(({ type, color }) => { if (counts[color][type] !== undefined) counts[color][type]--; });
    return {
      // clamp to 0 — promotions can push counts negative
      white: Object.entries(counts.b).flatMap(([t, n]) => Array(Math.max(0, n)).fill({ type: t, color: 'b' })),
      black: Object.entries(counts.w).flatMap(([t, n]) => Array(Math.max(0, n)).fill({ type: t, color: 'w' })),
    };
  } catch {
    return { white: [], black: [] };
  }
}

export default function GamePage() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [fen, setFen] = useState('start');
  const [myColor, setMyColor] = useState(null);
  const [turn, setTurn] = useState('white');
  const [history, setHistory] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [gameOver, setGameOver] = useState(null);
  const [waiting, setWaiting] = useState(false);
  const [reactions, setReactions] = useState([]);
  const [connected, setConnected] = useState(false);
  const [opponentLeft, setOpponentLeft] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [gameOverWinner, setGameOverWinner] = useState(null);
  const [incomingDraw, setIncomingDraw] = useState(false);
  const [drawOffered, setDrawOffered] = useState(false);
  const [drawDeclined, setDrawDeclined] = useState(false);
  const [resignConfirm, setResignConfirm] = useState(false);
  const reactionTimers = useRef({});

  const [nickname, setNickname] = useState(localStorage.getItem('movesync_nickname') || '');
  // Only skip the gate if the socket is already connected (came through HomePage)
  const [nicknameReady, setNicknameReady] = useState(() => socket.connected);
  const [nicknameInput, setNicknameInput] = useState(
    localStorage.getItem('movesync_nickname') || ''
  );

  const historyRef = useRef([]);
  // Refs so onDrop always reads current values regardless of render timing
  const fenRef      = useRef('start');
  const myColorRef  = useRef(null);
  const turnRef     = useRef('white');
  const gameOverRef = useRef(null);

  const applyRoomUpdate = useCallback((data, silent = false) => {
    const newHistory = data.history || [];
    if (!silent && newHistory.length > historyRef.current.length) {
      const lastSan = newHistory[newHistory.length - 1] || '';
      // game-over sound is handled exclusively by the game-over socket event
      if (lastSan.includes('+')) {
        playCheck();
      } else if (lastSan.includes('x')) {
        playCapture();
      } else if (!lastSan.includes('#')) {
        playMove();
      }
    }
    historyRef.current = newHistory;
    fenRef.current     = data.fen;
    turnRef.current    = data.turn;
    setFen(data.fen);
    setTurn(data.turn);
    setHistory(newHistory);
    setLastMove(data.lastMove || null);
    setSpectatorCount(data.spectatorCount || 0);
    if (data.isGameOver && data.gameOverReason) {
      gameOverRef.current = data.gameOverReason;
      setGameOver(data.gameOverReason);
    }
  }, []);

  useEffect(() => {
    if (!nicknameReady) return;
    setConnected(false);

    function doJoin() {
      socket.emit('join-room', { roomId, nickname }, (res) => {
        if (res.error) { navigate('/'); return; }
        myColorRef.current = res.color;
        setMyColor(res.color);
        setConnected(true);
        setWaiting(res.players?.length < 2 && res.color !== 'spectator');
        setChatMessages(res.chat || []);
        applyRoomUpdate(res, true);
        if (res.isGameOver) setGameOver(res.gameOverReason);
      });
    }

    if (socket.connected) {
      doJoin();
    } else {
      socket.connect();
      socket.on('connect', doJoin);
    }

    socket.on('room-update', (data) => {
      applyRoomUpdate(data);
      setWaiting(data.players?.length < 2);
      setOpponentLeft(false);
    });

    socket.on('game-over', ({ reason, winner }) => {
      gameOverRef.current = reason;
      setGameOver(reason);
      setGameOverWinner(winner);
      setIncomingDraw(false);
      setDrawOffered(false);
      setResignConfirm(false);
      playGameOver(winner === myColorRef.current);
    });

    socket.on('draw-offer', () => setIncomingDraw(true));
    socket.on('draw-declined', () => {
      setDrawOffered(false);
      setDrawDeclined(true);
      setTimeout(() => setDrawDeclined(false), 3000);
    });
    socket.on('player-disconnected', () => setOpponentLeft(true));

    socket.on('reaction', (data) => {
      const id = Date.now() + Math.random();
      setReactions((prev) => [...prev, { ...data, id }]);
      setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 2500);
    });

    socket.on('chat', (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    socket.on('rematch', (data) => {
      setGameOver(null);
      setGameOverWinner(null);
      setLastMove(null);
      setOpponentLeft(false);
      setIncomingDraw(false);
      setDrawOffered(false);
      setResignConfirm(false);
      applyRoomUpdate(data);
      socket.emit('join-room', { roomId, nickname }, (res) => {
        if (!res.error) { myColorRef.current = res.color; setMyColor(res.color); }
      });
    });

    return () => {
      socket.off('connect', doJoin);
      socket.off('room-update');
      socket.off('game-over');
      socket.off('player-disconnected');
      socket.off('reaction');
      socket.off('chat');
      socket.off('rematch');
      socket.off('draw-offer');
      socket.off('draw-declined');
      socket.disconnect();
    };
  }, [roomId, navigate, applyRoomUpdate, nickname, nicknameReady]);

  function onDrop(sourceSquare, targetSquare) {
    const color    = myColorRef.current;
    const curTurn  = turnRef.current;
    const curFen   = fenRef.current;
    const isOver   = gameOverRef.current;

    if (!color || color === 'spectator') return false;
    if (color !== curTurn) return false;
    if (isOver) return false;

    // Validate locally — if chess.js rejects it, snap back immediately
    const chess = new Chess(curFen);
    const move = chess.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
    if (!move) return false;

    socket.emit(
      'move',
      { from: sourceSquare, to: targetSquare, promotion: move.promotion || undefined },
      (res) => { if (res.error) console.warn('Move rejected by server:', res.error); }
    );
    return true;
  }

  function handleReaction(emoji) {
    const now = Date.now();
    const last = reactionTimers.current[socket.id] || 0;
    if (now - last < 3000) return;
    reactionTimers.current[socket.id] = now;
    socket.emit('reaction', { emoji });
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
  }

  function handleResign() {
    if (!resignConfirm) { setResignConfirm(true); return; }
    socket.emit('resign');
    setResignConfirm(false);
  }

  function handleDrawOffer() {
    socket.emit('draw-offer');
    setDrawOffered(true);
    playDrawOffer();
  }

  const captured = fen && fen !== 'start' ? computeCaptured(fen) : { white: [], black: [] };
  const boardOrientation = myColor === 'black' ? 'black' : 'white';
  const isMyTurn = myColor === turn && !gameOver;
  const isSpectator = myColor === 'spectator';

  // Last move highlight
  const lastMoveStyles = lastMove
    ? {
        [lastMove.from]: { background: 'rgba(255, 200, 0, 0.5)' },
        [lastMove.to]:   { background: 'rgba(255, 200, 0, 0.7)' },
      }
    : {};

  // Check indicator — find the king square of the side in check
  let checkSquareStyles = {};
  try {
    if (fen && fen !== 'start' && !gameOver) {
      const chessCheck = new Chess(fen);
      if (chessCheck.inCheck()) {
        const color = chessCheck.turn();
        const files = 'abcdefgh';
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const piece = chessCheck.board()[r][c];
            if (piece?.type === 'k' && piece.color === color) {
              checkSquareStyles[files[c] + (8 - r)] = {
                background: 'radial-gradient(circle, rgba(220,50,50,0.9) 0%, rgba(220,50,50,0.3) 70%, transparent 100%)',
              };
            }
          }
        }
      }
    }
  } catch { /* ignore */ }

  // Game over outcome from this player's perspective
  const gameOverTitle = (() => {
    if (!gameOver) return null;
    if (gameOver === 'resignation') {
      if (isSpectator) return 'Resignation';
      return gameOverWinner === myColor ? 'You Win' : 'You Lose';
    }
    if (isSpectator) return gameOver === 'checkmate' ? 'Checkmate' : gameOver === 'stalemate' ? 'Stalemate' : 'Draw';
    if (gameOver !== 'checkmate') return gameOver === 'stalemate' ? 'Stalemate' : 'Draw';
    try {
      const finalChess = new Chess(fen);
      const loserColor = finalChess.turn() === 'w' ? 'white' : 'black';
      if (myColor === loserColor) return 'You Lose';
      return 'You Win';
    } catch { return 'Game Over'; }
  })();

  if (!nicknameReady) {
    return (
      <div className="nickname-gate">
        <div className="nickname-gate-card">
          <div className="home-logo">♟</div>
          <h2>Join Room <span className="gate-room-code">{roomId}</span></h2>
          <p className="home-sub">Enter a nickname before joining</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = nicknameInput.trim();
              localStorage.setItem('movesync_nickname', name);
              setNickname(name);
              setNicknameReady(true);
            }}
            className="gate-form"
          >
            <input
              className="input"
              placeholder="Your nickname (optional)"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              maxLength={24}
              autoFocus
            />
            <button className="btn btn-primary" type="submit">
              Join Game
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Connecting to room {roomId}…</p>
      </div>
    );
  }

  return (
    <div className="game-page">
      <header className="game-header">
        <button className="btn-back" onClick={() => navigate('/')}>← Home</button>
        <div className="room-info">
          <span className="room-code">Room: <strong>{roomId}</strong></span>
          <button className="btn-copy" onClick={copyLink} title="Copy invite link">🔗 Copy Link</button>
        </div>
        {myColor && (
          <div className="my-role-badge">
            <RoleDot role={myColor} size={10} />
            <span>{nickname || myColor}</span>
          </div>
        )}
        <div className="spectator-badge">👁 {spectatorCount} watching</div>
      </header>

      {isSpectator && <div className="spectator-banner">👁 You are spectating</div>}

      {waiting && !isSpectator && (
        <div className="waiting-banner">
          ⏳ Waiting for opponent… Share this link to invite:
          <button className="btn-copy inline" onClick={copyLink}>Copy Link</button>
        </div>
      )}

      {opponentLeft && !gameOver && (
        <div className="notice-banner">⚠️ Your opponent disconnected.</div>
      )}

      {drawDeclined && !gameOver && (
        <div className="notice-banner">Draw offer declined.</div>
      )}

      {incomingDraw && !gameOver && (
        <div className="draw-offer-banner">
          <span>Your opponent offers a draw</span>
          <button className="btn btn-primary action-btn" onClick={() => { socket.emit('draw-accept'); setIncomingDraw(false); }}>Accept</button>
          <button className="btn btn-secondary action-btn" onClick={() => { socket.emit('draw-decline'); setIncomingDraw(false); }}>Decline</button>
        </div>
      )}

      <div className="game-layout">
        <div className="board-column">
          <CapturedPieces pieces={boardOrientation === 'white' ? captured.white : captured.black} color="opponent" />

          <div className="board-wrap">
            <ReactionBurst reactions={reactions} />
            <Chessboard
              position={fen}
              onPieceDrop={onDrop}
              boardOrientation={boardOrientation}
              arePiecesDraggable={isMyTurn && !isSpectator}
              customSquareStyles={{ ...lastMoveStyles, ...checkSquareStyles }}
              customBoardStyle={{ borderRadius: '8px', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}
            />
            {gameOver && (
              <div className="game-over-overlay">
                <div className="game-over-card">
                  <div className="game-over-icon">
                    {gameOverTitle === 'You Win'  ? '🏆' :
                     gameOverTitle === 'You Lose' ? '😞' : '🤝'}
                  </div>
                  <div className="game-over-title">{gameOverTitle}</div>
                  <div className="game-over-sub">
                    {gameOver === 'checkmate' ? 'by checkmate' :
                     gameOver === 'stalemate' ? 'by stalemate' :
                     gameOver === 'resignation' ? 'by resignation' : 'by draw'}
                  </div>
                  {!isSpectator && (
                    <button className="btn btn-primary" onClick={() => socket.emit('rematch')}>
                      🔄 Rematch
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <CapturedPieces pieces={boardOrientation === 'white' ? captured.black : captured.white} color="mine" />

          <div className="turn-indicator">
            {waiting ? (
              <span className="waiting-label">Waiting for opponent…</span>
            ) : !gameOver && Object.keys(checkSquareStyles).length > 0 ? (
              <span className="check-label">⚠️ Check!</span>
            ) : !gameOver ? (
              <span className={isMyTurn ? 'your-turn' : 'their-turn'}>
                {isMyTurn ? '✅ Your turn' : `⏳ ${turn.charAt(0).toUpperCase() + turn.slice(1)}'s turn`}
              </span>
            ) : null}
          </div>

          {!isSpectator && !gameOver && !waiting && (
            <div className="action-bar">
              {resignConfirm ? (
                <>
                  <span className="action-confirm-text">Resign?</span>
                  <button className="btn btn-danger action-btn" onClick={handleResign}>Yes, resign</button>
                  <button className="btn btn-secondary action-btn" onClick={() => setResignConfirm(false)}>Cancel</button>
                </>
              ) : (
                <button className="btn btn-secondary action-btn" onClick={() => setResignConfirm(true)}>🏳️ Resign</button>
              )}
              {drawOffered ? (
                <button className="btn btn-secondary action-btn" disabled>Draw offered…</button>
              ) : (
                <button className="btn btn-secondary action-btn" onClick={handleDrawOffer}>🤝 Offer Draw</button>
              )}
            </div>
          )}

          <ReactionBar onReact={handleReaction} />
        </div>

        <aside className="sidebar">
          <MoveHistory history={history} />
          <ChatPanel messages={chatMessages} nickname={nickname} />
        </aside>
      </div>
    </div>
  );
}
