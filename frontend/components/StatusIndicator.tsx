"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Status = "checking" | "ready" | "reconnecting";

export default function StatusIndicator() {
  const [status, setStatus] = useState<Status>("checking");

  async function check() {
    try {
      const res = await fetch(`${API}/health`, { cache: "no-store" });
      setStatus(res.ok ? "ready" : "reconnecting");
    } catch {
      setStatus("reconnecting");
    }
  }

  useEffect(() => {
    check();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "checking") return null;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={`w-2 h-2 rounded-full ${
          status === "ready" ? "bg-green-500" : "bg-amber-400"
        }`}
      />
      {status === "ready" ? (
        <span className="text-green-700 font-medium">Scoring service ready</span>
      ) : (
        <span className="text-amber-700 font-medium flex items-center gap-2">
          Reconnecting
          <button
            onClick={check}
            className="underline hover:no-underline"
          >
            Retry
          </button>
        </span>
      )}
    </div>
  );
}
