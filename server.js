/**
 * LUDO ELITE — Multiplayer WebSocket Server
 * Node.js + ws library
 * 
 * Deploy on: Render.com (free tier) / Railway / VPS
 * Start: node server.js
 */

const WebSocket = require('ws');
const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;

// ── HTTP server (for health check / Render keep-alive)
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Ludo Elite Server Running');
});

const wss = new WebSocket.Server({ server });
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// ══════════════════════════════════════
//  Game Constants
// ══════════════════════════════════════
const PATH = [
  [6,1],[6,2],[6,3],[6,4],[6,5],
  [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],
  [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],
  [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],
  [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],
  [14,6],[13,6],[12,6],[11,6],[10,6],[9,6],
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0]
];

const HOME_STRETCH_LEN = 6; // 5 cells + center
const SPAWN = {
  red:   [[1,1],[1,4],[4,1],[4,4]],
  blue:  [[1,10],[1,13],[4,10],[4,13]],
  green: [[10,10],[10,13],[13,10],[13,13]],
  yellow:[[10,1],[10,4],[13,1],[13,4]],
};
const START_IDX  = { red:0, blue:13, green:26, yellow:39 };
const HOME_ENTRY = { red:50, blue:11, green:24, yellow:37 };
const SAFE_IDXS  = new Set([0,8,13,21,26,34,39,47]);

// ══════════════════════════════════════
//  State
// ══════════════════════════════════════
const clients = new Map();  // id -> ws
const rooms   = new Map();  // code -> room

function makeId() { return crypto.randomBytes(4).toString('hex'); }
function makeCode() {
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join('');
}

// ══════════════════════════════════════
//  WebSocket handlers
// ══════════════════════════════════════
wss.on('connection', ws => {
  const id = makeId();
  clients.set(id, ws);
  ws.clientId = id;
  send(ws, { type:'welcome', id });

  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw);
      handleMessage(ws, msg);
    } catch(e) { console.error('Parse error:', e); }
  });

  ws.on('close', () => {
    clients.delete(id);
    handleDisconnect(id);
  });
});

function handleMessage(ws, msg) {
  const id = ws.clientId;
  switch(msg.type) {
    case 'create_room': createRoom(ws, id, msg); break;
    case 'join_room':   joinRoom(ws, id, msg);   break;
    case 'start_game':  startGame(ws, id, msg);  break;
    case 'roll_dice':   rollDice(ws, id, msg);   break;
    case 'move_piece':  movePiece(ws, id, msg);  break;
  }
}

// ══════════════════════════════════════
//  Room Management
// ══════════════════════════════════════
function createRoom(ws, id, msg) {
  const code = makeCode();
  const max  = Math.min(Math.max(msg.players||4, 2), 4);
  const colorMap = {2:['red','green'], 3:['red','blue','green'], 4:['red','blue','green','yellow']};
  const colors = colorMap[max];

  const room = {
    code, max, host: id, started: false,
    players: [{ id, name: msg.name||'Player1', color: colors[0] }],
    spectators: [],
    colors,
    colorMap: { [id]: colors[0] },
    state: null
  };
  rooms.set(code, room);
  ws.roomCode = code;

  send(ws, {
    type:'room_created', code,
    color: colors[0],
    players: room.players,
    max
  });
}

function joinRoom(ws, id, msg) {
  const room = rooms.get(msg.code?.toUpperCase());
  if (!room) { send(ws, {type:'error', message:'Room not found!'}); return; }
  if (room.started && !msg.spectate) { send(ws, {type:'error', message:'Game already started!'}); return; }

  ws.roomCode = msg.code.toUpperCase();

  if (msg.spectate) {
    room.spectators.push({ id, name: msg.name||'Spectator' });
    send(ws, { type:'room_joined', code:room.code, color:null,
      players:room.players, max:room.max });
    if (room.started) {
      // Send current game state to spectator
      send(ws, { type:'game_start', state:room.state, colorMap:room.colorMap });
    }
    return;
  }

  if (room.players.length >= room.max) {
    send(ws, {type:'error', message:'Room is full!'}); return;
  }
  if (room.players.find(p=>p.id===id)) return;

  const color = room.colors[room.players.length];
  room.players.push({ id, name: msg.name||`Player${room.players.length+1}`, color });
  room.colorMap[id] = color;
  ws.roomCode = room.code;

  send(ws, { type:'room_joined', code:room.code, color,
    players:room.players, max:room.max });

  broadcast(room, { type:'player_joined',
    players:room.players, max:room.max,
    name: msg.name||'Someone' }, id);
}

function handleDisconnect(id) {
  rooms.forEach((room, code) => {
    const idx = room.players.findIndex(p=>p.id===id);
    if (idx !== -1) {
      // Keep player in room but mark as disconnected
      room.players[idx].disconnected = true;
      broadcast(room, { type:'player_left',
        players:room.players, name:room.players[idx].name });
    }
  });
}

// ══════════════════════════════════════
//  Game Logic
// ══════════════════════════════════════
function startGame(ws, id, msg) {
  const room = rooms.get(msg.code);
  if (!room) return;
  if (room.host !== id) { send(ws, {type:'error',message:'Only host can start!'}); return; }
  if (room.players.length < 2) { send(ws, {type:'error',message:'Need at least 2 players!'}); return; }

  room.started = true;
  const activePlayers = room.players.map(p=>p.color);

  // Init pieces
  const pieces = {};
  activePlayers.forEach(col => {
    pieces[col] = [0,1,2,3].map(i => ({
      id:i, inBase:true, pathIdx:-1, homeStretch:-1, finished:false
    }));
  });

  room.state = {
    activePlayers,
    currentTurn: 0,
    diceValue: 0,
    diceRolled: false,
    pieces,
    winner: null
  };

  broadcastAll(room, { type:'game_start', state:room.state, colorMap:room.colorMap });
}

