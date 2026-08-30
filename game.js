'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - azul pálido
  '#ffb74d', // L - orange
  '#b0bec5', // N - tuerca (gris metálico)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca (3x3 con agujero)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');

const THEME_KEY = 'tetris-theme';
const GRID_COLOR_DARK = '#22222e';
const GRID_COLOR_LIGHT = '#d5d5e6';

// ---- Motor de skins ----
// Cada skin define su propia paleta de colores, color de rejilla y
// (opcionalmente) fondo de tablero fijo, glow, esquinas redondeadas o textura.
const SKIN_KEY = 'tetris-skin';

const SKINS = {
  retro: {
    label: 'Retro',
    colors: COLORS,
    gridColorDark: GRID_COLOR_DARK,
    gridColorLight: GRID_COLOR_LIGHT,
  },
  neon: {
    label: 'Neon',
    colors: [
      null,
      '#00fff2', // I
      '#faff00', // O
      '#ff00e6', // T
      '#00ff5e', // S
      '#ff003c', // Z
      '#00aaff', // J
      '#ff8800', // L
      '#ffffff', // N
    ],
    gridColorDark: '#0d3333',
    gridColorLight: '#0d3333',
    boardBackground: { dark: '#000000', light: '#000000' },
    glow: true,
  },
  pastel: {
    label: 'Pastel',
    colors: [
      null,
      '#aee8e0', // I
      '#fff2b3', // O
      '#e3c6f2', // T
      '#c8e6c0', // S
      '#f7c6c6', // Z
      '#c6dcf7', // J
      '#f7d9b0', // L
      '#dcdce0', // N
    ],
    gridColorDark: '#3a3a48',
    gridColorLight: '#e6e6f0',
    rounded: true,
  },
  pixel: {
    label: 'Pixel art',
    colors: [
      null,
      '#3cbcfc', // I
      '#f8b800', // O
      '#b800f8', // T
      '#00b800', // S
      '#f83800', // Z
      '#0058f8', // J
      '#fca044', // L
      '#a8a8a8', // N
    ],
    gridColorDark: GRID_COLOR_DARK,
    gridColorLight: GRID_COLOR_LIGHT,
    texture: 'pixel',
  },
};

let currentSkin = 'retro';

function setSkin(skin) {
  currentSkin = SKINS[skin] ? skin : 'retro';
  skinSelect.value = currentSkin;
  if (current) draw();
  if (next) drawNext();
}

function initSkin() {
  const saved = localStorage.getItem(SKIN_KEY);
  setSkin(saved && SKINS[saved] ? saved : 'retro');
}

skinSelect.addEventListener('change', () => {
  localStorage.setItem(SKIN_KEY, skinSelect.value);
  setSkin(skinSelect.value);
});

let board, holes, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function setTheme(theme) {
  document.body.classList.toggle('light-theme', theme === 'light');
  themeToggle.checked = theme === 'light';
  if (current) draw();
  if (next) drawNext();
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  setTheme(saved === 'light' ? 'light' : 'dark');
}

themeToggle.addEventListener('change', () => {
  const theme = themeToggle.checked ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, theme);
  setTheme(theme);
});

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function createHoles() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
  if (current.type === 8) {
    holes[current.y + 1][current.x + 1] = true;
  }
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      holes.splice(r, 1);
      holes.unshift(new Array(COLS).fill(false));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  if (gameOver) return;
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
    return;
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawRoundedRect(context, x, y, w, h, r) {
  if (typeof context.roundRect === 'function') {
    context.beginPath();
    context.roundRect(x, y, w, h, r);
    return;
  }
  // Fallback manual con arcTo para navegadores sin roundRect
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawPixelTexture(context, px, py, s) {
  const step = s / 4;
  context.strokeStyle = 'rgba(0,0,0,0.25)';
  context.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    context.beginPath();
    context.moveTo(px + i * step, py);
    context.lineTo(px + i * step, py + s);
    context.stroke();
    context.beginPath();
    context.moveTo(px, py + i * step);
    context.lineTo(px + s, py + i * step);
    context.stroke();
  }
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[currentSkin];
  const color = skin.colors[colorIndex];
  const px = x * size + 1;
  const py = y * size + 1;
  const s = size - 2;
  context.globalAlpha = alpha ?? 1;
  if (skin.glow) {
    context.shadowBlur = 12;
    context.shadowColor = color;
  }
  context.fillStyle = color;
  if (skin.rounded) {
    drawRoundedRect(context, px, py, s, s, size * 0.25);
    context.fill();
  } else {
    context.fillRect(px, py, s, s);
  }
  if (skin.glow) {
    // reset inmediato del shadow para no afectar al resto del dibujado (canvas es estado compartido)
    context.shadowBlur = 0;
    context.shadowColor = 'transparent';
  }
  // highlight (recortado a la forma del bloque para respetar esquinas redondeadas)
  context.save();
  if (skin.rounded) {
    drawRoundedRect(context, px, py, s, s, size * 0.25);
    context.clip();
  }
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(px, py, s, 4);
  context.restore();
  if (skin.texture === 'pixel') drawPixelTexture(context, px, py, s);
  context.globalAlpha = 1;
}

function drawHole(context, x, y, size, alpha) {
  const skin = SKINS[currentSkin];
  const isLight = document.body.classList.contains('light-theme');
  context.globalAlpha = alpha ?? 1;
  if (skin.glow) {
    context.shadowBlur = 10;
    context.shadowColor = skin.colors[8];
  }
  context.beginPath();
  context.arc(x * size + size / 2, y * size + size / 2, size * 0.32, 0, Math.PI * 2);
  context.fillStyle = isLight ? '#ffffff' : '#1a1a25';
  context.fill();
  context.strokeStyle = skin.colors[8];
  context.lineWidth = 2;
  context.stroke();
  if (skin.glow) {
    context.shadowBlur = 0;
    context.shadowColor = 'transparent';
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  const skin = SKINS[currentSkin];
  const isLight = document.body.classList.contains('light-theme');
  if (skin.boardBackground) {
    ctx.fillStyle = isLight ? skin.boardBackground.light : skin.boardBackground.dark;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.strokeStyle = isLight ? skin.gridColorLight : skin.gridColorDark;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      drawBlock(ctx, c, r, board[r][c], BLOCK);
      if (holes[r][c]) drawHole(ctx, c, r, BLOCK);
    }

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);
  if (current.type === 8) drawHole(ctx, current.x + 1, gy + 1, BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  if (current.type === 8) drawHole(ctx, current.x + 1, current.y + 1, BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
  if (next.type === 8) drawHole(nextCtx, offX + 1, offY + 1, NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  animId = null;
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  holes = createHoles();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

initTheme();
initSkin();
init();
