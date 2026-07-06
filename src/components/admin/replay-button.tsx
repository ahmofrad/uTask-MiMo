"use client";

import { useState } from "react";

export function ReplayButton({ deliveryId }: { deliveryId: string }) {
  const [replaying, setReplaying] = useState(false);
  const [done, setDone] = useState(false);

  async function replay() {
    setReplaying(true);
    try {
      const res = await fetch(`/api/v1/webhook-deliveries/${deliveryId}/replay`, { method: "POST" });
      if (res.ok) setDone(true);
    } finally {
      setReplaying(false);
    }
  }

  if (done) {
    return <span className="text-xs text-success">Replayed</span>;
  }

  return (
    <button
      onClick={replay}
      disabled={replaying}
      className="text-xs text-accent hover:underline disabled:opacity-50"
    >
      {replaying ? "Replaying..." : "Replay"}
    </button>
  );
}
