"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const messages = [
  "Connecting to PerpX infrastructure...",
  "Waking up trading services...",
  "Establishing secure connection...",
  "Loading market data...",
  "Initializing trading engine...",
];

export function StartingBackendPage() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((current) => (current + 1) % messages.length);
    }, 2200);

    return () => clearInterval(interval);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080808] text-white">
      <div className="w-full max-w-lg px-6 text-center">

        {/* Animated PerpX Logo */}
        <div className="relative mx-auto mb-9 h-28 w-28">

          {/* Outer rotating ring */}
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-white/10 border-t-white"
            animate={{ rotate: 360 }}
            transition={{
              duration: 1.1,
              repeat: Infinity,
              ease: "linear",
            }}
          />

          {/* Inner rotating ring */}
          <motion.div
            className="absolute inset-3 rounded-full border border-white/10 border-b-white/60"
            animate={{ rotate: -360 }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: "linear",
            }}
          />

          {/* PX Core */}
          <motion.div
            className="absolute inset-[25px] flex items-center justify-center rounded-2xl border border-white/10 bg-[#111] shadow-[0_0_40px_rgba(255,255,255,0.08)]"
            animate={{
              scale: [1, 1.04, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <span className="text-sm font-bold tracking-[0.15em]">
              PX
            </span>
          </motion.div>
        </div>

        {/* System status */}
        <div className="mb-4 flex items-center justify-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-zinc-500">
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-white"
            animate={{
              opacity: [1, 0.25, 1],
              scale: [1, 0.75, 1],
            }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          SYSTEM STARTING
        </div>

        {/* Main heading */}
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          PerpX is waking up
        </h1>

        {/* Animated status message */}
        <div className="mt-4 h-6">
          <AnimatePresence mode="wait">
            <motion.p
              key={messageIndex}
              initial={{
                opacity: 0,
                y: 6,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                y: -6,
              }}
              transition={{
                duration: 0.35,
                ease: "easeOut",
              }}
              className="text-sm text-zinc-400"
            >
              {messages[messageIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Animated progress indicator */}
        <div className="mx-auto mt-7 h-[2px] w-56 overflow-hidden bg-white/[0.08]">
          <motion.div
            className="h-full w-1/3 bg-white"
            animate={{
              x: ["-150%", "600%"],
            }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>

        {/* Recruiter-friendly explanation */}
        <p className="mx-auto mt-6 max-w-md text-xs leading-relaxed text-zinc-600">
          The frontend is ready. Backend services are starting up.
          PerpX will automatically continue once the trading engine
          becomes available.
        </p>
      </div>
    </main>
  );
}

