# MoveSync

Real-time multiplayer chess with spectator mode, Stockfish analysis, live reactions, and in-game chat.

## Live Demo

**[movesync-app.vercel.app](https://movesync-app.vercel.app)**

## Features

- Create or join a game room with a shareable 6-character room code
- Server-side move validation via chess.js
- Automatic board flip for the black player
- Last move highlighted on the board
- Check indicator — king square pulses red when in check
- Resign and draw offer system with accept/decline flow
- Rematch with color swap — both players must agree
- Post-game Stockfish 18 analysis with eval bar, best move highlights, and arrow-key navigation
- Spectator mode — watch any game live, read-only board
- Captured pieces display and scrollable move history
- Live emoji reaction bar for players and spectators (♟️ 🔥 😬 👑 😂)
- In-game chat with nicknames and role-coloured dot indicators (white / black / spectator)
- Nickname prompt on direct room links so joiners always set their name before entering
- Sound effects for moves, captures, checks, draw offers, rematch offers, and game over
- Game over detection — checkmate, stalemate, draw, resignation
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
| Engine | Stockfish 18 (WASM, lite single-threaded) via Web Worker |
| Deploy | Railway (server) · Vercel (client) |

## Architecture

The server holds all game state in memory — no database required. Each room stores the chess instance, player list, spectator list, move history, and chat log. Socket.io rooms are used for scoped broadcasts so messages only go to users in the same game.

Stockfish runs entirely in the browser as a Web Worker using the lite single-threaded WASM build (no SharedArrayBuffer required). Evaluations are cached per position so navigating back through moves doesn't re-analyze.

```
client/ — React + Vite SPA
  src/
    pages/
      HomePage.jsx        — create/join room, nickname input
      GamePage.jsx        — board, reactions, chat, move history, game controls
    components/
      AnalysisPanel.jsx   — Stockfish eval bar, best move display, position navigator
      ChatPanel.jsx       — real-time chat with nicknames and role dots
      ReactionBar.jsx     — emoji button row
      ReactionBurst.jsx   — floating emoji animation overlay
      MoveHistory.jsx     — scrollable paired move list
      CapturedPieces.jsx  — unicode piece symbols
    hooks/
      useStockfish.js     — Web Worker wrapper for Stockfish UCI protocol
    sounds.js             — Web Audio API sound effects
    socket.js             — singleton socket.io-client instance
  public/
    stockfish.js          — Stockfish 18 lite WASM loader
    stockfish.wasm        — Stockfish 18 engine binary

server/
  index.js  — Express + Socket.io, room store, chess.js validation
```
