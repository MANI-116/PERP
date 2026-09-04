"use client";

import { useEffect, useState } from "react";
import { StartingBackendPage } from "./StartingBackendPage";
import { API_BASE } from "@/lib/config";

export function BackendGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const checkHealth = async (attempt = 0) => {
      try {
        const response = await fetch(`${API_BASE}/health`, {
          cache: "no-store",
        });

        if (response.ok) {
          const data = await response.json();

          if (data.status === "ok") {
            if (!cancelled) setReady(true);
            return;
          }
        }
      } catch {
        // Backend still starting.
      }

      if (cancelled) return;

      const delay = Math.min(1000 * 2 ** attempt, 10000);

      timer = setTimeout(() => {
        checkHealth(attempt + 1);
      }, delay);
    };

    checkHealth();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (!ready) {
    return <StartingBackendPage />;
  }

  return <>{children}</>;
}