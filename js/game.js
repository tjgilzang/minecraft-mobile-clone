const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d');
const particleCanvas = document.getElementById('particle-layer');
const particleCtx = particleCanvas?.getContext('2d');
const hudStage = document.getElementById('hud-stage');
const hudStamina = document.getElementById('hud-stamina');
const hudCoords = document.getElementById('hud-coords');
const hudBlocks = document.getElementById('hud-blocks');
const hudLightValue = document.getElementById('hud-light-value');
const hudLightFill = document.getElementById('hud-light-fill');
const hudFocusValue = document.getElementById('hud-focus-value');
const hudFocusFill = document.getElementById('hud-focus-fill');
const hudPulseValue = document.getElementById('hud-pulse-value');
const hudPulseFill = document.getElementById('hud-pulse-fill');
const overlay = document.getElementById('overlay');
const joystickEl = document.getElementById('joystick');
const joystickKnob = document.getElementById('joystick-knob');
const jumpBtn = document.getElementById('jump-btn');
const interactBtn = document.getElementById('interact-btn');
const placeBtn = document.getElementById('place-btn');
const controlGuide = document.querySelector('.control-guide');
const lightGrid = document.querySelector('.lightening-grid');
const ambientPulse = document.querySelector('.ambient-pulse');

const TILE_SIZE = 18;
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const COLS = Math.floor(WIDTH / TILE_SIZE);
const ROWS = Math.floor(HEIGHT / TILE_SIZE);
const LIGHT_RADIUS = 4;

const palette = {
  grass: '#173f18',
  stone: '#2d3142',
  ore: '#9dedff',
  air: '#01030c',
};

const particles = [];
const MAX_PARTICLES = 45;

let grid = [];
let stage = 1;
let blocksCleared = 0;
let stamina = 100;
let focusDecay = 0;

const player = {
  x: 3,
  y: 3,
  dir: { x: 1, y: 0 },
  stamina: 100,
  blocksPlaced: 0,
  highlight: 0,
};

const input = {
  dx: 0,
  dy: 0,
  interact: false,
  place: false,
  jump: false,
};

function makeGrid() {
  const newGrid = [];
  const oreFrequency = 0.12 + stage * 0.004;
  for (let y = 0; y < ROWS; y += 1) {
    const row = [];
    for (let x = 0; x < COLS; x += 1) {
      const rnd = Math.random();
      let type = 'stone';
      if (y === 0 || x === 0 || y === ROWS - 1 || x === COLS - 1 || rnd < 0.15) {
        type = 'grass';
      }
      if (rnd > 0.8 && Math.random() < oreFrequency) {
        type = 'ore';
      }
      row.push({ type, durability: type === 'ore' ? 3 : 2 });
    }
    newGrid.push(row);
  }
  return newGrid;
}

function resetStage(clearStats = false) {
  grid = makeGrid();
  stage += clearStats ? 0 : 1;
  player.highlight = 0;
  overlay.classList.remove('is-visible');
  focusDecay = 0;
  refreshControlGuide();
}

