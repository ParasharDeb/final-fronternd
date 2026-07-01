"use client";

import Link from "next/link";

export default function LandingMenu() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #08111a 0%, #162231 45%, #0f1b1f 100%)",
        color: "#fff7e6",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(460px, 100%)",
          padding: "36px 28px",
          borderRadius: 24,
          background: "rgba(11, 19, 25, 0.84)",
          border: "1px solid rgba(255,255,255,0.14)",
          boxShadow: "0 20px 48px rgba(0,0,0,0.38)",
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.32em", color: "#d8c59c", textTransform: "uppercase" }}>
          Endless chase
        </p>
        <h1 style={{ margin: "8px 0 12px", fontSize: "clamp(32px, 5vw, 48px)", lineHeight: 1.1 }}>
          Seer&apos;s Escape
        </h1>
        <p style={{ margin: "0 0 24px", fontSize: 16, lineHeight: 1.6, color: "#e7ddc4" }}>
          Sprint on the treadmill, outrun the villain, and survive the chase.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Link
            href="/run"
            style={{
              display: "block",
              padding: "14px 18px",
              borderRadius: 999,
              background: "#4d7d42",
              color: "#fff",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Start Run
          </Link>
          <Link
            href="/run?restart=1"
            style={{
              display: "block",
              padding: "14px 18px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.12)",
              color: "#f5ebcf",
              fontWeight: 600,
              textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.16)",
            }}
          >
            Restart Game
          </Link>
        </div>
      </div>
    </main>
  );
}
