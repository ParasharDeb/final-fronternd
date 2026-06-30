"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { TILES, TILE_MAP, drawCharacter } from "../lib/tiles";

const COLS = 16;
const ROWS = 16;
const STORAGE_KEY = "pixel-tile-builder-map-v1";

function defaultMap() {
  const ground = Array.from({ length: ROWS }, () => Array(COLS).fill("grass"));
  const object = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

  // a little starter scene: stone border, a dirt path, a small cabin footprint
  for (let x = 0; x < COLS; x++) {
    object[0][x] = "stone_wall";
    object[ROWS - 1][x] = "stone_wall";
  }
  for (let y = 0; y < ROWS; y++) {
    object[y][0] = "stone_wall";
    object[y][COLS - 1] = "stone_wall";
  }
  for (let x = 4; x < COLS - 4; x++) ground[ROWS - 4][x] = "dirt";
  for (let y = 3; y < ROWS - 3; y++) {
    if (Math.random() > 0.7) object[y][2] = "tree";
    if (Math.random() > 0.7) object[y][COLS - 3] = "tree";
  }
  ground[3][3] = "grass_flower";
  ground[3][12] = "grass_flower";
  object[6][6] = "wood_wall";
  object[6][7] = "wood_wall";
  object[6][8] = "wood_wall";
  for (let x = 6; x <= 8; x++) ground[7][x] = "wood_floor";
  object[5][7] = "bush";

  return { width: COLS, height: ROWS, ground, object };
}

