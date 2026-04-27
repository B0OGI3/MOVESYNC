import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';

export default function HomePage() {
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  function handleCreate() {
    setLoading(true);
    setError('');
    socket.connect();
    socket.emit('create-room', ({ roomId, error: err }) => {
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
