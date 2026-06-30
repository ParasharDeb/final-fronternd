"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "running" | "caught";

const GAP_MAX = 100;
const GAP_START = 62;
const CATCH_GAP = 0;

// --- BLE treadmill telemetry ---
const BLE_SERVICE_UUID = "12345678-0000-1000-8000-00805f9b34fb";
const BLE_CHARACTERISTIC_UUID = "12345678-0001-1000-8000-00805f9b34fb";
// km/h that counts as "full sprint" for gameplay purposes
const BLE_MAX_SPEED_KMH = 8;

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
  const starTimeRef = useRef(0);

  const heroImgRef = useRef<HTMLImageElement | null>(null);
  const villainImgRef = useRef<HTMLImageElement | null>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const imagesReadyRef = useRef(0);

  // --- BLE treadmill state ---
  const bleDeviceRef = useRef<BluetoothDevice | null>(null);
  const bleCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const bleVelocityRef = useRef(0); // km/h from treadmill
  const bleDistanceRef = useRef(0); // meters from treadmill
  const bleConnectedRef = useRef(false);
  const [bleConnected, setBleConnected] = useState(false);
  const [bleStatus, setBleStatus] = useState("Not connected");
  const [bleSpeed, setBleSpeed] = useState(0);
  const [bleDistance, setBleDistance] = useState(0);

  // Load sprites + background once
  useEffect(() => {
    const hero = new Image();
    const villain = new Image();
    const bg = new Image();
    hero.src = "/sprites/hero.png";
    villain.src = "/sprites/villain.png";
    bg.src = "/background.jpeg";
    hero.onload = () => (imagesReadyRef.current += 1);
    villain.onload = () => (imagesReadyRef.current += 1);
    heroImgRef.current = hero;
    villainImgRef.current = villain;
    bgImgRef.current = bg;
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

  // Parse JSON telemetry packets emitted by the ESP32 treadmill firmware
  function processIncomingTelemetry(event: Event) {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    if (!target.value) return;
    const decoder = new TextDecoder("utf-8");
    let raw = decoder.decode(target.value);
    // Strip stray control bytes so JSON.parse doesn't choke
    raw = raw.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

    try {
      const packet = JSON.parse(raw);
      const speed = parseFloat(packet.speed);
      const distance = parseFloat(packet.distance);
      if (!Number.isNaN(speed)) {
        bleVelocityRef.current = speed;
        setBleSpeed(speed);
      }
      if (!Number.isNaN(distance)) {
        bleDistanceRef.current = distance;
        setBleDistance(distance);
      }

      // Real-world running drives the sprint input: any meaningful pace
      // counts as "holding" the sprint key, proportional to speed.
      holdingRef.current = speed > 0.5;

      if (phaseRef.current !== "running" && speed > 0.5) {
        startRun();
      }
    } catch (e) {
      console.warn("BLE telemetry parse error:", raw);
    }
  }

  function cleanDisconnectState() {
    bleConnectedRef.current = false;
    setBleConnected(false);
    bleVelocityRef.current = 0;
    holdingRef.current = false;
    setBleSpeed(0);
    setBleStatus((prev) =>
      prev.startsWith("Failed") ? prev : "Disconnected from treadmill"
    );
  }

  async function connectTreadmill() {
    if (!navigator.bluetooth) {
      setBleStatus("Web Bluetooth unavailable — use Chrome/Edge over HTTPS or localhost");
      return;
    }

    if (bleDeviceRef.current?.gatt?.connected) {
      bleDeviceRef.current.gatt.disconnect();
      return;
    }

    try {
      setBleStatus("Choose your ESP32 treadmill device...");
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [BLE_SERVICE_UUID],
      });
      bleDeviceRef.current = device;

      setBleStatus("Connecting to GATT server...");
      const server = await device.gatt!.connect();

      setBleStatus("Looking up treadmill service...");
      const service = await server.getPrimaryService(BLE_SERVICE_UUID);

      setBleStatus("Subscribing to speed/distance notifications...");
      const characteristic = await service.getCharacteristic(
        BLE_CHARACTERISTIC_UUID
      );
      bleCharRef.current = characteristic;

      await characteristic.startNotifications();
      characteristic.addEventListener(
        "characteristicvaluechanged",
        processIncomingTelemetry
      );

      device.addEventListener("gattserverdisconnected", cleanDisconnectState);

      bleConnectedRef.current = true;
      setBleConnected(true);
      setBleStatus(`Connected: ${device.name || "ESP32 Treadmill"}`);
    } catch (error) {
      console.error(error);
      setBleStatus(
        "Connection failed: " +
          (error instanceof Error ? error.message : String(error))
      );
      cleanDisconnectState();
    }
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
      const img = bgImgRef.current;
      if (img && img.complete && img.naturalWidth > 0) {
        // Cover-fit the background image into the canvas, cropping
        // whichever axis overflows so it never stretches/distorts.
        const imgRatio = img.naturalWidth / img.naturalHeight;
        const canvasRatio = w / h;
        let drawW: number, drawH: number, dx: number, dy: number;

        if (canvasRatio > imgRatio) {
          drawW = w;
          drawH = w / imgRatio;
          dx = 0;
          dy = (h - drawH) / 2;
        } else {
          drawH = h;
          drawW = h * imgRatio;
          dy = 0;
          dx = (w - drawW) / 2;
        }

        ctx!.drawImage(img, dx, dy, drawW, drawH);
      } else {
        // Fallback while the image loads so there's no flash of black.
        ctx!.fillStyle = "#0a1128";
        ctx!.fillRect(0, 0, w, h);
      }
    }

    function drawFarTrees(w: number, h: number, offset: number) {
      const baseY = h * 0.62;
      ctx!.fillStyle = "#1f2c40";
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
        ctx!.fillStyle = "#15110d";
        ctx!.fillRect(x - 6, baseY - 10, 12, 60);
        // canopy
        ctx!.fillStyle = "#192a22";
        ctx!.beginPath();
        ctx!.ellipse(x, baseY - 30, 52, 44, 0, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = "#22382c";
        ctx!.beginPath();
        ctx!.ellipse(x - 16, baseY - 46, 34, 28, 0, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function drawGround(w: number, h: number, offset: number) {
  const groundY = h * 0.72;

  // ---------- Grass gradient ----------
  const grassGrad = ctx!.createLinearGradient(0, groundY, 0, h);
  grassGrad.addColorStop(0, "#35552d");
  grassGrad.addColorStop(0.4, "#294221");
  grassGrad.addColorStop(1, "#182418");

  ctx!.fillStyle = grassGrad;
  ctx!.fillRect(0, groundY, w, h - groundY);

  // Dark shadow at horizon
  const shadowGrad = ctx!.createLinearGradient(
    0,
    groundY,
    0,
    groundY + 50
  );
  shadowGrad.addColorStop(0, "rgba(0,0,0,0.35)");
  shadowGrad.addColorStop(1, "rgba(0,0,0,0)");

  ctx!.fillStyle = shadowGrad;
  ctx!.fillRect(0, groundY, w, 60);

  // ---------- Dirt path ----------
  const pathY = groundY + (h - groundY) * 0.33;

  ctx!.beginPath();
  ctx!.moveTo(0, pathY);

  ctx!.quadraticCurveTo(
    w * 0.25,
    pathY - 8,
    w * 0.5,
    pathY + 6
  );

  ctx!.quadraticCurveTo(
    w * 0.75,
    pathY + 18,
    w,
    pathY + 5
  );

  ctx!.lineTo(w, h);
  ctx!.lineTo(0, h);
  ctx!.closePath();

  const dirtGrad = ctx!.createLinearGradient(0, pathY, 0, h);
  dirtGrad.addColorStop(0, "#6a5b43");
  dirtGrad.addColorStop(0.6, "#4e4432");
  dirtGrad.addColorStop(1, "#3c3427");

  ctx!.fillStyle = dirtGrad;
  ctx!.fill();

  // ---------- Moving texture ----------
  ctx!.strokeStyle = "rgba(30,25,18,0.25)";
  ctx!.lineWidth = 2;

  const spacing = 34;
  const count = Math.ceil(w / spacing) + 2;

  for (let i = -1; i < count; i++) {
    const x =
      ((i * spacing - (offset % spacing)) + w) %
        (w + spacing) -
      spacing / 2;

    ctx!.beginPath();
    ctx!.moveTo(x, pathY + 4);
    ctx!.lineTo(x + 18, h);
    ctx!.stroke();
  }

  // ---------- Grass blades ----------
  ctx!.strokeStyle = "#4d7d42";
  ctx!.lineWidth = 1;

  const bladeSpacing = 8;

  for (let i = -1; i < w / bladeSpacing + 2; i++) {
    const x =
      ((i * bladeSpacing - (offset * 1.3 % bladeSpacing)) + w) %
      (w + bladeSpacing);

    const height = 5 + (i % 4);

    ctx!.beginPath();
    ctx!.moveTo(x, groundY + 1);
    ctx!.lineTo(x - 1, groundY - height);
    ctx!.stroke();
  }

  // ---------- Small rocks ----------
  ctx!.fillStyle = "#7c766d";

  const rockSpacing = 120;

  for (let i = -1; i < w / rockSpacing + 2; i++) {
    const x =
      ((i * rockSpacing - (offset * 0.6 % rockSpacing)) + w) %
      (w + rockSpacing);

    const y = pathY + 30 + ((i * 37) % 22);

    ctx!.beginPath();
    ctx!.ellipse(
      x,
      y,
      5 + (i % 3),
      3,
      0,
      0,
      Math.PI * 2
    );
    ctx!.fill();
  }

  // ---------- Fallen leaves ----------
  ctx!.fillStyle = "#a56a1d";

  const leafSpacing = 70;

  for (let i = -1; i < w / leafSpacing + 2; i++) {
    const x =
      ((i * leafSpacing - (offset * 0.8 % leafSpacing)) + w) %
      (w + leafSpacing);

    const y = groundY + 18 + ((i * 23) % 40);

    ctx!.save();
    ctx!.translate(x, y);
    ctx!.rotate((i % 5) * 0.4);

    ctx!.beginPath();
    ctx!.ellipse(0, 0, 3, 1.5, 0, 0, Math.PI * 2);
    ctx!.fill();

    ctx!.restore();
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
      starTimeRef.current += dt * 1.5;
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;

      const phaseNow = phaseRef.current;

      if (phaseNow === "running") {
        difficultyRef.current += dt * 0.012;

        // Throttle is 0..1. With BLE connected it's proportional to real
        // running speed; otherwise it's a binary hold (space/tap).
        const throttle = bleConnectedRef.current
          ? Math.max(0, Math.min(1, bleVelocityRef.current / BLE_MAX_SPEED_KMH))
          : holdingRef.current
          ? 1
          : 0;

        const sprintGain = 26 * difficultyRef.current;
        const baseDrain = 16 * difficultyRef.current;
        const drain =
          throttle > 0
            ? -sprintGain * throttle + baseDrain * 0.4
            : baseDrain;
        gapRef.current = Math.max(0, Math.min(GAP_MAX, gapRef.current - drain * dt));

        elapsedRef.current += dt;
        scoreRef.current = Math.floor(elapsedRef.current * 12 * difficultyRef.current);
        setScore(scoreRef.current);
        setGapDisplay(gapRef.current);

        const speedFactor = 0.9 + throttle * 0.7;
        groundOffsetRef.current += 260 * speedFactor * dt;
        treeOffsetRef.current += 90 * speedFactor * dt;
        farOffsetRef.current += 30 * speedFactor * dt;
        runCycleRef.current += dt * (8 + throttle * 6) * difficultyRef.current;

        if (throttle > 0.15 && Math.random() < 0.6) {
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
        <div style={styles.topRow}>
          <div style={styles.statGroup}>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>SCORE</span>
              <span style={styles.statValue}>{score}</span>
            </div>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>SPEED</span>
              <span style={styles.statValue}>
                {bleSpeed.toFixed(1)}
                <span style={styles.statUnit}> km/h</span>
              </span>
            </div>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>DISTANCE</span>
              <span style={styles.statValue}>
                {bleDistance.toFixed(1)}
                <span style={styles.statUnit}> m</span>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={connectTreadmill}
            style={{
              ...styles.bleButton,
              ...(bleConnected ? styles.bleButtonConnected : null),
            }}
          >
            <span
              style={{
                ...styles.bleDot,
                ...(bleConnected ? styles.bleDotConnected : null),
              }}
            />
            {bleConnected ? "Treadmill Connected" : "Connect Treadmill"}
          </button>
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

        {!bleConnected && <div style={styles.bleStatusText}>{bleStatus}</div>}
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
                <p style={styles.hint}>
                  {bleConnected
                    ? "Start running on the treadmill to take off"
                    : "Hold SPACE or tap and hold the screen to run"}
                </p>
                <p style={styles.hintSmall}>
                  {bleConnected
                    ? "Slow down and the gap closes fast."
                    : "Release fully and the gap closes fast."}
                </p>
              </>
            )}
            {phase === "caught" && (
              <>
                <h1 style={styles.title}>Caught!</h1>
                <p style={styles.copy}>
                  You made it {score} paces before the goblin grabbed you.
                </p>
                <p style={styles.hint}>Best: {best}</p>
                <p style={styles.hintSmall}>
                  {bleConnected
                    ? "Start running again to try again"
                    : "Hold SPACE or tap to try again"}
                </p>
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
  topRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  statGroup: {
    display: "flex",
    gap: 10,
  },
  statBox: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    background: "rgba(10,17,40,0.55)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 10,
    padding: "6px 12px",
    minWidth: 64,
  },
  statLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: "#f2ead8aa",
  },
  statValue: {
    fontSize: 20,
    fontWeight: 700,
    fontFamily: "monospace",
    color: "#fff7e6",
    textShadow: "0 2px 4px rgba(0,0,0,0.45)",
  },
  statUnit: {
    fontSize: 11,
    fontWeight: 500,
    color: "#f2ead8aa",
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
  bleButton: {
    pointerEvents: "auto",
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 0.4,
    color: "#fff7e6",
    background: "rgba(20,20,15,0.55)",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: 20,
    padding: "6px 12px",
    cursor: "pointer",
  },
  bleButtonConnected: {
    background: "rgba(63,107,58,0.55)",
    border: "1px solid rgba(127,179,90,0.55)",
  },
  bleDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#e74c3c",
    boxShadow: "0 0 6px #e74c3c",
    flexShrink: 0,
  },
  bleDotConnected: {
    background: "#7fb35a",
    boxShadow: "0 0 6px #7fb35a",
  },
  bleStatusText: {
    fontSize: 11,
    color: "#f2ead899",
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