"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "running" | "caught";

const GAP_MAX = 100;
const GAP_START = 62;
const CATCH_GAP = 0;

export default function ChaseRunner() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [gapDisplay, setGapDisplay] = useState(GAP_START);

  const holdingRef = useRef(false);
  const gapRef = useRef(GAP_START);
  const scoreRef = useRef(0);
  const elapsedRef = useRef(0);
  const runCycleRef = useRef(0);
  const difficultyRef = useRef(1);
  const dustRef = useRef<{ x: number; y: number; life: number }[]>([]);
  const groundOffsetRef = useRef(0);
  const treeOffsetRef = useRef(0);
  const farOffsetRef = useRef(0);
  const shakeRef = useRef(0);

  const heroImgRef = useRef<HTMLImageElement | null>(null);
  const villainImgRef = useRef<HTMLImageElement | null>(null);
  const imagesReadyRef = useRef(0);

  // Load sprites once
  useEffect(() => {
    const hero = new Image();
    const villain = new Image();
    hero.src = "/sprites/hero.png";
    villain.src = "/sprites/villain.png";
    hero.onload = () => (imagesReadyRef.current += 1);
    villain.onload = () => (imagesReadyRef.current += 1);
    heroImgRef.current = hero;
    villainImgRef.current = villain;
  }, []);

  function startRun() {
    gapRef.current = GAP_START;
    scoreRef.current = 0;
    elapsedRef.current = 0;
    difficultyRef.current = 1;
    dustRef.current = [];
    setScore(0);
    setGapDisplay(GAP_START);
    phaseRef.current = "running";
    setPhase("running");
  }

  // Input handling
  useEffect(() => {
    const press = (e: KeyboardEvent | PointerEvent) => {
      if (e instanceof KeyboardEvent && e.code !== "Space") return;
      e.preventDefault?.();
      if (phaseRef.current !== "running") {
        startRun();
      }
      holdingRef.current = true;
    };
    const release = (e: KeyboardEvent | PointerEvent) => {
      if (e instanceof KeyboardEvent && e.code !== "Space") return;
      holdingRef.current = false;
    };

    window.addEventListener("keydown", press);
    window.addEventListener("keyup", release);
    window.addEventListener("pointerdown", press);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("keydown", press);
      window.removeEventListener("keyup", release);
      window.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, []);

  // Main loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let lastTime = performance.now();

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = canvas!.clientWidth * dpr;
      canvas!.height = canvas!.clientHeight * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function drawSky(w: number, h: number) {
      const g = ctx!.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#9fd0a8");
      g.addColorStop(0.55, "#cfe6ac");
      g.addColorStop(1, "#e9e2b8");
      ctx!.fillStyle = g;
      ctx!.fillRect(0, 0, w, h);
    }

    function drawFarTrees(w: number, h: number, offset: number) {
      const baseY = h * 0.62;
      ctx!.fillStyle = "#6f9457";
      const spacing = 90;
      const count = Math.ceil(w / spacing) + 2;
      for (let i = -1; i < count; i++) {
        const x = ((i * spacing - (offset % spacing)) + w) % (w + spacing) - spacing / 2;
        const radius = 46;
        ctx!.beginPath();
        ctx!.ellipse(x, baseY, radius, radius * 0.8, 0, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function drawMidTrees(w: number, h: number, offset: number) {
      const baseY = h * 0.66;
      const spacing = 150;
      const count = Math.ceil(w / spacing) + 2;
      for (let i = -1; i < count; i++) {
        const x = ((i * spacing - (offset % spacing)) + w) % (w + spacing) - spacing / 2;
        // trunk
        ctx!.fillStyle = "#4a3526";
        ctx!.fillRect(x - 6, baseY - 10, 12, 60);
        // canopy
        ctx!.fillStyle = "#3f6b3a";
        ctx!.beginPath();
        ctx!.ellipse(x, baseY - 30, 52, 44, 0, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = "#4f7d44";
        ctx!.beginPath();
        ctx!.ellipse(x - 16, baseY - 46, 34, 28, 0, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function drawGround(w: number, h: number, offset: number) {
      const groundY = h * 0.72;
      // grass
      ctx!.fillStyle = "#5d8a44";
      ctx!.fillRect(0, groundY, w, h - groundY);
      // worn dirt path band
      const pathY = groundY + (h - groundY) * 0.35;
      ctx!.fillStyle = "#b89a6b";
      ctx!.fillRect(0, pathY, w, h - pathY);
      // path texture strokes
      ctx!.strokeStyle = "rgba(110,84,53,0.5)";
      ctx!.lineWidth = 3;
      const spacing = 40;
      const count = Math.ceil(w / spacing) + 2;
      for (let i = -1; i < count; i++) {
        const x = ((i * spacing - (offset % spacing)) + w) % (w + spacing) - spacing / 2;
        ctx!.beginPath();
        ctx!.moveTo(x, pathY + 6);
        ctx!.lineTo(x + 14, h);
        ctx!.stroke();
      }
      // grass tufts
      ctx!.fillStyle = "#477234";
      const tuftSpacing = 26;
      const tcount = Math.ceil(w / tuftSpacing) + 2;
      for (let i = -1; i < tcount; i++) {
        const x = ((i * tuftSpacing - (offset * 1.4 % tuftSpacing)) + w) % (w + tuftSpacing) - tuftSpacing / 2;
        ctx!.fillRect(x, groundY - 4, 3, 8);
      }
    }

    function drawDust(w: number, h: number) {
      for (const d of dustRef.current) {
        ctx!.globalAlpha = Math.max(d.life, 0) * 0.35;
        ctx!.fillStyle = "#cdbfa0";
        ctx!.beginPath();
        ctx!.ellipse(d.x, d.y, 8 * (1.2 - d.life), 4 * (1.2 - d.life), 0, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
    }

    function drawCharacter(
      img: HTMLImageElement | null,
      x: number,
      groundY: number,
      runPhase: number,
      scale: number,
      facingShadow: boolean
    ) {
      if (!img || !img.complete || img.naturalWidth === 0) return;
      const aspect = img.naturalWidth / img.naturalHeight;
      const drawH = 92 * scale;
      const drawW = drawH * aspect;
      const bob = Math.sin(runPhase) * 6 * scale;
      const squash = 1 + Math.sin(runPhase * 2) * 0.03;
      const y = groundY - drawH + bob;

      // shadow
      if (facingShadow) {
        ctx!.globalAlpha = 0.28;
        ctx!.fillStyle = "#1a1a14";
        ctx!.beginPath();
        ctx!.ellipse(x, groundY + 2, drawW * 0.32, 7 * scale, 0, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.globalAlpha = 1;
      }

      ctx!.save();
      ctx!.translate(x, y + drawH / 2);
      ctx!.scale(1, squash);
      ctx!.translate(-x, -(y + drawH / 2));
      ctx!.imageSmoothingEnabled = false;
      ctx!.drawImage(img, x - drawW / 2, y, drawW, drawH);
      ctx!.restore();
    }

    function loop(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;

      const phaseNow = phaseRef.current;

      if (phaseNow === "running") {
        difficultyRef.current += dt * 0.012;
        const sprintGain = 26 * difficultyRef.current;
        const baseDrain = 16 * difficultyRef.current;
        const drain = holdingRef.current ? -sprintGain + baseDrain * 0.4 : baseDrain;
        gapRef.current = Math.max(0, Math.min(GAP_MAX, gapRef.current - drain * dt));

        elapsedRef.current += dt;
        scoreRef.current = Math.floor(elapsedRef.current * 12 * difficultyRef.current);
        setScore(scoreRef.current);
        setGapDisplay(gapRef.current);

        const speedFactor = holdingRef.current ? 1.6 : 0.9;
        groundOffsetRef.current += 260 * speedFactor * dt;
        treeOffsetRef.current += 90 * speedFactor * dt;
        farOffsetRef.current += 30 * speedFactor * dt;
        runCycleRef.current += dt * (holdingRef.current ? 14 : 8) * difficultyRef.current;

        if (holdingRef.current && Math.random() < 0.6) {
          dustRef.current.push({
            x: w * 0.34 + (Math.random() - 0.5) * 10,
            y: h * 0.72 + 2,
            life: 1,
          });
        }
        for (const d of dustRef.current) d.life -= dt * 1.6;
        dustRef.current = dustRef.current.filter((d) => d.life > 0);

        if (gapRef.current <= CATCH_GAP) {
          phaseRef.current = "caught";
          setPhase("caught");
          shakeRef.current = 1;
          setBest((b) => Math.max(b, scoreRef.current));
        }
      } else if (phaseNow === "caught") {
        runCycleRef.current += dt * 10;
        groundOffsetRef.current += 40 * dt;
        treeOffsetRef.current += 14 * dt;
        shakeRef.current = Math.max(0, shakeRef.current - dt * 1.5);
      } else {
        runCycleRef.current += dt * 4;
        treeOffsetRef.current += 10 * dt;
      }

      ctx!.save();
      if (shakeRef.current > 0) {
        const sx = (Math.random() - 0.5) * 10 * shakeRef.current;
        const sy = (Math.random() - 0.5) * 6 * shakeRef.current;
        ctx!.translate(sx, sy);
      }

      drawSky(w, h);
      drawFarTrees(w, h, farOffsetRef.current);
      drawMidTrees(w, h, treeOffsetRef.current);
      drawGround(w, h, groundOffsetRef.current);
      drawDust(w, h);

      const groundY = h * 0.72;
      const heroX = w * 0.34;
      const gapPx = (gapRef.current / GAP_MAX) * w * 0.26 + 26;
      const villainX = phaseRef.current === "caught" ? heroX - 30 : heroX - gapPx;

      drawCharacter(
        villainImgRef.current,
        villainX,
        groundY,
        runCycleRef.current + 0.4,
        0.95,
        true
      );
      drawCharacter(
        heroImgRef.current,
        heroX,
        groundY,
        runCycleRef.current,
        1,
        true
      );

      ctx!.restore();

      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const gapPct = Math.max(0, Math.min(100, gapDisplay));
  const danger = gapPct < 28;

  return (
    <div style={styles.wrap}>
      <canvas ref={canvasRef} style={styles.canvas} />

      <div style={styles.hud}>
        <div style={styles.scoreBox}>
          <span style={styles.scoreLabel}>DISTANCE</span>
          <span style={styles.scoreValue}>{score}</span>
        </div>
        <div style={styles.gapOuter}>
          <div
            style={{
              ...styles.gapInner,
              width: `${gapPct}%`,
              background: danger
                ? "linear-gradient(90deg,#c0392b,#e74c3c)"
                : "linear-gradient(90deg,#3f6b3a,#7fb35a)",
            }}
          />
        </div>
      </div>

      {phase !== "running" && (
        <div style={styles.overlay}>
          <div style={styles.panel}>
            {phase === "idle" && (
              <>
                <h1 style={styles.title}>Seer&apos;s Escape</h1>
                <p style={styles.copy}>
                  The goblin is right behind you. Hold to sprint and widen the
                  gap — let go too long and it catches up.
                </p>
                <p style={styles.hint}>Hold SPACE or tap and hold the screen to run</p>
                <p style={styles.hintSmall}>Release fully and the gap closes fast.</p>
              </>
            )}
            {phase === "caught" && (
              <>
                <h1 style={styles.title}>Caught!</h1>
                <p style={styles.copy}>
                  You made it {score} paces before the goblin grabbed you.
                </p>
                <p style={styles.hint}>Best: {best}</p>
                <p style={styles.hintSmall}>Hold SPACE or tap to try again</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: "relative",
    width: "100vw",
    height: "100dvh",
    overflow: "hidden",
    background: "#0e1410",
    touchAction: "none",
    userSelect: "none",
  },
  canvas: {
    width: "100%",
    height: "100%",
    display: "block",
  },
  hud: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    padding: "14px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    pointerEvents: "none",
  },
  scoreBox: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
  },
  scoreLabel: {
    fontSize: 11,
    letterSpacing: 2,
    color: "#f2ead8cc",
  },
  scoreValue: {
    fontSize: 26,
    fontWeight: 700,
    color: "#fff7e6",
    textShadow: "0 2px 4px rgba(0,0,0,0.45)",
  },
  gapOuter: {
    width: "min(280px, 60vw)",
    height: 10,
    borderRadius: 6,
    background: "rgba(20,20,15,0.45)",
    border: "1px solid rgba(255,255,255,0.25)",
    overflow: "hidden",
  },
  gapInner: {
    height: "100%",
    borderRadius: 6,
    transition: "width 0.08s linear",
  },
  overlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(10,14,10,0.55)",
  },
  panel: {
    maxWidth: 380,
    margin: "0 20px",
    padding: "26px 24px",
    borderRadius: 14,
    background: "rgba(22,26,18,0.92)",
    border: "1px solid rgba(255,255,255,0.15)",
    textAlign: "center",
    boxShadow: "0 18px 40px rgba(0,0,0,0.4)",
  },
  title: {
    margin: "0 0 10px",
    fontSize: 28,
    color: "#fff7e6",
    letterSpacing: 1,
  },
  copy: {
    margin: "0 0 14px",
    fontSize: 14,
    lineHeight: 1.5,
    color: "#e7ddc4",
  },
  hint: {
    margin: "0 0 4px",
    fontSize: 13,
    color: "#bfe3a3",
  },
  hintSmall: {
    margin: 0,
    fontSize: 12,
    color: "#cfc4a4",
  },
};
