// Procedural pixel-art renderer. Every tile/character is drawn as a 16x16
// "pixel grid" using filled rectangles (classic pixel-art technique), then
// scaled crisply (image smoothing off) to whatever on-screen tile size the
// editor/game is using. No bitmap assets required.

const GRID = 16;

// deterministic pseudo-random per cell so grass/stone texture is stable
// across re-renders but still varies tile-to-tile.
function hashRand(x, y, salt = 0) {
  let h = x * 374761393 + y * 668265263 + salt * 982451653;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return ((h >>> 0) % 1000) / 1000;
}

function px(ctx, unit, gx, gy, gw, gh, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(gx * unit), Math.round(gy * unit), Math.ceil(gw * unit) + 0.5, Math.ceil(gh * unit) + 0.5);
}

function fillAll(ctx, unit, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, unit * GRID, unit * GRID);
}

/* ---------------- tile drawers ---------------- */
/* each receives (ctx, size, cellX, cellY) and draws within a size x size box */

function drawGrass(ctx, size, cx, cy, flowers = false) {
  const u = size / GRID;
  fillAll(ctx, u, "#3f8f46");
  // mottled darker clumps
  for (let i = 0; i < 10; i++) {
    const r = hashRand(cx, cy, i);
    const r2 = hashRand(cx, cy, i + 50);
    if (r > 0.55) {
      const gx = Math.floor(r2 * GRID);
      const gy = Math.floor(hashRand(cx, cy, i + 99) * GRID);
      px(ctx, u, gx, gy, 2, 1, "#357a3b");
    }
  }
  for (let i = 0; i < 6; i++) {
    const r = hashRand(cx, cy, i + 200);
    if (r > 0.6) {
      const gx = Math.floor(hashRand(cx, cy, i + 220) * GRID);
      const gy = Math.floor(hashRand(cx, cy, i + 240) * GRID);
      px(ctx, u, gx, gy, 1, 1, "#4ea854");
    }
  }
  if (flowers) {
    const colors = ["#ffd166", "#ef6f6c", "#f7f7f7"];
    for (let i = 0; i < 3; i++) {
      const r = hashRand(cx, cy, i + 300);
      if (r > 0.4) {
        const gx = Math.floor(hashRand(cx, cy, i + 310) * (GRID - 2)) + 1;
        const gy = Math.floor(hashRand(cx, cy, i + 320) * (GRID - 2)) + 1;
        const c = colors[Math.floor(hashRand(cx, cy, i + 330) * colors.length)];
        px(ctx, u, gx, gy, 1, 1, c);
        px(ctx, u, gx, gy - 1, 1, 1, "#2f6b35");
      }
    }
  }
}

function drawDirt(ctx, size, cx, cy) {
  const u = size / GRID;
  fillAll(ctx, u, "#c79a5e");
  for (let i = 0; i < 14; i++) {
    const r = hashRand(cx, cy, i + 400);
    const gx = Math.floor(hashRand(cx, cy, i + 410) * GRID);
    const gy = Math.floor(hashRand(cx, cy, i + 420) * GRID);
    const c = r > 0.5 ? "#b3854c" : "#d9b27c";
    px(ctx, u, gx, gy, 1, 1, c);
  }
}

function drawWater(ctx, size, cx, cy, t = 0) {
  const u = size / GRID;
  fillAll(ctx, u, "#3b7ea1");
  for (let row = 0; row < GRID; row += 4) {
    const off = Math.floor((Math.sin(t / 300 + row + cx + cy) + 1) * 2);
    px(ctx, u, off, row + 1, 6, 1, "#5fa6c7");
    px(ctx, u, off + 8, row + 2, 5, 1, "#4a8fb3");
  }
}

function drawStoneWall(ctx, size, cx, cy) {
  const u = size / GRID;
  fillAll(ctx, u, "#6b6b73");
  ctx.fillStyle = "#54545c";
  // brick mortar lines
  for (let row = 0; row < GRID; row += 4) {
    px(ctx, u, 0, row, GRID, 1, "#4a4a52");
  }
  const offsetRows = [4, 12];
  offsetRows.forEach((row) => px(ctx, u, 8, row, 1, 4, "#4a4a52"));
  [0, 8].forEach((row) => px(ctx, u, 0, row + 0, 1, 0, "transparent"));
  px(ctx, u, 0, 0, 1, 4, "#4a4a52");
  px(ctx, u, 8, 8, 1, 4, "#4a4a52");
  // highlight specks
  for (let i = 0; i < 8; i++) {
    const gx = Math.floor(hashRand(cx, cy, i + 500) * GRID);
    const gy = Math.floor(hashRand(cx, cy, i + 510) * GRID);
    px(ctx, u, gx, gy, 1, 1, "#7c7c84");
  }
}

