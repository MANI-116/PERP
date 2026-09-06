"use client";

import { motion } from "framer-motion";

const services = [
  "Trading Engine",
  "Market Data",
  "Realtime Gateway",
];

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden bg-[#08090c] text-white">
      <div className="relative w-full max-w-lg px-6">

        {/* Ambient glow */}
        <motion.div
          className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/10 blur-3xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.6, 0.35] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative flex flex-col items-center">

          {/* Exchange mark */}
          <motion.div
            className="relative mb-8 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] shadow-2xl"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="absolute inset-0 rounded-2xl border border-cyan-400/30"
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            />

            <span className="text-xl font-bold tracking-widest text-cyan-400">
              PX
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            className="text-center text-2xl font-semibold tracking-tight"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Starting exchange services
          </motion.h1>

          <motion.p
            className="mt-3 max-w-sm text-center text-sm leading-6 text-zinc-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            Connecting the trading engine, market data and realtime gateway.
          </motion.p>

          {/* Services */}
          <div className="mt-8 w-full space-y-2">
            {services.map((service, index) => (
              <motion.div
                key={service}
                className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.12 }}
              >
                <span className="text-sm text-zinc-400">{service}</span>

                <motion.span
                  className="h-2 w-2 rounded-full bg-cyan-400"
                  animate={{
                    opacity: [0.25, 1, 0.25],
                    scale: [0.8, 1.15, 0.8],
                  }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    delay: index * 0.2,
                  }}
                />
              </motion.div>
            ))}
          </div>

          {/* Progress */}
          <motion.div
            className="mt-8 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <motion.div
              className="h-full w-1/3 rounded-full bg-cyan-400"
              animate={{ x: ["-100%", "350%"] }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </motion.div>

          <motion.div
            className="mt-4 flex items-center gap-2 text-xs text-zinc-600"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            Establishing secure connections
          </motion.div>
        </div>
      </div>
    </main>
  );
}

