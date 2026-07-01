"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "running" | "paused" | "caught";

const GAP_MAX = 100;
const GAP_START = 62;
const CATCH_GAP = 0;

// --- BLE treadmill telemetry ---
const BLE_SERVICE_UUID = "12345678-0000-1000-8000-00805f9b34fb";
const BLE_CHARACTERISTIC_UUID = "12345678-0001-1000-8000-00805f9b34fb";
// km/h that counts as "full sprint" for gameplay purposes
const BLE_MAX_SPEED_KMH = 8;

export default function ChaseRunner({ autoStart = false }: { autoStart?: boolean }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<Phase>("running");
  const [phase, setPhase] = useState<Phase>("running");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [gapDisplay, setGapDisplay] = useState(GAP_START);

  const holdingRef = useRef(false);
  const gapRef = useRef(GAP_START);
  const scoreRef = useRef(0);
  const elapsedRef = useRef(0);
  const runCycleRef = useRef(0);
  const difficultyRef = useRef(1);
  const groundOffsetRef = useRef(0);
  const treeOffsetRef = useRef(0);
  const farOffsetRef = useRef(0);
  const shakeRef = useRef(0);
  const starTimeRef = useRef(0);

  const heroNodeRef = useRef<HTMLImageElement | null>(null);
  const villainNodeRef = useRef<HTMLImageElement | null>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bloodStainsRef = useRef<{ x: number; y: number; size: number; opacity: number }[]>([]);
  const heroDustRef = useRef<{ x: number; y: number; life: number; size: number; opacity: number }[]>([]);
  const heroFrames = [
    "/sprites/Prince/prince1.png",
    "/sprites/Prince/prince2.png",
    "/sprites/Prince/prince3.png",
    "/sprites/Prince/prince4.png",
  ];
  const heroStandingFrame = "/sprites/Prince/Prince_standing.png";
  const tiredHeroFrame = "/sprites/Prince/Prince_tired.png";
  const villainFrames = [
    "/sprites/Asura/asur1.png",
    "/sprites/Asura/asur2.png",
    "/sprites/Asura/asur3.png",
    "/sprites/Asura/asur4.png",
  ];
  const frameDelayMs = 60;
  const frameTimerRef = useRef(0);
  const idleApproachRate = 8;
  const heroTiredRef = useRef(false);
  const previousThrottleRef = useRef(0);

  // --- BLE treadmill state ---
  const bleDeviceRef = useRef<BluetoothDevice | null>(null);
  const bleCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const bleVelocityRef = useRef(0); // km/h from treadmill
  const bleDistanceRef = useRef(0); // meters from treadmill
  const bleDistanceBaseRef = useRef(0); // baseline for the current run
  const bleConnectedRef = useRef(false);
  const [bleConnected, setBleConnected] = useState(false);
  const [bleStatus, setBleStatus] = useState("Not connected");
  const [bleSpeed, setBleSpeed] = useState(0);
  const [bleDistance, setBleDistance] = useState(0);
  const [lastBleRaw, setLastBleRaw] = useState<string | null>(null);
  const [lastBleAt, setLastBleAt] = useState<number | null>(null);

  // Load background once
  useEffect(() => {
    const bg = new Image();
    bg.src = "/background.jpeg";
    bg.onload = () => {
      bgImgRef.current = bg;
    };

    // Load audio
    const audio = new Audio("/sprites/Music/Game_score.mpeg");
    audio.loop = true;
    audio.volume = 0.5;
    audioRef.current = audio;
  }, []);

  function startRun() {
    gapRef.current = GAP_START;
    scoreRef.current = 0;
    elapsedRef.current = 0;
    difficultyRef.current = 1;
    heroDustRef.current = [];
    bloodStainsRef.current = [];
    bleDistanceBaseRef.current = bleDistanceRef.current;
    setScore(0);
    setGapDisplay(GAP_START);
    setBleDistance(0);
    phaseRef.current = "running";
    setPhase("running");
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }

  function pauseGame() {
    if (phaseRef.current !== "running") return;
    phaseRef.current = "paused";
    setPhase("paused");
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }

  function resumeGame() {
    if (phaseRef.current !== "paused") return;
    phaseRef.current = "running";
    setPhase("running");
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  }

  function exitGame() {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    // Attempt to close the tab completely
    window.close();

    // Fallback just in case the browser blocks window.close()
    setTimeout(() => {
      router.push("/landing");
    }, 100);
  }

  useEffect(() => {
    if (phaseRef.current !== "running") {
      startRun();
    }
  }, []);

  // Parse JSON telemetry packets emitted by the ESP32 treadmill firmware
  function processIncomingTelemetry(event: Event) {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    if (!target.value) return;
    const decoder = new TextDecoder("utf-8");
    let raw = decoder.decode(target.value);
    // Strip stray control bytes so JSON.parse doesn't choke
    raw = raw.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

    // Preserve raw packet for debugging
    try {
      setLastBleRaw(raw);
      setLastBleAt(Date.now());
    } catch (e) {
      /* ignore in non-browser or SSR contexts */
    }

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
        const displayedDistance = Math.max(0, distance - bleDistanceBaseRef.current);
        setBleDistance(displayedDistance);
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
    setBleDistance(0);
    bleDistanceRef.current = 0;
    bleDistanceBaseRef.current = 0;
    setBleStatus((prev) =>
      prev.startsWith("Failed") ? prev : "Disconnected from treadmill"
    );
  }

  async function connectTreadmill() {
    if (!window.isSecureContext) {
      setBleStatus("Web Bluetooth needs a secure context. Open this app from localhost or HTTPS in Chrome/Edge.");
      return;
    }

    if (!navigator.bluetooth) {
      setBleStatus("Web Bluetooth unavailable — use Chrome/Edge over HTTPS or localhost");
      return;
    }

    if (bleDeviceRef.current?.gatt?.connected) {
      bleDeviceRef.current.gatt.disconnect();
      return;
    }

    try {
      const bluetoothApi = navigator.bluetooth as Bluetooth & {
        getAvailability?: () => Promise<boolean>;
      };
      const available = bluetoothApi.getAvailability
        ? await bluetoothApi.getAvailability()
        : true;
      if (available === false) {
        setBleStatus("Bluetooth adapter unavailable or blocked. Turn on Bluetooth and allow the site to access it.");
        return;
      }

      setBleStatus("Opening device chooser...");
      console.log("BLE: requesting device chooser (acceptAllDevices)");
      // Try a permissive chooser first so devices that don't advertise the service still appear
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

      // Reset baseline so displayed distance starts from zero for this connection
      bleDistanceBaseRef.current = bleDistanceRef.current;
      setBleDistance(0);
      console.log("BLE: connected", device.name, "baseline", bleDistanceBaseRef.current);

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
      if (phaseRef.current === "paused") {
        resumeGame();
        return;
      }
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

    function drawFarShops(w: number, h: number, offset: number) {
      return;
    }

    function drawMidShops(w: number, h: number, offset: number) {
      return;
    }

    function drawGround(w: number, h: number, offset: number) {
      const groundY = h * 0.8;

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
    }

    function drawDust(w: number, h: number) {
      for (const d of heroDustRef.current) {
        const remaining = Math.max(d.life, 0);
        ctx!.globalAlpha = remaining * d.opacity;
        ctx!.fillStyle = "#d5c6a0";
        ctx!.beginPath();
        ctx!.ellipse(d.x, d.y, d.size * remaining * 0.9, d.size * remaining * 0.5, 0, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = "rgba(255,255,255,0.18)";
        ctx!.beginPath();
        ctx!.ellipse(d.x + d.size * 0.18, d.y - d.size * 0.1, d.size * remaining * 0.24, d.size * remaining * 0.12, 0, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
    }

    function drawActorShadow(x: number, groundY: number, scale: number) {
      const drawH = 160 * scale;
      const drawW = drawH * 0.65;
      ctx!.globalAlpha = 0.28;
      ctx!.fillStyle = "#1a1a14";
      ctx!.beginPath();
      ctx!.ellipse(x, groundY + 2, drawW * 0.32, 7 * scale, 0, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.globalAlpha = 1;
    }

    function drawBloodStains(w: number, h: number) {
      for (const stain of bloodStainsRef.current) {
        ctx!.globalAlpha = stain.opacity;
        ctx!.fillStyle = "#8b0000";
        ctx!.beginPath();
        ctx!.ellipse(stain.x, stain.y, stain.size * 0.85, stain.size * 0.6, Math.random() * 0.7, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = "#b00000";
        ctx!.beginPath();
        ctx!.ellipse(stain.x + stain.size * 0.3, stain.y - stain.size * 0.2, stain.size * 0.42, stain.size * 0.3, 0, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = "#4c0000";
        ctx!.beginPath();
        ctx!.ellipse(stain.x - stain.size * 0.15, stain.y + stain.size * 0.18, stain.size * 0.23, stain.size * 0.16, 0, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = "rgba(255,255,255,0.18)";
        ctx!.beginPath();
        ctx!.ellipse(stain.x - stain.size * 0.2, stain.y - stain.size * 0.15, stain.size * 0.16, stain.size * 0.11, 0, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
    }

    function updateSpritePosition(
      img: HTMLImageElement | null,
      x: number,
      groundY: number,
      drawH: number,
      runPhase: number,
      visible: boolean,
      frames: string[],
      animate: boolean,
      verticalShift: number,
      restedFrame?: string,
      frameScale = 1
    ) {
      if (!img) return;
      const bob = animate ? Math.sin(runPhase) * 4 : 0;
      const footOffset = 24;
      const isRestingFrame = !!restedFrame && (restedFrame.includes("standing") || restedFrame.includes("tired"));
      const restingVerticalOffset = isRestingFrame ? -8 : 0;
      const currentFrame = img.getAttribute("data-frame");
      const nextFrame = animate
        ? frames[Math.floor((frameTimerRef.current / frameDelayMs) % frames.length)]
        : restedFrame ||
          (currentFrame && frames.includes(currentFrame)
            ? currentFrame
            : frames[0]);
      if (img.getAttribute("data-frame") !== nextFrame) {
        img.setAttribute("data-frame", nextFrame);
        img.src = nextFrame;
      }
      img.style.left = `${x}px`;
      img.style.height = `${drawH}px`;
      img.style.top = `${groundY - drawH + footOffset + bob + verticalShift + restingVerticalOffset}px`;
      img.style.visibility = visible ? "visible" : "hidden";
      img.style.transform = `translateX(-50%) scale(${frameScale})`;
    }

    function loop(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      frameTimerRef.current += dt * 1000;
      starTimeRef.current += dt * 1.5;
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;

      const phaseNow = phaseRef.current;
      let hasMovement = false;
      const groundY = h * 0.8;
      const heroX = w * 0.34;
      const gapPx = (gapRef.current / GAP_MAX) * w * 0.26 + 26;
      const villainX = phaseNow === "caught" ? heroX - 30 : heroX - gapPx;

      if (phaseNow === "running") {
        difficultyRef.current += dt * 0.012;

        const throttle = bleConnectedRef.current
          ? Math.max(0, Math.min(1, bleVelocityRef.current / BLE_MAX_SPEED_KMH))
          : holdingRef.current
          ? 1
          : 0;
        hasMovement = throttle > 0.01;

        if (previousThrottleRef.current > 0.01 && throttle <= 0.01) {
          heroTiredRef.current = true;
        }
        if (throttle > 0.01) {
          heroTiredRef.current = false;
        }
        previousThrottleRef.current = throttle;

        const sprintGain = 26 * difficultyRef.current;
        const baseDrain = 16 * difficultyRef.current;
        const drain =
          throttle > 0
            ? -sprintGain * throttle + baseDrain * 0.4
            : baseDrain;

        if (hasMovement) {
          gapRef.current = Math.max(0, Math.min(GAP_MAX, gapRef.current - drain * dt));
          elapsedRef.current += dt;
          scoreRef.current = Math.floor(elapsedRef.current * 12 * difficultyRef.current);
        } else {
          gapRef.current = Math.max(0, gapRef.current - idleApproachRate * dt);
        }
        setScore(scoreRef.current);
        setGapDisplay(gapRef.current);

        const speedFactor = hasMovement ? 0.9 + throttle * 0.7 : 0;
        groundOffsetRef.current += 260 * speedFactor * dt;
        treeOffsetRef.current += 90 * speedFactor * dt;
        farOffsetRef.current += 30 * speedFactor * dt;
        runCycleRef.current += dt * (hasMovement ? (8 + throttle * 6) * difficultyRef.current : 0);

        if (throttle > 0.15) {
          const puffs = Math.random() < 0.4 ? 3 : 2;
          for (let i = 0; i < puffs; i++) {
            heroDustRef.current.push({
              x: heroX + (Math.random() - 0.5) * 32,
              y: groundY - 6 + Math.random() * 4,
              life: 1,
              size: 18 + Math.random() * 20,
              opacity: 0.6 + Math.random() * 0.25,
            });
          }
        }
        for (const d of heroDustRef.current) d.life -= dt * 1.6;
        heroDustRef.current = heroDustRef.current.filter((d) => d.life > 0);

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
        if (audioRef.current) {
          audioRef.current.pause();
        }
        // Add blood stains on caught
        if (bloodStainsRef.current.length < 18) {
          for (let i = 0; i < 4; i++) {
            bloodStainsRef.current.push({
              x: w * 0.34 + (Math.random() - 0.5) * 220,
              y: h * 0.28 + Math.random() * 220,
              size: 34 + Math.random() * 80,
              opacity: 0.8 + Math.random() * 0.25,
            });
          }
        }
        // Fade blood over time
        for (const stain of bloodStainsRef.current) {
          stain.opacity *= 0.98;
        }
        bloodStainsRef.current = bloodStainsRef.current.filter((s) => s.opacity > 0.05);
      } else if (phaseNow === "paused") {
        runCycleRef.current += dt * 0.5;
        treeOffsetRef.current += 2 * dt;
        if (audioRef.current) {
          audioRef.current.pause();
        }
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
      drawFarShops(w, h, farOffsetRef.current);
      drawMidShops(w, h, treeOffsetRef.current);
      drawGround(w, h, groundOffsetRef.current);
      drawDust(w, h);
      drawBloodStains(w, h);

      const heroDrawH = 160;
      const villainDrawH = 240;
      const heroVerticalShift = 8;
      const villainVerticalShift = 12;
      const villainScale = 1.35;

      drawActorShadow(villainX, groundY, 1.3);
      drawActorShadow(heroX, groundY, 1);
      updateSpritePosition(
        villainNodeRef.current,
        villainX,
        groundY,
        villainDrawH,
        runCycleRef.current + 0.4,
        phaseNow === "running",
        villainFrames,
        true,
        villainVerticalShift,
        undefined,
        villainScale
      );
      updateSpritePosition(
        heroNodeRef.current,
        heroX,
        groundY,
        heroDrawH,
        runCycleRef.current,
        phaseNow === "running",
        heroFrames,
        hasMovement,
        heroVerticalShift,
        heroTiredRef.current ? tiredHeroFrame : heroStandingFrame,
        heroTiredRef.current ? 0.92 : hasMovement ? 1.12 : 0.95
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
  const showVillainBubble = phase === "running" && gapDisplay <= 24;

  return (
    <div style={styles.wrap}>
      <canvas ref={canvasRef} style={styles.canvas} />


      <img
        ref={villainNodeRef}
        src="/sprites/Asura/asur1.png"
        alt="Villain"
        style={{ ...styles.sprite, ...styles.villainSprite }}
      />
      <img
        ref={heroNodeRef}
        src="/sprites/Prince/Prince_standing.png"
        alt="Hero"
        style={styles.sprite}
      />

      {phase === "paused" && (
        <div style={styles.overlay}>
          <div style={styles.panel}>
            <h1 style={styles.title}>Paused</h1>
            <p style={styles.copy}>Take a breath and resume when you’re ready.</p>
            <div style={styles.buttonRow}>
              <button type="button" onClick={resumeGame} style={styles.restartButton}>
                RESUME
              </button>
              <button type="button" onClick={exitGame} style={styles.exitButton}>
                EXIT
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "caught" && (
        <div style={styles.overlay}>
          <div style={styles.panel}>
            <h1 style={styles.title}>Caught!</h1>
            <p style={styles.copy}>You made it {score} paces before the goblin caught you.</p>
            <p style={styles.hint}>Best: {best}</p>
            <div style={styles.buttonRow}>
              <button
                type="button"
                onClick={() => startRun()}
                style={styles.restartButton}
              >
                RESTART
              </button>
              <button
                type="button"
                onClick={exitGame} 
                style={styles.exitButton}
              >
                EXIT
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={styles.hud}>
        <button
          type="button"
          onClick={phase === "paused" ? resumeGame : pauseGame}
          style={styles.pauseButton}
          aria-label={phase === "paused" ? "Resume game" : "Pause game"}
        >
          {phase === "paused" ? (
            <span style={styles.playIcon} />
          ) : (
            <span style={styles.pauseIcon}>
              <span style={styles.pauseBar} />
              <span style={styles.pauseBar} />
            </span>
          )}
        </button>

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

        <div style={styles.scoreboard}>
          <div style={styles.statGroup}>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>SCORE</span>
              <span style={styles.statValue}>{score}</span>
            </div>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>SPEED</span>
              <span style={styles.statValue}>
                {bleConnected ? bleSpeed.toFixed(1) : "0.0"}
                <span style={styles.statUnit}> km/h</span>
              </span>
            </div>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>DISTANCE</span>
              <span style={styles.statValue}>
                {bleConnected ? bleDistance.toFixed(1) : "0.0"}
                <span style={styles.statUnit}> m</span>
              </span>
            </div>
          </div>

          <div style={styles.bleStatusText}>
            {bleConnected ? `Live telemetry: ${bleSpeed.toFixed(1)} km/h • ${bleDistance.toFixed(1)} m` : bleStatus}
          </div>
          {lastBleRaw && (
            <div style={{ fontSize: 11, color: "#cfc4a4", marginTop: 2 }}>
              <div>last pkt: {lastBleRaw.length > 80 ? lastBleRaw.slice(0, 80) + '…' : lastBleRaw}</div>
              <div style={{ fontSize: 11, color: "#a9a9a9" }}>
                {lastBleAt ? `at ${new Date(lastBleAt).toLocaleTimeString()}` : null}
              </div>
            </div>
          )}
        </div>
      </div>
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
    inset: 0,
    pointerEvents: "none",
    zIndex: 200,
  },
  scoreboard: {
    position: "absolute",
    left: "50%",
    bottom: 18,
    transform: "translateX(-50%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    pointerEvents: "auto",
    padding: "10px 14px",
  },
  statGroup: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  statBox: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    background: "rgba(10,17,40,0.72)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: 12,
    padding: "8px 14px",
    minWidth: 88,
    minHeight: 62,
    justifyContent: "center",
  },
  statLabel: {
    fontSize: 11,
    letterSpacing: 1.6,
    color: "#f2ead8aa",
  },
  statValue: {
    fontSize: 24,
    fontWeight: 700,
    fontFamily: "monospace",
    color: "#fff7e6",
    textShadow: "0 2px 4px rgba(0,0,0,0.45)",
  },
  statUnit: {
    fontSize: 12,
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
  pauseButton: {
    position: "absolute",
    top: 14,
    left: 18,
    pointerEvents: "auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    background: "rgba(81, 47, 14, 0.8)",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: "50%",
    padding: 0,
    cursor: "pointer",
  },
  pauseIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  pauseBar: {
    width: 4,
    height: 14,
    borderRadius: 2,
    background: "#fff7e6",
  },
  playIcon: {
    width: 0,
    height: 0,
    borderTop: "7px solid transparent",
    borderBottom: "7px solid transparent",
    borderLeft: "12px solid #fff7e6",
    marginLeft: 2,
  },
  bleButton: {
    position: "absolute",
    top: 14,
    right: 18,
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
    fontSize: 12,
    color: "#f2ead899",
    textAlign: "center",
    fontWeight: 600,
  },
  overlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.7)",
    zIndex: 100,
  },
  panel: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    background: "rgba(20,25,30,0.9)",
    border: "2px solid rgba(255,255,255,0.15)",
    borderRadius: 20,
    padding: "32px 48px",
    boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
    textAlign: "center",
  },
  title: {
    margin: 0,
    color: "#fff",
    fontSize: 32,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  copy: {
    margin: 0,
    color: "#ccc",
    fontSize: 16,
  },
  hint: {
    margin: 0,
    color: "#888",
    fontSize: 14,
  },
  buttonRow: {
    display: "flex",
    gap: 12,
    marginTop: 8,
  },
  restartButton: {
    background: "#fff",
    color: "#000",
    border: "none",
    borderRadius: 8,
    padding: "12px 24px",
    fontSize: 16,
    fontWeight: "bold",
    cursor: "pointer",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  exitButton: {
    background: "rgba(255,255,255,0.15)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.3)",
    borderRadius: 8,
    padding: "12px 24px",
    fontSize: 16,
    fontWeight: "bold",
    cursor: "pointer",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  speechBubble: {
    position: "absolute",
    left: "26vw",
    top: "18vh",
    zIndex: 90,
    maxWidth: 260,
    padding: "10px 12px",
    borderRadius: 16,
    background: "rgba(255,245,220,0.96)",
    color: "#2d180a",
    boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
    border: "2px solid rgba(120,60,20,0.25)",
    transform: "translate(-8%, -100%)",
  },
  speechBubbleText: {
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.35,
    textShadow: "0 1px 1px rgba(255,255,255,0.5)",
  },
  speechBubbleTail: {
    position: "absolute",
    left: 24,
    bottom: -11,
    width: 0,
    height: 0,
    borderLeft: "10px solid transparent",
    borderRight: "10px solid transparent",
    borderTop: "12px solid rgba(255,245,220,0.96)",
    filter: "drop-shadow(0 4px 4px rgba(0,0,0,0.2))",
  },
  sprite: {
    position: "absolute",
    transformOrigin: "bottom center",
    imageRendering: "pixelated",
    pointerEvents: "none",
  },
  villainSprite: {
    zIndex: 10,
  }
};