'use client'
import { useEffect, useRef, useState } from "react";

export default function DuskrunLanding() {
  const treelineRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const treeline = treelineRef.current;
    if (!treeline || treeline.children.length > 0) return;
    for (let i = 0; i < 30; i++) {
      const t = document.createElement("div");
      t.className = "dr-tree";
      treeline.appendChild(t);
    }
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const toggleMusic = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  return (
    <div className="dr-root">
      <style>{css}</style>

      <nav>
        <div className="dr-logo pixel">
          DUSK<span>RUN</span>
        </div>
        <button className="dr-nav-cta" onClick={() => scrollTo("cta")}>
          Connect Treadmill
        </button>
      </nav>

      <header className="dr-hero">
        <div className="dr-stars" />
        <div className="dr-hud">
          <div className="dr-hud-box">
            <div className="dr-hud-label">SCORE</div>
            <div className="dr-hud-value">14</div>
          </div>
          <div className="dr-hud-box">
            <div className="dr-hud-label">SPEED</div>
            <div className="dr-hud-value">6.2</div>
          </div>
          <div className="dr-hud-box">
            <div className="dr-hud-label">DIST</div>
            <div className="dr-hud-value">240m</div>
          </div>
        </div>

        <div className="dr-hero-content">
          <div className="dr-eyebrow pixel">YOUR LEGS ARE THE CONTROLLER</div>
          <h1 className="pixel">
            Run for real.
            <br />
            Escape for good.
          </h1>
          <p className="dr-sub">
            DUSKRUN turns your treadmill into a bow-and-arrow into an infinite
            night forest. Step on, sync up, and your real pace decides
            whether the goblins behind you catch up.
          </p>
          <div className="dr-hero-actions">
            <button className="dr-btn dr-btn-primary" onClick={() => scrollTo("cta")}>
              Connect Treadmill
            </button>
            <button className="dr-btn dr-btn-ghost" onClick={() => scrollTo("how")}>
              How it works
            </button>
          </div>
        </div>

        <div className="dr-scene">
          <div className="dr-treeline" ref={treelineRef} />
          <div className="dr-goblin">
            <div className="dr-g-head" />
            <div className="dr-g-body" />
            <div className="dr-g-leg" />
            <div className="dr-g-leg r" />
          </div>
          <div className="dr-runner-wrap">
            <div className="dr-runner">
              <div className="dr-hair" />
              <div className="dr-head" />
              <div className="dr-body" />
              <div className="dr-bow" />
              <div className="dr-leg" />
              <div className="dr-leg r" />
            </div>
          </div>
          <div className="dr-ground" />
        </div>
      </header>

      <section>
        <div className="dr-section-head">
          <div className="dr-section-tag pixel">WHY IT WORKS</div>
          <h2 className="dr-section-title pixel">
            Three things make this different from a screen.
          </h2>
        </div>
        <div className="dr-features">
          <div className="dr-feature">
            <svg className="dr-feature-icon" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 21l6-6M21 3l-6 6M14 4l6 6-10 10-6-6L14 4z"
                stroke="#e8753a"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h3>Your pace is the throttle</h3>
            <p>
              Speed up on the belt, the archer speeds up on screen. Slow
              down, and the distance between you and the goblin pack closes.
              No buttons — just stride.
            </p>
          </div>
          <div className="dr-feature">
            <svg className="dr-feature-icon" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                stroke="#f4e6c1"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <h3>One tap to sync</h3>
            <p>
              Connect Treadmill links most Bluetooth and ANT+ treadmills in
              seconds. No account, no calibration walk — just step on and the
              belt speed becomes your in-game speed.
            </p>
          </div>
          <div className="dr-feature">
            <svg className="dr-feature-icon" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#1f4a36" strokeWidth="1.6" />
              <path d="M12 7v5l3 3" stroke="#1f4a36" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <h3>A run that escalates</h3>
            <p>
              Score climbs with distance, speed climbs with the score, and
              the forest never repeats the same stretch twice. The only way
              to see further is to run faster.
            </p>
          </div>
        </div>
      </section>

      <section id="how">
        <div className="dr-section-head">
          <div className="dr-section-tag pixel">GETTING STARTED</div>
          <h2 className="dr-section-title pixel">
            From standstill to full sprint in three steps.
          </h2>
        </div>
        <div className="dr-steps">
          <div className="dr-step">
            <div className="dr-step-num pixel">01</div>
            <div>
              <h4>Open DUSKRUN, tap Connect Treadmill</h4>
              <p>
                The red dot in the top right turns green once your treadmill
                answers. Works with most consumer treadmills that broadcast
                speed over Bluetooth.
              </p>
            </div>
          </div>
          <div className="dr-step">
            <div className="dr-step-num pixel">02</div>
            <div>
              <h4>Start the belt</h4>
              <p>
                The moment the belt moves, the speed readout in-game ticks up
                and the archer starts running the tree line. No countdown, no
                menu — your first step is the start button.
              </p>
            </div>
          </div>
          <div className="dr-step">
            <div className="dr-step-num pixel">03</div>
            <div>
              <h4>Hold your pace, watch your score</h4>
              <p>
                Distance and score climb as long as you keep moving. Ease off
                and the goblin on your heels closes the gap — the only way to
                lose it is to keep running.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="dr-section-head">
          <div className="dr-section-tag pixel">THE WORLD</div>
          <h2 className="dr-section-title pixel">Every run finds new ground.</h2>
        </div>
        <div className="dr-world">
          <div className="dr-ridge" />
          <div className="dr-silhouette" />
          <div className="dr-caption pixel">RIVER CROSSING — UNLOCKED AT 2KM</div>
        </div>
      </section>

      <div className="dr-cta-band" id="cta">
        <h2 className="pixel">Lace up. Step on. Run.</h2>
        <p>
          DUSKRUN is free to play with any connected treadmill. Bring your
          own pace — the forest will keep up.
        </p>
        <button className="dr-btn dr-btn-primary">Connect Treadmill</button>
      </div>

      <footer>
        © 2026 DUSKRUN. Built for runners who'd rather race a goblin than a
        progress bar.
      </footer>
    </div>
  );
}

