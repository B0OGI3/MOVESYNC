# MoveSync

Real-time multiplayer chess with spectator mode and live emoji reactions.

Built with React, Vite, Node/Express, and Socket.io.

## Live Demo

_Coming soon after deploy._

## Local Setup

### Server

```bash
cd server
npm install
npm start
```

### Client

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Tech Stack

- **Frontend:** React, Vite, react-chessboard, chess.js, socket.io-client
- **Backend:** Node.js, Express, Socket.io, chess.js
- **Deploy:** Railway (server), Vercel (client)

## Features

- Create or join a game room with a shareable link
- Server-side move validation via chess.js
- Automatic board flip for black player
- Spectator mode — watch any game live
- Live emoji reaction bar for players and spectators
- Game over detection (checkmate, stalemate, draw)
- Rematch support
