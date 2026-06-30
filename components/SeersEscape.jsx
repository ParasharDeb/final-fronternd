"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/* ----------------------------------------------------------------------
   Seer's Escape — Road Chase (Next.js port)
   Canvas-drawn characters/environment instead of giant embedded bitmaps,
   so everything scales crisply and the chase animation can react live
   to how close the hunter is.
---------------------------------------------------------------------- */

const MAX_SPEED_KMH = 34;
const ACCEL = 16; // km/h per second while holding throttle
const DECEL = 22; // km/h per second while released
const VILLAIN_BASE_KMH = 24;
const CATCH_GAP = 3; // meters
const ITEM_DISTANCE_GAP = 140;
const PLAYER_STAGES = ["#e8a33d", "#f4c873", "#ff8a5b", "#ff5a8a", "#b388ff"];

export default function SeersEscape() {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const stateRef = useRef(null);
  const [hud, setHud] = useState({ dist: 0, gap: 60, speed: 0, items: 0 });
  const [phase, setPhase] = useState("gate"); // gate | running | over
  const [summary, setSummary] = useState({ dist: 0, items: 0, topSpeed: 0 });

  const makeState = useCallback(
    () => ({
      running: false,
      throttle: false,
      lastT: 0,
      distanceM: 0,
      speedKmh: 0,
      topSpeed: 0,
      villainSpeedKmh: VILLAIN_BASE_KMH,
      gapM: 60,
      roadScroll: 0,
      itemsCollected: 0,
      costumeStage: 0,
      nextItemAt: 140,
      activeItem: null,
      shake: 0,
      legPhase: 0,
      villainLegPhase: 0,
      dust: [],
      flashes: [],
      caught: false,
      catchFlash: 0,
    }),
    []
  );

  useEffect(() => {
    stateRef.current = makeState();
  }, [makeState]);

  useEffect(() => {
    const setThrottle = (v) => {
      if (stateRef.current) stateRef.current.throttle = v;
    };
    const kd = (e) => {
      if (["ArrowUp", "w", "W", " "].includes(e.key)) setThrottle(true);
    };
    const ku = (e) => {
      if (["ArrowUp", "w", "W", " "].includes(e.key)) setThrottle(false);
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    const wrap = wrapRef.current;
    const pd = () => setThrottle(true);
    const pu = () => setThrottle(false);
    wrap?.addEventListener("pointerdown", pd);
    window.addEventListener("pointerup", pu);
    wrap?.addEventListener("pointerleave", pu);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      wrap?.removeEventListener("pointerdown", pd);
      window.removeEventListener("pointerup", pu);
      wrap?.removeEventListener("pointerleave", pu);
    };
  }, []);

  useEffect(() => {
    const resize = () => {
      const c = canvasRef.current;
      const w = wrapRef.current;
      if (!c || !w) return;
      c.width = w.clientWidth;
      c.height = w.clientHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const endGame = useCallback((s) => {
    s.running = false;
    setSummary({
      dist: Math.floor(s.distanceM),
      items: s.itemsCollected,
      topSpeed: Number(s.topSpeed.toFixed(1)),
    });
    setPhase("over");
  }, []);

  function endGameTrigger(s) {
    if (!s.caught) {
      s.caught = true;
      s.catchFlash = 1;
      setTimeout(() => endGame(s), 550);
    }
  }

  function update(s, dt) {
    if (s.throttle) {
      s.speedKmh = Math.min(MAX_SPEED_KMH, s.speedKmh + ACCEL * dt);
    } else {
      s.speedKmh = Math.max(0, s.speedKmh - DECEL * dt);
    }
    s.topSpeed = Math.max(s.topSpeed, s.speedKmh);

    const speedMs = (s.speedKmh * 1000) / 3600;
    s.distanceM += speedMs * dt;
    s.roadScroll += speedMs * dt * 18;
    s.legPhase += dt * (4 + s.speedKmh * 0.35);

    const targetVillainKmh =
      VILLAIN_BASE_KMH + Math.min(10, s.distanceM / 220) + (s.gapM < 20 ? 3 : 0);
    s.villainSpeedKmh += (targetVillainKmh - s.villainSpeedKmh) * Math.min(1, dt * 0.8);
    s.villainLegPhase += dt * (4 + s.villainSpeedKmh * 0.35);

    const villainMs = (s.villainSpeedKmh * 1000) / 3600;
    s.gapM += (speedMs - villainMs) * dt;
    s.gapM = Math.max(-5, Math.min(80, s.gapM));

    const danger = Math.max(0, 1 - s.gapM / 22);
    s.shake = danger * danger * 6;

    if (Math.random() < 0.35 + s.speedKmh / 60) {
      s.dust.push({ x: 0, y: 0, life: 1, vx: -40 - Math.random() * 40 });
    }
    s.dust.forEach((d) => {
      d.life -= dt * 1.6;
      d.x += d.vx * dt;
      d.y -= 18 * dt;
    });
    s.dust = s.dust.filter((d) => d.life > 0);

    if (!s.activeItem && s.distanceM >= s.nextItemAt) {
      s.activeItem = { worldY: 0 };
    }
    if (s.activeItem) {
      if (s.distanceM >= s.nextItemAt + 4) {
        s.itemsCollected++;
        s.costumeStage = Math.min(PLAYER_STAGES.length - 1, s.costumeStage + 1);
        s.nextItemAt = s.distanceM + ITEM_DISTANCE_GAP;
        s.activeItem = null;
        s.flashes.push({ life: 1 });
      }
    }
    s.flashes.forEach((f) => (f.life -= dt * 2));
    s.flashes = s.flashes.filter((f) => f.life > 0);

    if (s.gapM <= CATCH_GAP) endGameTrigger(s);
  }

  function lerpColor(a, b, t) {
    const pa = hexToRgb(a);
    const pb = hexToRgb(b);
    const r = Math.round(pa.r + (pb.r - pa.r) * t);
    const g = Math.round(pa.g + (pb.g - pa.g) * t);
    const bl = Math.round(pa.b + (pb.b - pa.b) * t);
    return `rgb(${r},${g},${bl})`;
  }
  function hexToRgb(hex) {
    const v = hex.replace("#", "");
    return {
      r: parseInt(v.substring(0, 2), 16),
      g: parseInt(v.substring(2, 4), 16),
      b: parseInt(v.substring(4, 6), 16),
    };
  }

  function drawSky(ctx, W, H, s) {
    const danger = Math.max(0, 1 - s.gapM / 22);
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.65);
    const top1 = lerpColor("#1a1c2c", "#3a1424", danger);
    const top2 = lerpColor("#33405c", "#5c2030", danger);
    g.addColorStop(0, top1);
    g.addColorStop(1, top2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H * 0.65);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 0; i < 40; i++) {
      const sx = (i * 97 + s.roadScroll * 0.02) % W;
      const sy = (i * 53) % (H * 0.4);
      ctx.globalAlpha = 0.3 + 0.4 * Math.sin(i + s.roadScroll * 0.01);
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawMountains(ctx, W, H, s) {
    const baseY = H * 0.62;
    ctx.fillStyle = "#241d2e";
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    const offset = (s.roadScroll * 0.05) % 200;
    for (let x = -200; x < W + 200; x += 200) {
      const px = x - offset;
      ctx.lineTo(px + 100, baseY - 70);
      ctx.lineTo(px + 200, baseY);
    }
    ctx.lineTo(W, baseY);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
  }

  function drawTrees(ctx, W, H, s) {
    const baseY = H * 0.66;
    const offset = (s.roadScroll * 0.4) % 140;
    ctx.fillStyle = "#1a2a1f";
    for (let x = -140; x < W + 140; x += 140) {
      const px = x - offset;
      ctx.beginPath();
      ctx.moveTo(px, baseY);
      ctx.lineTo(px + 28, baseY - 55);
      ctx.lineTo(px + 56, baseY);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawRoad(ctx, W, H, s) {
    const roadTop = H * 0.62;
    const roadBottom = H;
    const g = ctx.createLinearGradient(0, roadTop, 0, roadBottom);
    g.addColorStop(0, "#26262b");
    g.addColorStop(1, "#3a3a40");
    ctx.fillStyle = g;
    ctx.fillRect(0, roadTop, W, roadBottom - roadTop);

    ctx.strokeStyle = "#e8c873";
    ctx.lineWidth = 6;
    ctx.setLineDash([30, 26]);
    ctx.lineDashOffset = -(s.roadScroll % 56);
    ctx.beginPath();
    ctx.moveTo(W / 2, roadTop);
    ctx.lineTo(W / 2, roadBottom);
    ctx.stroke();
    ctx.setLineDash([]);

    const postOffset = (s.roadScroll * 0.9) % 90;
    ctx.fillStyle = "#15151a";
    for (let x = -90; x < W + 90; x += 90) {
      const px = x - postOffset;
      ctx.fillRect(px, roadTop - 6, 6, 26);
      ctx.fillRect(W - px, roadTop - 6, 6, 26);
    }
  }

  function drawDust(ctx, W, H, s) {
    const groundY = H * 0.86;
    const playerX = W * 0.32;
    ctx.fillStyle = "rgba(220,200,170,0.5)";
    s.dust.forEach((d) => {
      ctx.globalAlpha = Math.max(0, d.life);
      ctx.beginPath();
      ctx.arc(playerX + d.x - 14, groundY + d.y + 6, 4 * d.life, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawItem(ctx, W, H, s) {
    if (!s.activeItem) return;
    const groundY = H * 0.86;
    const x = W * 0.58;
    const bob = Math.sin(s.distanceM * 0.4) * 6;
    ctx.save();
    ctx.translate(x, groundY - 60 + bob);
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
    glow.addColorStop(0, "rgba(255,230,150,0.9)");
    glow.addColorStop(1, "rgba(255,230,150,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(s.distanceM * 0.5);
    ctx.fillStyle = "#f4c873";
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i;
      ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawRunnerFigure(ctx, x, groundY, scale, legPhase, lean, color, hooded) {
    ctx.save();
    ctx.translate(x, groundY);
    ctx.scale(scale, scale);
    ctx.rotate(lean);

    const swing = Math.sin(legPhase);
    const swing2 = Math.sin(legPhase + Math.PI);

    ctx.strokeStyle = "#2b1d12";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(8 * swing2, -16);
    ctx.lineTo(10 * swing2, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(8 * swing, -16);
    ctx.lineTo(10 * swing, 0);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-9, -34);
    ctx.lineTo(9, -34);
    ctx.lineTo(7, -62);
    ctx.lineTo(-7, -62);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-6, -58);
    ctx.lineTo(-6 - 10 * swing, -44);
    ctx.moveTo(6, -58);
    ctx.lineTo(6 + 10 * swing2, -44);
    ctx.stroke();

    ctx.fillStyle = "#f0d3a8";
    ctx.beginPath();
    ctx.arc(0, -70, 9, 0, Math.PI * 2);
    ctx.fill();

    if (hooded) {
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.moveTo(-11, -70);
      ctx.quadraticCurveTo(0, -90, 11, -70);
      ctx.quadraticCurveTo(8, -58, 0, -56);
      ctx.quadraticCurveTo(-8, -58, -11, -70);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawPlayer(ctx, W, H, s, danger) {
    const groundY = H * 0.86;
    const x = W * 0.32;
    const wobble = danger > 0.5 ? Math.sin(s.distanceM * 6) * danger * 2 : 0;
    const color = PLAYER_STAGES[s.costumeStage];
    drawRunnerFigure(ctx, x + wobble, groundY, 1.15, s.legPhase, 0.04, color, false);
  }

  function drawVillain(ctx, W, H, s, danger) {
    const groundY = H * 0.86;
    const farX = W * 0.02;
    const nearX = W * 0.27;
    const reach = Math.max(0, Math.min(1, 1 - s.gapM / 60));
    const x = farX + (nearX - farX) * reach;
    const scale = 1.0 + reach * 0.35;
    const lunge = danger > 0.7 ? Math.sin(s.distanceM * 10) * 0.06 : 0;
    drawRunnerFigure(ctx, x, groundY, scale, s.villainLegPhase, -0.05 + lunge, "#3a2f24", true);

    if (danger > 0.8) {
      ctx.save();
      ctx.translate(x + 14 * scale, groundY - 50 * scale);
      ctx.strokeStyle = "#3a2f24";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(18 + Math.sin(s.distanceM * 14) * 4, -4);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawVignetteAndFlashes(ctx, W, H, s, danger) {
    if (danger > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(s.distanceM * (4 + danger * 10));
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
      g.addColorStop(0, "rgba(255,0,0,0)");
      g.addColorStop(1, `rgba(140,0,10,${danger * (0.35 + 0.25 * pulse)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    s.flashes.forEach((f) => {
      ctx.fillStyle = `rgba(255,230,150,${Math.max(0, f.life) * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    });

    if (s.catchFlash) {
      s.catchFlash = Math.max(0, s.catchFlash - 0.06);
      ctx.fillStyle = `rgba(255,40,40,${s.catchFlash})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function render(ctx, canvas, s) {
    const W = canvas.width;
    const H = canvas.height;
    const danger = Math.max(0, 1 - s.gapM / 22);

    ctx.save();
    const shakeX = (Math.random() - 0.5) * s.shake;
    const shakeY = (Math.random() - 0.5) * s.shake;
    const zoom = 1 + danger * 0.04;
    ctx.translate(W / 2 + shakeX, H / 2 + shakeY);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2);

    drawSky(ctx, W, H, s);
    drawMountains(ctx, W, H, s);
    drawTrees(ctx, W, H, s);
    drawRoad(ctx, W, H, s);
    drawDust(ctx, W, H, s);
    drawItem(ctx, W, H, s);
    drawVillain(ctx, W, H, s, danger);
    drawPlayer(ctx, W, H, s, danger);

    ctx.restore();

    drawVignetteAndFlashes(ctx, W, H, s, danger);
  }

  const loop = useCallback(
    (t) => {
      const s = stateRef.current;
      const canvas = canvasRef.current;
      if (!s || !canvas) return;
      const ctx = canvas.getContext("2d");
      if (!s.lastT) s.lastT = t;
      const dt = Math.min(0.05, (t - s.lastT) / 1000);
      s.lastT = t;

      update(s, dt);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      render(ctx, canvas, s);
      setHud({
        dist: Math.floor(s.distanceM),
        gap: Math.max(0, Math.round(s.gapM)),
        speed: Number(s.speedKmh.toFixed(1)),
        items: s.itemsCollected,
      });

      if (s.running) requestAnimationFrame(loop);
      else if (!s.caught) endGame(s);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const resetGame = useCallback(() => {
    stateRef.current = makeState();
    const s = stateRef.current;
    s.running = true;
    setPhase("running");
    requestAnimationFrame((t) => loop(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [makeState, loop]);

  useEffect(() => {
    if (phase !== "gate") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const s = makeState();
    s.legPhase = 1;
    s.villainLegPhase = 0.3;
    s.gapM = 50;
    let raf;
    const idle = () => {
      s.legPhase += 0.016 * 4;
      s.villainLegPhase += 0.016 * 4;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      render(ctx, canvas, s);
      raf = requestAnimationFrame(idle);
    };
    raf = requestAnimationFrame(idle);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const speedPct = Math.min(100, (hud.speed / MAX_SPEED_KMH) * 100);

  return (
    <div
      ref={wrapRef}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 480,
        height: "100vh",
        maxHeight: 760,
        margin: "0 auto",
        overflow: "hidden",
        background: "#2c2d31",
        borderLeft: "6px solid #3a2f24",
        borderRight: "6px solid #3a2f24",
        fontFamily: "'Trebuchet MS','Segoe UI',sans-serif",
        userSelect: "none",
        touchAction: "none",
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />

      {phase === "running" && (
        <>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 12px",
              pointerEvents: "none",
              zIndex: 5,
            }}
          >
            <Badge label="Distance" value={`${hud.dist} m`} />
            <Badge label="Gap to Hunter" value={`${hud.gap} m`} align="right" danger={hud.gap < 18} />
          </div>

          <div
            style={{
              position: "absolute",
              bottom: 14,
              left: "50%",
              transform: "translateX(-50%)",
              width: "88%",
              maxWidth: 380,
              background: "rgba(31,27,22,0.82)",
              border: "2px solid #3a2f24",
              borderRadius: 12,
              padding: "8px 14px 10px",
              zIndex: 5,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: "#bfae8e", fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em" }}>
                Your Speed
              </span>
              <span style={{ color: "#f4c873", fontWeight: 700, fontSize: 14 }}>{hud.speed.toFixed(1)} km/h</span>
            </div>
            <div
              style={{
                position: "relative",
                height: 10,
                background: "#2c2d31",
                borderRadius: 6,
                overflow: "hidden",
                border: "1px solid #000",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${speedPct}%`,
                  background: "linear-gradient(90deg,#2c6b63,#e8a33d)",
                  borderRadius: 6,
                }}
              />
            </div>
            <div style={{ textAlign: "center", fontSize: 11, color: "#bfae8e", marginTop: 6 }}>
              Hold ↑ / W / tap-and-hold to run · release to slow down
            </div>
          </div>
        </>
      )}

      {phase === "gate" && (
        <Overlay>
          <h1 style={{ fontSize: 28, margin: "0 0 4px", color: "#f4c873", textShadow: "0 2px 0 #000" }}>
            Seer&apos;s Escape
          </h1>
          <p style={{ color: "#bfae8e", fontSize: 13, maxWidth: 300, lineHeight: 1.5, margin: "6px 0 18px" }}>
            The hooded Seer is hunting you down the long straight road. Hold the
            throttle to run, collect glowing relics to evolve, and keep your lead —
            the closer he gets, the more the road itself starts to turn against you.
          </p>
          <BigButton onClick={resetGame}>Start Running</BigButton>
        </Overlay>
      )}

      {phase === "over" && (
        <Overlay>
          <h1 style={{ fontSize: 26, margin: "0 0 8px", color: "#e8745f" }}>Caught by the Seer!</h1>
          <div style={{ display: "flex", gap: 18, marginBottom: 18 }}>
            <Stat n={summary.dist} l="Meters" />
            <Stat n={summary.items} l="Relics" />
            <Stat n={summary.topSpeed} l="Top km/h" />
          </div>
          <BigButton onClick={resetGame}>Run Again</BigButton>
        </Overlay>
      )}
    </div>
  );
}

function Badge({ label, value, align = "left", danger }) {
  return (
    <div
      style={{
        background: "rgba(31,27,22,0.78)",
        border: `2px solid ${danger ? "#a0303a" : "#3a2f24"}`,
        borderRadius: 10,
        padding: "6px 10px",
        color: "#f4ecd9",
        fontSize: 13,
        lineHeight: 1.3,
        boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
        minWidth: 108,
        textAlign: align,
        transition: "border-color 0.2s",
      }}
    >
      <span style={{ fontSize: 10, letterSpacing: ".06em", textTransform: "uppercase", color: "#bfae8e", display: "block" }}>
        {label}
      </span>
      <span style={{ fontSize: 18, fontWeight: 700, color: danger ? "#ff7a7a" : "#f4c873" }}>{value}</span>
    </div>
  );
}

function Overlay({ children }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(10,9,8,0.88)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        color: "#f4ecd9",
        zIndex: 10,
        padding: 24,
      }}
    >
      {children}
    </div>
  );
}

function BigButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "linear-gradient(180deg,#f4c873,#e8a33d)",
        border: "2px solid #7a4f17",
        color: "#2b1d08",
        fontWeight: 700,
        fontSize: 15,
        padding: "11px 26px",
        borderRadius: 9,
        cursor: "pointer",
        boxShadow: "0 3px 0 #7a4f17",
      }}
    >
      {children}
    </button>
  );
}

function Stat({ n, l }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#f4c873" }}>{n}</div>
      <div style={{ fontSize: 10, color: "#bfae8e", textTransform: "uppercase" }}>{l}</div>
    </div>
  );
}
