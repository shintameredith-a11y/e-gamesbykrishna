/* games.js — pure, server-authoritative game logic.
   Each game exports:
     createState()                  -> initial state
     applyMove(state, player, move) -> { state } | { state, delayMs } | { error }
     view(state)                    -> state safe to send to clients
     resolveDelay(state)            -> (optional) applied after delayMs
*/
'use strict';

const clone = (o) => JSON.parse(JSON.stringify(o));

/* =========================================================
   TIC TAC TOE
   ========================================================= */
const TTT_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

const tictactoe = {
  id: 'tictactoe',
  name: 'Tic Tac Toe',
  icon: '❌',
  tag: 'Classic',
  desc: 'Line up three of your marks in a row, column or diagonal.',

  createState() {
    return { board: Array(9).fill(null), turn: 0, winner: null, winLine: null, ply: 0 };
  },

  applyMove(state, player, move) {
    if (state.winner !== null) return { error: 'The game is already over.' };
    if (state.turn !== player) return { error: 'It is not your turn.' };

    const i = move && move.index;
    if (!Number.isInteger(i) || i < 0 || i > 8) return { error: 'Invalid square.' };
    if (state.board[i] !== null) return { error: 'That square is already taken.' };

    const s = clone(state);
    s.board[i] = player;
    s.ply++;

    const line = TTT_LINES.find(([a, b, c]) =>
      s.board[a] !== null && s.board[a] === s.board[b] && s.board[b] === s.board[c]
    );

    if (line) { s.winner = player; s.winLine = line; }
    else if (s.ply === 9) s.winner = 'draw';
    else s.turn = 1 - player;

    return { state: s };
  },

  view: (s) => s
};

/* =========================================================
   CONNECT FOUR
   ========================================================= */
const C4_ROWS = 6;
const C4_COLS = 7;