function showOverlay(message) {
  overlay.textContent = message;
  overlay.classList.add('is-visible');
  setTimeout(() => overlay.classList.remove('is-visible'), 2200);
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

function getTile(x, y) {
  if (!grid[y] || !grid[y][x]) return null;
  return grid[y][x];
}

function updateInputs() {
  if (input.dx !== 0 || input.dy !== 0) {
    const speed = 0.11 + stage * 0.01;
    player.x = clamp(player.x + input.dx * speed, 1, COLS - 2);
    player.y = clamp(player.y + input.dy * speed, 1, ROWS - 2);
    player.dir = { x: input.dx || player.dir.x, y: input.dy || player.dir.y };
    stamina = Math.max(0, stamina - 0.14);
    focusDecay += 0.02;
  } else {
    stamina = clamp(stamina + 0.4, 0, 100);
    focusDecay = Math.max(0, focusDecay - 0.02);
  }

  if (stamina < 15 && player.highlight < 1) {
    player.highlight += 0.02;
  } else if (stamina > 30 && player.highlight > 0) {
    player.highlight = Math.max(0, player.highlight - 0.02);
  }
}

function mineTile() {
  const px = Math.floor(player.x);
  const py = Math.floor(player.y);
  const tile = getTile(px, py);
  if (!tile || tile.type === 'air') return;
  tile.durability -= tile.type === 'ore' ? 1.5 : 1;
  if (tile.durability <= 0) {
    tile.type = 'air';
    blocksCleared += 1;
    player.blocksPlaced = Math.max(0, player.blocksPlaced - 1);
  }
  focusDecay = Math.min(1, focusDecay + 0.2);
  stamina = clamp(stamina - 1.5, 0, 100);
}

function placeBlock() {
  const targetX = clamp(Math.floor(player.x + player.dir.x), 1, COLS - 2);
  const targetY = clamp(Math.floor(player.y + player.dir.y), 1, ROWS - 2);
  const tile = getTile(targetX, targetY);
  if (!tile || tile.type !== 'air') return;
  tile.type = 'stone';
  tile.durability = 2;
  player.blocksPlaced += 1;
  focusDecay = Math.min(1, focusDecay + 0.15);
}

function ensureAirAhead() {
  const targetX = clamp(Math.floor(player.x + player.dir.x), 1, COLS - 2);
  const targetY = clamp(Math.floor(player.y + player.dir.y), 1, ROWS - 2);
  const tile = getTile(targetX, targetY);
  if (tile) {
    tile.type = 'air';
    tile.durability = 0;
  }
}

function faceDirection(x, y) {
  player.dir = { x, y };
}

function jumpAction() {
  const jumpBoost = 0.6;
  player.x = clamp(player.x + player.dir.x * jumpBoost, 1, COLS - 2);
  player.y = clamp(player.y + player.dir.y * jumpBoost, 1, ROWS - 2);
  stamina = clamp(stamina - 3, 0, 100);
  showOverlay('Jump Ignite');
}

function checkStageClear() {
  const minedCount = grid.flat().filter((cell) => cell.type === 'air').length;
  if (minedCount >= COLS * ROWS * 0.7) {
    stage += 1;
    grid = makeGrid();
    player.highlight = 1;
    showOverlay('Stage ' + String(stage).padStart(2, '0'));
    refreshControlGuide();
  }
}

function lighten(hex, factor) {
  const num = parseInt(hex.slice(1), 16);
  const r = ((num >> 16) & 0xff) + Math.floor((255 - ((num >> 16) & 0xff)) * factor);
  const g = ((num >> 8) & 0xff) + Math.floor((255 - ((num >> 8) & 0xff)) * factor);
  const b = (num & 0xff) + Math.floor((255 - (num & 0xff)) * factor);
  return `rgb(${clamp(r, 0, 255)}, ${clamp(g, 0, 255)}, ${clamp(b, 0, 255)})`;
}

function drawGrid() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  const lightFade = focusDecay * 0.3;
  const timePulse = (Math.sin(performance.now() * 0.002) + 1) * 0.5 * 0.12;
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const tile = grid[y][x];
      const distance = Math.hypot(player.x - x, player.y - y);
      const brightness = Math.max(0, 1 - distance / LIGHT_RADIUS) * (1 - lightFade);
      const base = palette[tile.type] || palette.air;
      const textured = Math.min(1, brightness * 0.55 + timePulse);
      ctx.fillStyle = lighten(base, textured);
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      if (tile.type !== 'air' && tile.durability !== undefined) {
        ctx.fillStyle = `rgba(255,255,255,${(tile.durability / 3) * 0.15})`;
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }
}