const css = `
.dr-root{
  --night:#0b1220;
  --night-deep:#070b14;
  --moon:#f4e6c1;
  --moon-glow:#fff7df;
  --forest:#1f4a36;
  --forest-dark:#13301f;
  --ember:#e8753a;
  --temple:#8a2f2f;
  --paper:#f4f1e8;
  --line:rgba(244,241,232,0.14);
  background:var(--night-deep);
  color:var(--paper);
  font-family:'JetBrains Mono', monospace;
  overflow-x:hidden;
}
.dr-root *{box-sizing:border-box;}
.dr-root .pixel{font-family:'Press Start 2P', monospace;}

.dr-root nav{
  position:fixed; top:0; left:0; right:0; z-index:50;
  display:flex; align-items:center; justify-content:space-between;
  padding:18px 32px;
  background:linear-gradient(to bottom, rgba(7,11,20,0.92), rgba(7,11,20,0));
}
.dr-logo{font-size:14px; letter-spacing:2px; color:var(--moon-glow);}
.dr-logo span{color:var(--ember);}
.dr-nav-cta{
  font-family:'JetBrains Mono', monospace; font-weight:700; font-size:13px;
  color:var(--night-deep); background:var(--moon-glow);
  border:none; padding:10px 18px; border-radius:2px; cursor:pointer;
  box-shadow:0 0 0 2px var(--night-deep), 0 0 0 3px var(--moon-glow);
}

.dr-hero{
  position:relative; height:100vh; min-height:680px;
  display:flex; align-items:flex-end; justify-content:center;
  background:
    radial-gradient(120px 120px at 82% 18%, var(--moon-glow), var(--moon) 55%, transparent 70%),
    linear-gradient(to bottom, #0a1830 0%, #102241 35%, #16345e 60%, var(--night) 100%);
  overflow:hidden;
  border-bottom:1px solid var(--line);
}
.dr-stars{position:absolute; inset:0; background-image:
    radial-gradient(1.5px 1.5px at 10% 20%, #fff, transparent),
    radial-gradient(1.5px 1.5px at 30% 10%, #fff, transparent),
    radial-gradient(1px 1px at 50% 30%, #fff, transparent),
    radial-gradient(1.5px 1.5px at 70% 15%, #fff, transparent),
    radial-gradient(1px 1px at 90% 25%, #fff, transparent),
    radial-gradient(1.5px 1.5px at 20% 50%, #fff, transparent),
    radial-gradient(1px 1px at 40% 60%, #fff, transparent),
    radial-gradient(1.5px 1.5px at 60% 40%, #fff, transparent),
    radial-gradient(1px 1px at 15% 70%, #fff, transparent),
    radial-gradient(1.5px 1.5px at 85% 55%, #fff, transparent);
  opacity:0.7;
}
.dr-hero-content{ position:relative; z-index:5; text-align:center; padding-bottom:230px; width:100%; }
.dr-eyebrow{ font-size:9px; letter-spacing:3px; color:var(--ember); margin-bottom:18px; }
.dr-eyebrow::before{content:"\\25CF "; color:#e85b4a;}
.dr-hero-content h1.pixel{
  font-size:clamp(28px,6vw,56px); line-height:1.4; color:var(--moon-glow);
  text-shadow:0 0 24px rgba(244,230,193,0.35), 4px 4px 0 rgba(0,0,0,0.4);
  margin-bottom:22px;
}
.dr-sub{ max-width:540px; margin:0 auto 34px; font-size:15px; line-height:1.7; color:rgba(244,241,232,0.78); }
.dr-hero-actions{display:flex; gap:14px; justify-content:center; flex-wrap:wrap;}
.dr-btn{
  font-family:'JetBrains Mono', monospace; font-weight:700; font-size:14px;
  padding:14px 26px; border-radius:2px; cursor:pointer; border:2px solid transparent;
  transition:transform .15s ease;
}
.dr-btn:hover{transform:translateY(-2px);}
.dr-btn-primary{background:var(--ember); color:#1a0f08; box-shadow:4px 4px 0 #7c3010;}
.dr-btn-primary:hover{box-shadow:2px 2px 0 #7c3010; transform:translate(2px,2px);}
.dr-btn-ghost{background:transparent; color:var(--moon-glow); border-color:var(--moon-glow);}

.dr-scene{
  position:absolute; bottom:0; left:0; right:0; height:230px;
  background:linear-gradient(to bottom, transparent, var(--forest-dark) 60%);
}
.dr-treeline{ position:absolute; bottom:46px; left:0; right:0; height:120px; display:flex; align-items:flex-end; }
.dr-treeline .dr-tree{
  width:64px; height:84px; border-radius:50% 50% 8px 8px / 60% 60% 8px 8px;
  background:var(--forest); margin-right:-18px; flex-shrink:0;
  box-shadow:inset -8px -10px 0 rgba(0,0,0,0.18);
}
.dr-treeline .dr-tree:nth-child(odd){height:96px; background:var(--forest-dark);}
.dr-ground{
  position:absolute; bottom:0; left:0; right:0; height:46px;
  background:repeating-linear-gradient(90deg, #3a2a1c 0 38px, #2c2014 38px 40px);
  border-top:2px solid #1a130c;
}
.dr-runner-wrap{ position:absolute; bottom:46px; left:50%; transform:translateX(-50%); width:38px; height:60px; z-index:6; }
.dr-runner{ position:relative; width:100%; height:100%; animation: dr-bob 0.5s steps(2) infinite; }
.dr-runner .dr-head{position:absolute; top:0; left:10px; width:16px; height:16px; background:#e7b27a; border-radius:3px;}
.dr-runner .dr-hair{position:absolute; top:-2px; left:8px; width:18px; height:8px; background:#caa24a; border-radius:3px 3px 0 0;}
.dr-runner .dr-body{position:absolute; top:16px; left:8px; width:20px; height:24px; background:#2f4a30; border-radius:3px;}
.dr-runner .dr-bow{position:absolute; top:14px; left:26px; width:6px; height:26px; background:var(--ember); border-radius:3px;}
.dr-runner .dr-leg{position:absolute; bottom:0; left:11px; width:6px; height:16px; background:#3a2a1c;}
.dr-runner .dr-leg.r{left:21px;}
@keyframes dr-bob{ 0%{transform:translateY(0);} 50%{transform:translateY(-3px);} 100%{transform:translateY(0);} }

.dr-goblin{ position:absolute; bottom:46px; left:calc(50% - 90px); width:30px; height:48px; z-index:5; opacity:0.92; }
.dr-goblin .dr-g-head{position:absolute; top:0; left:6px; width:18px; height:14px; background:#5f8d4e; border-radius:3px;}
.dr-goblin .dr-g-body{position:absolute; top:12px; left:4px; width:22px; height:22px; background:#3f5e34; border-radius:3px;}
.dr-goblin .dr-g-leg{position:absolute; bottom:0; left:6px; width:6px; height:14px; background:#2c421f;}
.dr-goblin .dr-g-leg.r{left:18px;}

.dr-hud{ position:absolute; top:90px; left:50%; transform:translateX(-50%); display:flex; gap:10px; z-index:7; }
.dr-hud-box{ background:rgba(7,11,20,0.55); border:1px solid var(--line); border-radius:4px; padding:8px 14px; text-align:left; backdrop-filter:blur(2px); }
.dr-hud-label{font-size:9px; letter-spacing:1.5px; color:rgba(244,241,232,0.55);}
.dr-hud-value{font-family:'Press Start 2P', monospace; font-size:13px; color:var(--moon-glow); margin-top:4px;}

.dr-root section{padding:90px 24px; max-width:1080px; margin:0 auto;}
.dr-section-head{text-align:center; margin-bottom:56px;}
.dr-section-tag{font-size:9px; letter-spacing:3px; color:var(--ember); margin-bottom:14px;}
.dr-section-title.pixel{font-size:clamp(20px,3vw,30px); color:var(--paper); line-height:1.6;}

.dr-features{display:grid; grid-template-columns:repeat(3,1fr); gap:24px;}
.dr-feature{
  background:linear-gradient(160deg, rgba(31,74,54,0.25), rgba(11,18,32,0.4));
  border:1px solid var(--line); border-radius:6px; padding:28px 22px;
}
.dr-feature-icon{width:38px; height:38px; margin-bottom:18px;}
.dr-feature h3{font-size:16px; margin-bottom:10px; color:var(--moon-glow);}
.dr-feature p{font-size:13.5px; line-height:1.7; color:rgba(244,241,232,0.7);}

.dr-steps{display:flex; flex-direction:column; gap:0; border-top:1px solid var(--line);}
.dr-step{ display:grid; grid-template-columns:80px 1fr; gap:24px; padding:26px 0; border-bottom:1px solid var(--line); }
.dr-step-num{font-size:20px; color:var(--temple);}
.dr-step h4{font-size:15px; color:var(--moon-glow); margin-bottom:6px;}
.dr-step p{font-size:13.5px; color:rgba(244,241,232,0.7); line-height:1.6; max-width:560px;}

.dr-world{
  position:relative; border-radius:8px; overflow:hidden; height:340px; border:1px solid var(--line);
  background:
    radial-gradient(90px 90px at 88% 15%, #cfe3ff, #9bb8de 50%, transparent 70%),
    linear-gradient(to bottom, #0c1830, #16294a 55%, #0e1c33 100%);
}
.dr-world .dr-silhouette{ position:absolute; bottom:0; left:0; right:0; height:55%; background:linear-gradient(180deg, transparent, #0a1422 70%); }
.dr-world .dr-ridge{
  position:absolute; bottom:0; left:0; right:0; height:120px; background:#14233a;
  clip-path:polygon(0 60%,8% 40%,18% 55%,30% 25%,42% 50%,55% 20%,68% 48%,80% 30%,92% 50%,100% 35%,100% 100%,0 100%);
}
.dr-world .dr-caption{
  position:absolute; bottom:18px; left:24px; z-index:4; font-size:8px; letter-spacing:2px;
  color:rgba(244,241,232,0.8); background:rgba(7,11,20,0.55); padding:8px 12px; border-radius:3px; border:1px solid var(--line);
}

.dr-cta-band{
  text-align:center; padding:100px 24px;
  background:linear-gradient(180deg, var(--night-deep), #0c1426);
  border-top:1px solid var(--line);
}
.dr-cta-band h2.pixel{font-size:clamp(20px,3.4vw,32px); color:var(--moon-glow); margin-bottom:18px; line-height:1.6;}
.dr-cta-band p{color:rgba(244,241,232,0.7); max-width:480px; margin:0 auto 30px; font-size:14px; line-height:1.7;}

.dr-root footer{ padding:32px 24px; text-align:center; font-size:12px; color:rgba(244,241,232,0.45); border-top:1px solid var(--line); }

@media(max-width:760px){
  .dr-features{grid-template-columns:1fr;}
  .dr-step{grid-template-columns:48px 1fr;}
  .dr-hero-content{padding-bottom:200px;}
  .dr-hud{display:none;}
}
`;