export default function Builder() {
  const [map, setMap] = useState(null);
  const [mode, setMode] = useState("edit"); // edit | play
  const [selectedTile, setSelectedTile] = useState("grass");
  const [tileSize, setTileSize] = useState(32);
  const canvasRef = useRef(null);
  const painting = useRef(false);
  const fileInputRef = useRef(null);

  // player state for play mode (kept in a ref so the rAF loop is fast)
  const playerRef = useRef({ x: 8, y: 8, dir: "down", frame: 0, frameT: 0, moving: false });
  const keysRef = useRef({});

  // ---------- load / persist ----------
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      setMap(saved ? JSON.parse(saved) : defaultMap());
    } catch {
      setMap(defaultMap());
    }
  }, []);

  useEffect(() => {
    if (!map) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
      } catch {}
    }, 300);
    return () => clearTimeout(id);
  }, [map]);

  const tileAt = useCallback(
    (gx, gy) => {
      if (!map || gx < 0 || gy < 0 || gx >= map.width || gy >= map.height) return null;
      return { ground: map.ground[gy][gx], object: map.object[gy][gx] };
    },
    [map]
  );

  const isCollidable = useCallback(
    (gx, gy) => {
      const t = tileAt(gx, gy);
      if (!t) return true; // out of bounds
      const objDef = t.object ? TILE_MAP[t.object] : null;
      const groundDef = TILE_MAP[t.ground];
      if (objDef?.collidable) return true;
      if (groundDef?.collidable) return true;
      return false;
    },
    [tileAt]
  );

  // ---------- painting ----------
  const paintCell = useCallback(
    (gx, gy) => {
      setMap((prev) => {
        if (!prev || gx < 0 || gy < 0 || gx >= prev.width || gy >= prev.height) return prev;
        const def = TILE_MAP[selectedTile];
        const next = {
          ...prev,
          ground: prev.ground.map((row) => row.slice()),
          object: prev.object.map((row) => row.slice()),
        };
        if (def.id === "void") {
          next.object[gy][gx] = null;
        } else if (def.layer === "object") {
          next.object[gy][gx] = def.id;
        } else {
          next.ground[gy][gx] = def.id;
        }
        return next;
      });
    },
    [selectedTile]
  );

  const cellFromEvent = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    return { gx: Math.floor(x / tileSize), gy: Math.floor(y / tileSize) };
  };

  // ---------- play mode input ----------
  useEffect(() => {
    if (mode !== "play") return;
    const down = (e) => (keysRef.current[e.key.toLowerCase()] = true);
    const up = (e) => (keysRef.current[e.key.toLowerCase()] = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [mode]);

  // ---------- render loop (handles both edit static draw + play animation) ----------
  useEffect(() => {
    if (!map) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    canvas.width = map.width * tileSize;
    canvas.height = map.height * tileSize;

    let raf;
    let last = performance.now();
    const PLAYER_SPEED = 4.2; // tiles/sec

    function step(t) {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;

      if (mode === "play") {
        const p = playerRef.current;
        let dx = 0,
          dy = 0;
        const k = keysRef.current;
        if (k["arrowup"] || k["w"]) dy -= 1;
        if (k["arrowdown"] || k["s"]) dy += 1;
        if (k["arrowleft"] || k["a"]) dx -= 1;
        if (k["arrowright"] || k["d"]) dx += 1;

        p.moving = dx !== 0 || dy !== 0;
        if (dx !== 0 && dy !== 0) {
          dx *= 0.7071;
          dy *= 0.7071;
        }
        if (dx > 0) p.dir = "right";
        else if (dx < 0) p.dir = "left";
        else if (dy > 0) p.dir = "down";
        else if (dy < 0) p.dir = "up";

        const nx = p.x + dx * PLAYER_SPEED * dt;
        const ny = p.y + dy * PLAYER_SPEED * dt;

        // collide on a small feet box, axis-separated so sliding along walls feels right
        const feetOffsetY = 0.35;
        if (!isCollidable(Math.floor(nx), Math.floor(p.y + feetOffsetY))) p.x = nx;
        if (!isCollidable(Math.floor(p.x), Math.floor(ny + feetOffsetY))) p.y = ny;

        if (p.moving) {
          p.frameT += dt;
          if (p.frameT > 0.12) {
            p.frameT = 0;
            p.frame = (p.frame + 1) % 4;
          }
        } else {
          p.frame = 0;
        }
      }

      draw(ctx, t);
      raf = requestAnimationFrame(step);
    }

    function draw(ctx, t) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // ground layer
      for (let gy = 0; gy < map.height; gy++) {
        for (let gx = 0; gx < map.width; gx++) {
          const id = map.ground[gy][gx];
          const def = TILE_MAP[id] || TILE_MAP.grass;
          ctx.save();
          ctx.translate(gx * tileSize, gy * tileSize);
          def.draw(ctx, tileSize, gx, gy, t);
          ctx.restore();
        }
      }

      // object layer + player, sorted by row so tall trees can overlap the player correctly
      const drawables = [];
      for (let gy = 0; gy < map.height; gy++) {
        for (let gx = 0; gx < map.width; gx++) {
          const id = map.object[gy][gx];
          if (!id) continue;
          const def = TILE_MAP[id];
          drawables.push({
            sortY: gy + 1,
            draw: () => {
              ctx.save();
              ctx.translate(gx * tileSize, gy * tileSize);
              def.draw(ctx, tileSize, gx, gy, t);
              ctx.restore();
            },
          });
        }
      }
      if (mode === "play") {
        const p = playerRef.current;
        drawables.push({
          sortY: p.y + 1,
          draw: () => {
            ctx.save();
            ctx.translate(p.x * tileSize, (p.y - 0.5) * tileSize);
            drawCharacter(ctx, tileSize, p.dir, p.frame);
            ctx.restore();
          },
        });
      }
      drawables.sort((a, b) => a.sortY - b.sortY);
      drawables.forEach((d) => d.draw());

      // edit-mode grid overlay
      if (mode === "edit") {
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 1;
        for (let gx = 0; gx <= map.width; gx++) {
          ctx.beginPath();
          ctx.moveTo(gx * tileSize, 0);
          ctx.lineTo(gx * tileSize, map.height * tileSize);
          ctx.stroke();
        }
        for (let gy = 0; gy <= map.height; gy++) {
          ctx.beginPath();
          ctx.moveTo(0, gy * tileSize);
          ctx.lineTo(map.width * tileSize, gy * tileSize);
          ctx.stroke();
        }
      }
    }

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [map, mode, tileSize, isCollidable]);

  // ---------- pointer handlers for editor ----------
  const onPointerDown = (e) => {
    if (mode !== "edit") return;
    painting.current = true;
    const { gx, gy } = cellFromEvent(e, canvasRef.current);
    paintCell(gx, gy);
  };
  const onPointerMove = (e) => {
    if (mode !== "edit" || !painting.current) return;
    const { gx, gy } = cellFromEvent(e, canvasRef.current);
    paintCell(gx, gy);
  };
  const stopPaint = () => (painting.current = false);

  // ---------- import/export ----------
  const exportMap = () => {
    const blob = new Blob([JSON.stringify(map, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "map.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const importMap = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (parsed.width && parsed.height && parsed.ground && parsed.object) {
          setMap(parsed);
        }
      } catch {
        alert("Invalid map file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };
  const resetMap = () => {
    if (confirm("Reset to the starter scene? This discards your current map.")) {
      setMap(defaultMap());
    }
  };

  const groundTiles = useMemo(() => TILES.filter((t) => t.layer === "ground" && t.id !== "void"), []);
  const objectTiles = useMemo(() => TILES.filter((t) => t.layer === "object"), []);
  const eraseTile = useMemo(() => TILES.find((t) => t.id === "void"), []);

  if (!map) return null;

  return (
    <div style={{ display: "flex", minHeight: "100vh", color: "#eee" }}>
      <aside
        style={{
          width: 220,
          background: "#222227",
          padding: 14,
          borderRight: "1px solid #333",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div>
          <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>Pixel Tile Builder</h2>
          <p style={{ fontSize: 12, color: "#9a9aa5", margin: 0 }}>
            Procedural pixel-art tiles — no image assets needed.
          </p>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <ModeButton active={mode === "edit"} onClick={() => setMode("edit")}>
            ✏️ Edit
          </ModeButton>
          <ModeButton active={mode === "play"} onClick={() => setMode("play")}>
            ▶️ Play
          </ModeButton>
        </div>

        {mode === "edit" && (
          <>
            <Section title="Ground">
              <Palette tiles={groundTiles} selected={selectedTile} onSelect={setSelectedTile} />
            </Section>
            <Section title="Objects">
              <Palette tiles={objectTiles} selected={selectedTile} onSelect={setSelectedTile} />
            </Section>
            <Section title="Tools">
              <Palette tiles={[eraseTile]} selected={selectedTile} onSelect={setSelectedTile} />
            </Section>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <SmallButton onClick={exportMap}>⬇️ Export map.json</SmallButton>
              <SmallButton onClick={() => fileInputRef.current?.click()}>⬆️ Import map.json</SmallButton>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                onChange={importMap}
                style={{ display: "none" }}
              />
              <SmallButton onClick={resetMap} danger>
                ↺ Reset scene
              </SmallButton>
            </div>
          </>
        )}

        {mode === "play" && (
          <div style={{ fontSize: 12, color: "#9a9aa5", lineHeight: 1.6 }}>
            <b style={{ color: "#eee" }}>Controls</b>
            <br />
            WASD / Arrow keys to move.
            <br />
            Trees, walls, fences, bushes and water block movement.
            <br />
            <br />
            Switch back to <b style={{ color: "#eee" }}>Edit</b> any time to keep building.
          </div>
        )}
      </aside>

      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0e0e12",
          padding: 24,
          overflow: "auto",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            imageRendering: "pixelated",
            boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
            cursor: mode === "edit" ? "crosshair" : "default",
            maxWidth: "100%",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={stopPaint}
          onPointerLeave={stopPaint}
        />
      </main>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: "#9a9aa5", marginBottom: 6 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Palette({ tiles, selected, onSelect }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
      {tiles.map((t) => (
        <TileButton key={t.id} tile={t} active={selected === t.id} onClick={() => onSelect(t.id)} />
      ))}
    </div>
  );
}

function TileButton({ tile, active, onClick }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 36, 36);
    ctx.save();
    ctx.translate(0, tile.tall ? 8 : 0);
    tile.draw(ctx, 36, 0, 0, 0);
    ctx.restore();
  }, [tile]);
  return (
    <button
      title={tile.name}
      onClick={onClick}
      style={{
        width: 36,
        height: 36,
        padding: 0,
        border: active ? "2px solid #f4c873" : "2px solid #3a3a42",
        borderRadius: 6,
        overflow: "hidden",
        cursor: "pointer",
        background: "#15151a",
      }}
    >
      <canvas ref={ref} width={36} height={36} style={{ imageRendering: "pixelated" }} />
    </button>
  );
}

function ModeButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "8px 6px",
        borderRadius: 8,
        border: active ? "2px solid #f4c873" : "2px solid #3a3a42",
        background: active ? "#3a3220" : "#1b1b20",
        color: "#eee",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  );
}

function SmallButton({ children, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 10px",
        borderRadius: 6,
        border: `1px solid ${danger ? "#7a3030" : "#3a3a42"}`,
        background: danger ? "#2a1515" : "#1b1b20",
        color: danger ? "#ff9a9a" : "#eee",
        cursor: "pointer",
        fontSize: 12,
        textAlign: "left",
      }}
    >
      {children}
    </button>
  );
}