function findC4Win(board, row, col, player) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    const line = [[row, col]];
    for (const sign of [1, -1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (r >= 0 && r < C4_ROWS && c >= 0 && c < C4_COLS && board[r][c] === player) {
        line.push([r, c]);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (line.length >= 4) return line;
  }
  return null;
}

const connect4 = {
  id: 'connect4',
  name: 'Connect Four',
  icon: '🔴',
  tag: 'Strategy',
  desc: 'Drop discs into columns. First to line up four in any direction wins.',

  createState() {
    return {
      board: Array.from({ length: C4_ROWS }, () => Array(C4_COLS).fill(null)),
      turn: 0, winner: null, winCells: null, ply: 0
    };
  },

  applyMove(state, player, move) {
    if (state.winner !== null) return { error: 'The game is already over.' };
    if (state.turn !== player) return { error: 'It is not your turn.' };

    const c = move && move.col;
    if (!Number.isInteger(c) || c < 0 || c >= C4_COLS) return { error: 'Invalid column.' };

    const s = clone(state);
    let row = -1;
    for (let r = C4_ROWS - 1; r >= 0; r--) {
      if (s.board[r][c] === null) { row = r; break; }
    }
    if (row === -1) return { error: 'That column is full.' };

    s.board[row][c] = player;
    s.ply++;

    const win = findC4Win(s.board, row, c, player);
    if (win) { s.winner = player; s.winCells = win; }
    else if (s.ply === C4_ROWS * C4_COLS) s.winner = 'draw';
    else s.turn = 1 - player;

    return { state: s };
  },

  view: (s) => s
};

/* =========================================================
   DOTS & BOXES
   ========================================================= */
const DOTS_N = 5;

const dots = {
  id: 'dots',
  name: 'Dots & Boxes',
  icon: '🔷',
  tag: 'Strategy',
  desc: 'Draw lines between dots. Complete a box to claim it — and play again.',

  createState() {
    const N = DOTS_N;
    return {
      n: N,
      // h[r][c] : r 0..N, c 0..N-1   (horizontal edges)
      h: Array.from({ length: N + 1 }, () => Array(N).fill(null)),
      // v[r][c] : r 0..N-1, c 0..N   (vertical edges)
      v: Array.from({ length: N }, () => Array(N + 1).fill(null)),
      // owner[r][c] : 0 | 1 | null
      owner: Array.from({ length: N }, () => Array(N).fill(null)),
      scores: [0, 0],
      turn: 0,
      winner: null,
      claimed: 0
    };
  },

  applyMove(state, player, move) {
    if (state.winner !== null) return { error: 'The game is already over.' };
    if (state.turn !== player) return { error: 'It is not your turn.' };

    const { type, r, c } = move || {};
    const N = state.n;
    const s = clone(state);

    if (type === 'h') {
      if (!Number.isInteger(r) || !Number.isInteger(c)) return { error: 'Invalid move.' };
      if (r < 0 || r > N || c < 0 || c >= N) return { error: 'Invalid move.' };
      if (s.h[r][c] !== null) return { error: 'That line is already drawn.' };
      s.h[r][c] = player;
    } else if (type === 'v') {
      if (!Number.isInteger(r) || !Number.isInteger(c)) return { error: 'Invalid move.' };
      if (r < 0 || r >= N || c < 0 || c > N) return { error: 'Invalid move.' };
      if (s.v[r][c] !== null) return { error: 'That line is already drawn.' };
      s.v[r][c] = player;
    } else {
      return { error: 'Invalid move.' };
    }

    // Which boxes could this edge have completed?
    const candidates = [];
    if (type === 'h') {
      if (r - 1 >= 0) candidates.push([r - 1, c]);
      if (r < N) candidates.push([r, c]);
    } else {
      if (c - 1 >= 0) candidates.push([r, c - 1]);
      if (c < N) candidates.push([r, c]);
    }

    let scored = 0;
    for (const [br, bc] of candidates) {
      if (s.owner[br][bc] === null &&
          s.h[br][bc] !== null && s.h[br + 1][bc] !== null &&
          s.v[br][bc] !== null && s.v[br][bc + 1] !== null) {
        s.owner[br][bc] = player;
        s.scores[player]++;
        s.claimed++;
        scored++;
      }
    }

    if (s.claimed === N * N) {
      if (s.scores[0] > s.scores[1]) s.winner = 0;
      else if (s.scores[1] > s.scores[0]) s.winner = 1;
      else s.winner = 'draw';
    } else if (scored === 0) {
      s.turn = 1 - player;
    }
    // if scored > 0, player keeps the turn

    return { state: s };
  },

  view: (s) => s
};

/* =========================================================
   MEMORY MATCH
   ========================================================= */
const MEM_SYMBOLS = ['🍎', '🍌', '🍇', '🍒', '🍉', '🥝', '🍑', '🍍'];

const memory = {
  id: 'memory',
  name: 'Memory Match',
  icon: '🧠',
  tag: 'Reflex',
  desc: 'Flip two cards. Find a pair to score and keep your turn going.',

  createState() {
    const deck = [...MEM_SYMBOLS, ...MEM_SYMBOLS];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return {
      deck,
      matched: [],
      revealed: [],
      scores: [0, 0],
      turn: 0,
      winner: null,
      pending: false
    };
  },

  applyMove(state, player, move) {
    if (state.winner !== null) return { error: 'The game is already over.' };
    if (state.turn !== player) return { error: 'It is not your turn.' };
    if (state.pending) return { error: 'Wait for the cards to turn back.' };

    const i = move && move.index;
    if (!Number.isInteger(i) || i < 0 || i >= 16) return { error: 'Invalid card.' };
    if (state.matched.includes(i) || state.revealed.includes(i)) {
      return { error: 'That card is already face up.' };
    }

    const s = clone(state);
    s.revealed.push(i);

    // First card of the pair
    if (s.revealed.length < 2) {
      return { state: s };
    }

    const [a, b] = s.revealed;

    if (s.deck[a] === s.deck[b]) {
      // Match: keep them up, score, extra turn
      s.matched.push(a, b);
      s.revealed = [];
      s.scores[player]++;

      if (s.matched.length === 16) {
        if (s.scores[0] > s.scores[1]) s.winner = 0;
        else if (s.scores[1] > s.scores[0]) s.winner = 1;
        else s.winner = 'draw';
      }
      return { state: s };
    }

    // No match: keep both visible briefly, then flip back
    s.pending = true;
    return { state: s, delayMs: 1100 };
  },

  resolveDelay(state) {
    const s = clone(state);
    s.revealed = [];
    s.pending = false;
    s.turn = 1 - s.turn;
    return s;
  },

  // Hide the identity of cards that are face down
  view(state) {
    return {
      ...state,
      deck: state.deck.map((sym, i) =>
        (state.matched.includes(i) || state.revealed.includes(i)) ? sym : null
      )
    };
  }
};

/* =========================================================
   NIM
   ========================================================= */
const nim = {
  id: 'nim',
  name: 'Nim',
  icon: '🪙',
  tag: 'Brain Teaser',
  desc: 'Take any number of tokens from one pile. Whoever takes the last token wins.',

  createState() {
    return { piles: [3, 5, 7], turn: 0, winner: null, ply: 0 };
  },

  applyMove(state, player, move) {
    if (state.winner !== null) return { error: 'The game is already over.' };
    if (state.turn !== player) return { error: 'It is not your turn.' };

    const { pile, take } = move || {};
    if (!Number.isInteger(pile) || pile < 0 || pile >= state.piles.length) {
      return { error: 'Invalid pile.' };
    }
    if (!Number.isInteger(take) || take < 1 || take > state.piles[pile]) {
      return { error: 'Invalid number of tokens.' };
    }

    const s = clone(state);
    s.piles[pile] -= take;
    s.ply++;

    if (s.piles.every(n => n === 0)) {
      s.winner = player;
    } else {
      s.turn = 1 - player;
    }

    return { state: s };
  },

  view: (s) => s
};

/* =========================================================
   REGISTRY
   ========================================================= */
const GAMES = { tictactoe, connect4, dots, memory, nim };

function getGame(id) { return GAMES[id] || null; }
function listGames() {
  return Object.values(GAMES).map(g => ({
    id: g.id, name: g.name, icon: g.icon, tag: g.tag, desc: g.desc
  }));
}

module.exports = { GAMES, getGame, listGames };