function drawPlayer() {
  const px = player.x * TILE_SIZE;
  const py = player.y * TILE_SIZE;
  const radius = TILE_SIZE * 0.35;
  const gradient = ctx.createRadialGradient(px, py, radius * 0.2, px, py, radius);
  gradient.addColorStop(0, '#ffe955');
  gradient.addColorStop(1, player.highlight > 0 ? '#ffc167' : '#edb900');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(px, py, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#fff7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, py, radius + 2, 0, Math.PI * 2);
  ctx.stroke();
}

function updateHUD() {
  if (hudStage) hudStage.textContent = String(stage).padStart(2, '0');
  if (hudStamina) hudStamina.textContent = `${Math.round(stamina)}%`;
  if (hudCoords) hudCoords.textContent = `(${player.x.toFixed(1)}, ${player.y.toFixed(1)})`;
  if (hudBlocks) hudBlocks.textContent = `${blocksCleared + player.blocksPlaced}`;

  const lightIntensity = clamp(1 - focusDecay * 0.9, 0, 1);
  const focusIntensity = clamp(1 - focusDecay, 0, 1);
  if (hudLightValue) hudLightValue.textContent = `${Math.round(lightIntensity * 100)}%`;
  if (hudLightFill) hudLightFill.style.width = `${lightIntensity * 100}%`;
  if (hudFocusValue) hudFocusValue.textContent = `${Math.round(focusIntensity * 100)}%`;
  if (hudFocusFill) hudFocusFill.style.width = `${focusIntensity * 100}%`;

  updatePulseMeter();
}

function updatePulseMeter() {
  if (!hudPulseValue || !hudPulseFill) return;
  const rawPulse = clamp((focusDecay * 90) + stage * 4, 10, 100);
  const level = Math.min(4, Math.max(1, Math.ceil(rawPulse / 25)));
  hudPulseValue.textContent = `L${level}`;
  hudPulseFill.style.width = `${rawPulse}%`;
}

function refreshControlGuide() {
  if (!controlGuide) return;
  controlGuide.innerHTML = `
    <p class="guide-stage">STAGE ${String(stage).padStart(2, '0')}</p>
    <p>점프: 가운데 버튼</p>
    <p>상호작용: 빠르게 탭</p>
    <p>블록: 길게 누르고 풀기</p>
  `;
}

function spawnParticle() {
  if (!particleCtx || particles.length > MAX_PARTICLES) return;
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.2 + Math.random() * 0.6;
  const colorHue = 190 + Math.random() * 40;
  const particle = {
    x: player.x * TILE_SIZE + (Math.random() - 0.5) * TILE_SIZE * 0.6,
    y: player.y * TILE_SIZE + (Math.random() - 0.5) * TILE_SIZE * 0.6,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 0.05,
    radius: 2 + Math.random() * 3,
    life: 40 + Math.random() * 30,
    alpha: 0.4 + Math.random() * 0.6,
    hue: colorHue,
  };
  particles.push(particle);
}

function updateParticles() {
  if (!particleCtx) return;
  particleCtx.clearRect(0, 0, WIDTH, HEIGHT);
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.life -= 1;
    particle.alpha -= 0.008;
    const gradient = particleCtx.createRadialGradient(
      particle.x,
      particle.y,
      0,
      particle.x,
      particle.y,
      particle.radius
    );
    gradient.addColorStop(0, `rgba(255, 255, 255, ${Math.max(particle.alpha, 0)})`);
    gradient.addColorStop(0.55, `hsla(${particle.hue}, 85%, 75%, ${Math.max(particle.alpha - 0.1, 0)})`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    particleCtx.fillStyle = gradient;
    particleCtx.beginPath();
    particleCtx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    particleCtx.fill();

    if (particle.life <= 0 || particle.alpha <= 0) {
      particles.splice(i, 1);
    }
  }
}

function updateLightFlow() {
  if (!lightGrid) return;
  const drift = Math.sin(performance.now() * 0.002) * 25;
  lightGrid.style.setProperty('--grid-x', `${50 + drift}%`);
}

function updateAmbientPulse() {
  if (!ambientPulse) return;
  const phase = performance.now() * 0.00035;
  const x = 40 + Math.sin(phase + stage * 0.6) * 14;
  const y = 60 + Math.cos(phase * 1.2 + stage * 0.7) * 18;
  const altX = 70 - Math.sin(phase * 0.9) * 12;
  ambientPulse.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(97, 208, 255, 0.42), transparent 52%), radial-gradient(circle at ${altX}% 72%, rgba(255, 204, 95, 0.42), transparent 48%)`;
}

function loop() {
  updateInputs();
  if (input.interact) {
    mineTile();
    input.interact = false;
  }
  if (input.place) {
    placeBlock();
    input.place = false;
  }
  if (input.jump) {
    jumpAction();
    input.jump = false;
  }
  checkStageClear();
  drawGrid();
  if (Math.random() < 0.18 || Math.hypot(input.dx, input.dy) > 0.25) {
    spawnParticle();
  }
  drawPlayer();
  updateParticles();
  updateHUD();
  updateLightFlow();
  updateAmbientPulse();
  requestAnimationFrame(loop);
}

function bindButtons() {
  const toggleState = (button, active) => {
    if (active) button.classList.add('is-pressed');
    else button.classList.remove('is-pressed');
  };
  const trackedButtons = [interactBtn, placeBtn, jumpBtn];
  trackedButtons.forEach((button) => {
    if (!button) return;
    button.addEventListener('pointerdown', () => toggleState(button, true));
    const release = () => toggleState(button, false);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointerleave', release);
    button.addEventListener('pointercancel', release);
  });

  interactBtn.addEventListener('pointerdown', () => {
    input.interact = true;
  });
  placeBtn.addEventListener('pointerdown', () => {
    input.place = true;
  });
  jumpBtn.addEventListener('pointerdown', () => {
    input.jump = true;
  });
}

function bindKeyboard() {
  const keys = new Set();
  window.addEventListener('keydown', (event) => {
    if (keys.has(event.code)) return;
    keys.add(event.code);
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        input.dy = -1;
        break;
      case 'ArrowDown':
      case 'KeyS':
        input.dy = 1;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        input.dx = -1;
        break;
      case 'ArrowRight':
      case 'KeyD':
        input.dx = 1;
        break;
      case 'Space':
        input.jump = true;
        break;
      case 'Enter':
        input.interact = true;
        break;
    }
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
    if (['ArrowUp', 'KeyW', 'ArrowDown', 'KeyS'].includes(event.code)) {
      if (!keys.has('ArrowUp') && !keys.has('KeyW') && !keys.has('ArrowDown') && !keys.has('KeyS')) {
        input.dy = 0;
      }
    }
    if (['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(event.code)) {
      if (!keys.has('ArrowLeft') && !keys.has('KeyA') && !keys.has('ArrowRight') && !keys.has('KeyD')) {
        input.dx = 0;
      }
    }
  });
}

function bindJoystick() {
  let activePointerId = null;
  let center = null;

  const updateCenter = () => {
    const rect = joystickEl.getBoundingClientRect();
    center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  const resetKnob = () => {
    joystickKnob.style.transform = 'translate(0, 0)';
    input.dx = 0;
    input.dy = 0;
  };

  const handlePointer = (clientX, clientY) => {
    if (!center) updateCenter();
    const dx = clientX - center.x;
    const dy = clientY - center.y;
    const distance = Math.min(Math.hypot(dx, dy), 55);
    const angle = Math.atan2(dy, dx);
    joystickKnob.style.transform = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`;
    const normalized = distance / 60;
    input.dx = Math.abs(dx) < 5 ? 0 : Math.cos(angle) * normalized;
    input.dy = Math.abs(dy) < 5 ? 0 : Math.sin(angle) * normalized;
  };

  joystickEl.addEventListener('pointerdown', (event) => {
    activePointerId = event.pointerId;
    joystickEl.setPointerCapture(activePointerId);
    handlePointer(event.clientX, event.clientY);
  });

  joystickEl.addEventListener('pointermove', (event) => {
    if (event.pointerId !== activePointerId) return;
    handlePointer(event.clientX, event.clientY);
  });

  const endPointer = (event) => {
    if (event.pointerId !== activePointerId) return;
    activePointerId = null;
    joystickEl.releasePointerCapture(event.pointerId);
    resetKnob();
  };

  joystickEl.addEventListener('pointerup', endPointer);
  joystickEl.addEventListener('pointerleave', endPointer);
  window.addEventListener('resize', () => {
    resetKnob();
    resizeParticleCanvas();
  });
}

