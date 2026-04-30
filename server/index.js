require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Chess } = require('chess.js');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  'http://localhost:5173',
  ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map((s) => s.trim()) : []),
];

function originAllowed(origin, callback) {
  if (!origin) return callback(null, true);
  if (allowedOrigins.some((o) => origin === o || origin.endsWith('.vercel.app'))) {
    return callback(null, true);
  }
  callback(new Error('Not allowed by CORS'));
}

app.use(cors({ origin: originAllowed }));
app.use(express.json());

const io = new Server(server, {
  cors: { origin: originAllowed, methods: ['GET', 'POST'] },
});

// rooms[roomId] = { chess, players: [{id, color}], spectators: [id], history: [] }
const rooms = {};

function roomSummary(room) {
  return {
    fen: room.chess.fen(),
    history: room.history,
    players: room.players.map((p) => ({ color: p.color })),
    spectatorCount: room.spectators.length,
    turn: room.chess.turn() === 'w' ? 'white' : 'black',
    isGameOver: room.chess.isGameOver(),
    gameOverReason: getGameOverReason(room.chess),
  };
}

function getGameOverReason(chess) {
  if (!chess.isGameOver()) return null;
  if (chess.isCheckmate()) return 'checkmate';
  if (chess.isStalemate()) return 'stalemate';
  if (chess.isDraw()) return 'draw';
  return 'game-over';
}

io.on('connection', (socket) => {
  // Create room
  socket.on('create-room', ({ nickname } = {}, callback) => {
    const roomId = crypto.randomUUID().slice(0, 6).toUpperCase();
    rooms[roomId] = {
      chess: new Chess(),
      players: [{ id: socket.id, color: 'white' }],
      spectators: [],
      history: [],
      chat: [],
    };
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.role = 'white';
    socket.data.nickname = nickname || 'White';
    callback({ roomId, color: 'white' });
  });

  // Join room
  socket.on('join-room', ({ roomId, nickname }, callback) => {
    const room = rooms[roomId];
    if (!room) {
      return callback({ error: 'Room not found' });
    }

    // Already in room (reconnect)
    const existing = room.players.find((p) => p.id === socket.id);
    if (existing) {
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.role = existing.color;
      if (nickname) socket.data.nickname = nickname;
      return callback({ color: existing.color, chat: room.chat, ...roomSummary(room) });
    }

    socket.join(roomId);
    socket.data.roomId = roomId;
    if (nickname) socket.data.nickname = nickname;

    if (room.players.length < 2) {
      const color = 'black';
      room.players.push({ id: socket.id, color });
      socket.data.role = color;
      if (!socket.data.nickname) socket.data.nickname = 'Black';
      callback({ color, chat: room.chat, ...roomSummary(room) });
      io.to(roomId).emit('room-update', roomSummary(room));
    } else {
      room.spectators.push(socket.id);
      socket.data.role = 'spectator';
      if (!socket.data.nickname) socket.data.nickname = 'Spectator';
      callback({ color: 'spectator', chat: room.chat, ...roomSummary(room) });
      io.to(roomId).emit('room-update', roomSummary(room));
    }
  });

  // Move
  socket.on('move', ({ from, to, promotion }, callback) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room) return callback({ error: 'Room not found' });
    if (room.chess.isGameOver()) return callback({ error: 'Game over' });

    const playerColor = socket.data.role;
    const turn = room.chess.turn() === 'w' ? 'white' : 'black';
    if (playerColor !== turn) return callback({ error: 'Not your turn' });

    try {
      const move = room.chess.move({ from, to, promotion: promotion || 'q' });
      if (!move) return callback({ error: 'Illegal move' });

      room.history.push(move.san);
      const summary = roomSummary(room);
      io.to(roomId).emit('room-update', summary);

      if (room.chess.isGameOver()) {
        io.to(roomId).emit('game-over', {
          reason: getGameOverReason(room.chess),
          winner:
            room.chess.isCheckmate()
              ? room.chess.turn() === 'w' ? 'black' : 'white'
              : null,
        });
      }

      callback({ ok: true });
    } catch {
      callback({ error: 'Illegal move' });
    }
  });

  // Chat
  socket.on('chat', ({ message }) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || !message?.trim()) return;
    const text = message.trim().slice(0, 200);
    const entry = {
      nickname: socket.data.nickname || 'Anonymous',
      role: socket.data.role,
      message: text,
      ts: Date.now(),
    };
    room.chat.push(entry);
    if (room.chat.length > 200) room.chat.shift();
    io.to(roomId).emit('chat', entry);
  });

  // Reaction
  socket.on('reaction', ({ emoji }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    io.to(roomId).emit('reaction', {
      emoji,
      role: socket.data.role,
      id: socket.id,
    });
  });

  // Resign
  socket.on('resign', (callback) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.chess.isGameOver()) return callback?.({ error: 'Invalid' });
    const color = socket.data.role;
    if (color !== 'white' && color !== 'black') return callback?.({ error: 'Spectators cannot resign' });
    const winner = color === 'white' ? 'black' : 'white';
    io.to(roomId).emit('game-over', { reason: 'resignation', winner });
    callback?.({ ok: true });
  });

  // Draw offer
  socket.on('draw-offer', () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.chess.isGameOver()) return;
    const color = socket.data.role;
    if (color !== 'white' && color !== 'black') return;
    const opponent = room.players.find((p) => p.id !== socket.id);
    if (!opponent) return;
    room.drawOfferedBy = socket.id;
    io.to(opponent.id).emit('draw-offer', { from: color });
  });

  // Draw accept
  socket.on('draw-accept', () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.chess.isGameOver() || !room.drawOfferedBy) return;
    room.drawOfferedBy = null;
    io.to(roomId).emit('game-over', { reason: 'draw', winner: null });
  });

  // Draw decline
  socket.on('draw-decline', () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room) return;
    const offerId = room.drawOfferedBy;
    room.drawOfferedBy = null;
    if (offerId) io.to(offerId).emit('draw-declined');
  });

  // Rematch
  socket.on('rematch', () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room) return;

    room.chess = new Chess();
    room.history = [];
    room.drawOfferedBy = null;
    // Swap colors
    room.players = room.players.map((p) => ({
      id: p.id,
      color: p.color === 'white' ? 'black' : 'white',
    }));

    // Update each player's socket.data.role
    room.players.forEach((p) => {
      const s = io.sockets.sockets.get(p.id);
      if (s) s.data.role = p.color;
    });

    io.to(roomId).emit('rematch', roomSummary(room));
    io.to(roomId).emit('room-update', roomSummary(room));
  });

  // Disconnect
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;

    const room = rooms[roomId];
    const playerIdx = room.players.findIndex((p) => p.id === socket.id);
    if (playerIdx !== -1) {
      room.players.splice(playerIdx, 1);
      io.to(roomId).emit('player-disconnected', { role: socket.data.role });
      io.to(roomId).emit('room-update', roomSummary(room));
    } else {
      room.spectators = room.spectators.filter((id) => id !== socket.id);
      io.to(roomId).emit('room-update', roomSummary(room));
    }

    // Clean up empty rooms
    if (room.players.length === 0 && room.spectators.length === 0) {
      delete rooms[roomId];
    }
  });
});

app.get('/', (_, res) => res.send('MoveSync server is running.'));
app.get('/health', (_, res) => res.json({ ok: true }));
app.get('/version', (_, res) => res.json({ v: 2, features: ['resign', 'draw-offer'] }));

server.listen(PORT, () => {
  console.log(`MoveSync server running on port ${PORT}`);
});