function drawTreeBase(ctx, size, cx, cy) {
  // ground beneath the tree (grass) + trunk + canopy overflowing upward
  const u = size / GRID;
  drawGrass(ctx, size, cx, cy);
  // trunk
  px(ctx, u, 6, 10, 4, 6, "#5a3a22");
  px(ctx, u, 6, 10, 1, 6, "#3f2716");
  // canopy (drawn extending above the tile box for height)
  ctx.save();
  ctx.translate(0, -size * 0.9);
  ctx.fillStyle = "#2f6b35";
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.55, size * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3c8a45";
  ctx.beginPath();
  ctx.arc(size * 0.38, size * 0.42, size * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4ea854";
  ctx.beginPath();
  ctx.arc(size * 0.58, size * 0.35, size * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBush(ctx, size, cx, cy) {
  const u = size / GRID;
  drawGrass(ctx, size, cx, cy);
  ctx.fillStyle = "#2f6b35";
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.55, size * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4ea854";
  ctx.beginPath();
  ctx.arc(size * 0.38, size * 0.46, size * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawWoodFloor(ctx, size, cx, cy) {
  const u = size / GRID;
  fillAll(ctx, u, "#9c6b3f");
  for (let row = 0; row < GRID; row += 4) {
    px(ctx, u, 0, row, GRID, 1, "#7e5530");
  }
  for (let i = 0; i < 4; i++) {
    const gx = Math.floor(hashRand(cx, cy, i + 600) * GRID);
    px(ctx, u, gx, 0, 1, GRID, "#8a6238");
  }
}

function drawWoodWall(ctx, size, cx, cy) {
  const u = size / GRID;
  fillAll(ctx, u, "#5a3a22");
  for (let row = 0; row < GRID; row += 3) {
    px(ctx, u, 0, row, GRID, 1, "#462c19");
  }
  px(ctx, u, 0, 0, GRID, 2, "#6b4527");
}

function drawFence(ctx, size, cx, cy) {
  const u = size / GRID;
  drawGrass(ctx, size, cx, cy);
  px(ctx, u, 2, 4, 2, 10, "#7e5530");
  px(ctx, u, 11, 4, 2, 10, "#7e5530");
  px(ctx, u, 1, 7, 13, 2, "#6b4527");
}

function drawVoid(ctx, size) {
  fillAll(ctx, size / GRID, "#15151a");
}

export const TILES = [
  { id: "grass", name: "Grass", collidable: false, layer: "ground", draw: (ctx, s, x, y) => drawGrass(ctx, s, x, y, false) },
  { id: "grass_flower", name: "Grass + Flowers", collidable: false, layer: "ground", draw: (ctx, s, x, y) => drawGrass(ctx, s, x, y, true) },
  { id: "dirt", name: "Dirt Path", collidable: false, layer: "ground", draw: drawDirt },
  { id: "water", name: "Water", collidable: true, layer: "ground", draw: (ctx, s, x, y, t) => drawWater(ctx, s, x, y, t) },
  { id: "stone_wall", name: "Stone Wall", collidable: true, layer: "object", draw: drawStoneWall },
  { id: "tree", name: "Tree", collidable: true, layer: "object", tall: true, draw: drawTreeBase },
  { id: "bush", name: "Bush", collidable: true, layer: "object", draw: drawBush },
  { id: "wood_floor", name: "Cabin Floor", collidable: false, layer: "ground", draw: drawWoodFloor },
  { id: "wood_wall", name: "Cabin Wall", collidable: true, layer: "object", draw: drawWoodWall },
  { id: "fence", name: "Fence", collidable: true, layer: "object", draw: drawFence },
  { id: "void", name: "Erase", collidable: false, layer: "ground", draw: (ctx, s) => drawVoid(ctx, s) },
];

export const TILE_MAP = Object.fromEntries(TILES.map((t) => [t.id, t]));

/* ---------------- character drawer ---------------- */
// dir: 'down' | 'up' | 'left' | 'right'   frame: 0..3 walk cycle
export function drawCharacter(ctx, size, dir, frame, hue = "#c0463a") {
  const u = size / GRID;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const bob = [0, -1, 0, -1][frame % 4];
  const legSwing = [0, 1, 0, -1][frame % 4];

  ctx.translate(0, bob * u);

  if (dir === "left") {
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
  }

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(size * 0.5, size * 0.92, size * 0.28, size * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  // legs
  px(ctx, u, 6 - legSwing, 12, 2, 3, "#3a2a22");
  px(ctx, u, 9 + legSwing, 12, 2, 3, "#3a2a22");

  // body/tunic
  px(ctx, u, 5, 7, 7, 6, hue);
  px(ctx, u, 5, 7, 1, 6, shade(hue, -20));
  px(ctx, u, 11, 7, 1, 6, shade(hue, -20));

  // arms
  px(ctx, u, 4, 8, 1, 4, hue);
  px(ctx, u, 12, 8, 1, 4, hue);

  // belt
  px(ctx, u, 5, 11, 7, 1, "#5a3a22");

  if (dir === "up") {
    // back of head, hide face
    px(ctx, u, 5, 2, 7, 6, "#7a4530");
  } else {
    // head
    px(ctx, u, 5, 2, 7, 6, "#f0c79a");
    // hair
    px(ctx, u, 5, 1, 7, 2, "#7a4530");
    px(ctx, u, 4, 2, 1, 3, "#7a4530");
    px(ctx, u, 12, 2, 1, 3, "#7a4530");
    if (dir !== "up") {
      // eyes (front-ish for down/left/right)
      const eyeX = dir === "right" ? 9 : 6;
      px(ctx, u, eyeX, 5, 1, 1, "#2a2a2a");
      if (dir === "down") px(ctx, u, 9, 5, 1, 1, "#2a2a2a");
    }
  }

  ctx.restore();
}

function shade(hex, amt) {
  const v = hex.replace("#", "");
  const num = parseInt(v, 16);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0xff) + amt;
  let b = (num & 0xff) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}