function resizeParticleCanvas() {
  if (!particleCanvas) return;
  particleCanvas.width = canvas.width;
  particleCanvas.height = canvas.height;
}

function createAssets() {
  const textures = document.createElement('style');
  textures.textContent = `
    .canvas-wrapper::before {
      content: '';
      position: absolute;
      inset: 12px;
      border-radius: 22px;
      background-image: linear-gradient(180deg, rgba(255,255,255,0.05), transparent), url('assets/textures/mineral.svg');
      opacity: 0.08;
      pointer-events: none;
      mix-blend-mode: screen;
    }
    .control-grid::before {
      content: '';
      position: absolute;
      inset: -10px;
      border-radius: 32px;
      background: radial-gradient(circle, rgba(89,214,255,0.08), transparent 65%);
      pointer-events: none;
      mix-blend-mode: screen;
      opacity: 0.6;
    }
  `;
  document.head.appendChild(textures);
}

window.__gameBridge = {
  ensureAirAhead,
  faceDirection,
  getState: () => ({
    stage,
    blocksCleared,
    focusDecay,
    player: { ...player },
  }),
};

function init() {
  grid = makeGrid();
  resizeParticleCanvas();
  createAssets();
  bindButtons();
  bindKeyboard();
  bindJoystick();
  refreshControlGuide();
  loop();
}

init();
