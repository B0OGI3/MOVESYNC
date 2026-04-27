import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';

export default function HomePage() {
  const [nickname, setNickname] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem('movesync_nickname');
    if (saved) setNickname(saved);
  }, []);

  function saveName(val) {
    setNickname(val);
    localStorage.setItem('movesync_nickname', val);
  }

  function effectiveName(fallback) {
    return nickname.trim() || fallback;
  }

  function handleCreate() {
    setLoading(true);
    setError('');
    socket.connect();
    socket.emit('create-room', { nickname: effectiveName('White') }, ({ roomId, error: err }) => {
      setLoading(false);
      if (err) { setError(err); socket.disconnect(); return; }
      navigate(`/room/${roomId}`);
    });
  }

  function handleJoin(e) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    navigate(`/room/${code}`);
  }

  return (
    <div className="home-page">
      <div className="home-card">
        <div className="home-logo">♟</div>
        <h1 className="home-title">MoveSync</h1>
        <p className="home-sub">Real-time chess with live spectator reactions</p>

        <div className="nickname-row">
          <input
            className="input"
            placeholder="Your nickname (optional)"
            value={nickname}
            onChange={(e) => saveName(e.target.value)}
            maxLength={24}
          />
        </div>

        <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
          {loading ? 'Creating…' : 'Create Game'}
        </button>

        <div className="divider"><span>or join existing</span></div>

        <form onSubmit={handleJoin} className="join-form">
          <input
            className="input"
            placeholder="Enter room code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <button className="btn btn-secondary" type="submit" disabled={!joinCode.trim()}>
            Join
          </button>
        </form>

        {error && <p className="error-msg">{error}</p>}
      </div>
    </div>
  );
}
