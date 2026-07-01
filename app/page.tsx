"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ChaseRunner from "@/components/ChaseRunner";
import LandingMenu from "@/components/LandingMenu";

function RestartGate() {
  const searchParams = useSearchParams();
  const [autoStart, setAutoStart] = useState(false);
  const [showGame, setShowGame] = useState(false);

  useEffect(() => {
    const shouldStart = searchParams.get("restart") === "1";
    setAutoStart(shouldStart);
    setShowGame(shouldStart);
  }, [searchParams]);

  if (!showGame) {
    return <LandingMenu />;
  }

  return <ChaseRunner autoStart={autoStart} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RestartGate />
    </Suspense>
  );
}
