# MoveSync

Real-time multiplayer chess with spectator mode, live emoji reactions, and in-game chat.

## Live Demo

**[movesync-app.vercel.app](https://movesync-app.vercel.app)**

## Features

- Create or join a game room with a shareable link
- Server-side move validation via chess.js
- Automatic board flip for the black player
- Spectator mode — watch any game live, read-only board
- Live emoji reaction bar for players and spectators (♟️ 🔥 😬 👑 😂)
- In-game chat with nicknames, role-coloured names, and dot indicators (white / black / spectator)
- Nickname prompt on direct room links so joiners always set their name before entering
- Captured pieces display and scrollable move history
- Game over detection — checkmate, stalemate, draw
- Rematch button with colour swap
- Fully responsive — playable on mobile

## Local Setup

```bash
# Server (port 3001)
cd server
npm install
npm start

# Client (port 5173)
cd client
npm install
npm run dev
```

Open `http://localhost:5173`.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite 5, react-chessboard, chess.js, socket.io-client |
| Backend | Node.js, Express, Socket.io, chess.js |
| Deploy | Railway (server) · Vercel (client) |

## Architecture

The server holds all game state in memory — no database required. Each room stores the chess instance, player list, spectator list, move history, and chat log. Socket.io rooms are used for scoped broadcasts so messages only go to users in the same game.

```
client/ — React + Vite SPA
  src/
    pages/
      HomePage.jsx    — create/join room, nickname input
      GamePage.jsx    — board, reactions, chat, move history
    components/
      ChatPanel.jsx       — real-time chat with nicknames
      ReactionBar.jsx     — emoji button row
      ReactionBurst.jsx   — floating emoji animation overlay
      MoveHistory.jsx     — scrollable paired move list
      CapturedPieces.jsx  — unicode piece symbols
    socket.js         — singleton socket.io-client instance

server/
  index.js  — Express + Socket.io, room store, chess.js validation
```