function rollDice(ws, id, msg) {
  const room = rooms.get(msg.code);
  if (!room||!room.started) return;
  const gs = room.state;
  const myColor = room.colorMap[id];
  const curColor = gs.activePlayers[gs.currentTurn];
  if (myColor !== curColor || gs.diceRolled) return;

  const val = Math.floor(Math.random()*6)+1;
  gs.diceValue = val;
  gs.diceRolled = true;

  // Check if any move is possible
  const canMove = gs.pieces[curColor].some(p => {
    if (p.finished) return false;
    if (p.inBase) return val===6;
    if (p.homeStretch>=0) return p.homeStretch+val<=5;
    return true;
  });

  if (!canMove) {
    gs.diceRolled = false;
    gs.currentTurn = (gs.currentTurn+1) % gs.activePlayers.length;
    // skip if disconnected
    skipDisconnected(room);
  }

  broadcastAll(room, { type:'game_state', state:gs });
}

function movePiece(ws, id, msg) {
  const room = rooms.get(msg.code);
  if (!room||!room.started) return;
  const gs = room.state;
  const myColor = room.colorMap[id];
  const curColor = gs.activePlayers[gs.currentTurn];
  if (myColor !== curColor || !gs.diceRolled) return;

  const {color, pieceId} = msg;
  if (color !== myColor) return;

  const piece = gs.pieces[color].find(p=>p.id===pieceId);
  if (!piece || piece.finished) return;

  const dv = gs.diceValue;
  let extraTurn = dv === 6;

  // Enter from base
  if (piece.inBase) {
    if (dv !== 6) return;
    piece.inBase = false;
    piece.pathIdx = START_IDX[color];
    gs.diceRolled = false;
    checkCapture(gs, color, piece);
    if (!extraTurn) nextTurn(gs);
    else gs.diceRolled = false;
    broadcastAll(room, { type:'game_state', state:gs });
    return;
  }

  // Move in home stretch
  if (piece.homeStretch >= 0) {
    const newPos = piece.homeStretch + dv;
    if (newPos > 5) return; // can't overshoot
    piece.homeStretch = newPos;
    if (newPos === 5) {
      piece.finished = true;
      checkWin(gs, color);
    }
    gs.diceRolled = false;
    if (!extraTurn) nextTurn(gs);
    else gs.diceRolled = false;
    broadcastAll(room, { type:'game_state', state:gs });
    return;
  }

  // Move on main path
  const entryIdx = HOME_ENTRY[color];
  let idx = piece.pathIdx;
  for (let s=0; s<dv; s++) {
    idx = (idx+1) % 52;
    if (idx === (entryIdx+1)%52) {
      // Entering home stretch
      const stepsLeft = dv - s - 1;
      piece.pathIdx = -1;
      piece.homeStretch = stepsLeft;
      if (stepsLeft === 5) { piece.finished = true; checkWin(gs, color); }
      gs.diceRolled = false;
      if (!extraTurn) nextTurn(gs);
      else gs.diceRolled = false;
      broadcastAll(room, { type:'game_state', state:gs });
      return;
    }
  }
  piece.pathIdx = idx;
  checkCapture(gs, color, piece);
  gs.diceRolled = false;
  if (!extraTurn) nextTurn(gs);
  else gs.diceRolled = false;
  skipDisconnected(room);
  broadcastAll(room, { type:'game_state', state:gs });
}

function checkCapture(gs, color, movedPiece) {
  if (movedPiece.homeStretch >= 0 || movedPiece.finished) return;
  const idx = movedPiece.pathIdx;
  if (SAFE_IDXS.has(idx)) return;
  gs.activePlayers.forEach(col => {
    if (col === color) return;
    gs.pieces[col].forEach(p => {
      if (!p.inBase && !p.finished && p.homeStretch<0 && p.pathIdx===idx) {
        p.inBase = true; p.pathIdx = -1; p.homeStretch = -1;
      }
    });
  });
}

function checkWin(gs, color) {
  if (gs.pieces[color].every(p=>p.finished)) gs.winner = color;
}

function nextTurn(gs) {
  gs.currentTurn = (gs.currentTurn+1) % gs.activePlayers.length;
  gs.diceRolled = false;
}

function skipDisconnected(room) {
  const gs = room.state;
  for (let i=0; i<gs.activePlayers.length; i++) {
    const col = gs.activePlayers[gs.currentTurn];
    const player = room.players.find(p=>p.color===col);
    if (!player?.disconnected) break;
    gs.currentTurn = (gs.currentTurn+1) % gs.activePlayers.length;
  }
}

// ══════════════════════════════════════
//  Broadcast helpers
// ══════════════════════════════════════
function send(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

function broadcast(room, obj, excludeId=null) {
  room.players.forEach(p => {
    if (p.id === excludeId) return;
    const ws = clients.get(p.id);
    if (ws) send(ws, obj);
  });
}

function broadcastAll(room, obj) {
  [...room.players, ...room.spectators].forEach(p => {
    const ws = clients.get(p.id);
    if (ws) send(ws, obj);
  });
}

console.log('🎲 Ludo Elite Server started!');
