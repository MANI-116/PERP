"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

/**
 * Mobile-only bottom sheet.
 *
 * Purely presentational: it renders children in a slide-up panel
 * on screens below `md` and does nothing above that. It never
 * unmounts children while closed would be needed — callers control
 * mounting via `open`.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[1px] md:hidden"
          />

          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            role="dialog"
            aria-modal="true"
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-2xl border-t border-[#252930] bg-zinc-900 shadow-2xl md:hidden"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[#252930] px-4 py-3">
              <span className="text-sm font-medium text-white">
                {title ?? "Menu"}
              </span>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-zinc-200"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
