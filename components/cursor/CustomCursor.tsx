"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export function CustomCursor() {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isPointer, setIsPointer] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
    };
    const handleOver = () => setIsPointer(true);
    const handleOut = () => setIsPointer(false);
    document.addEventListener("mousemove", handleMove);
    document.querySelectorAll("a, button, [role='button']").forEach((el) => {
      el.addEventListener("mouseover", handleOver);
      el.addEventListener("mouseout", handleOut);
    });
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.querySelectorAll("a, button, [role='button']").forEach((el) => {
        el.removeEventListener("mouseover", handleOver);
        el.removeEventListener("mouseout", handleOut);
      });
    };
  }, []);

  if (!mounted || typeof window === "undefined") return null;

  const isTouch =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0;

  if (isTouch) return null;

  return (
    <>
      <motion.div
        className="pointer-events-none fixed left-0 top-0 z-[9999] mix-blend-difference"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px)`,
        }}
      >
        <motion.span
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-parchment"
          style={{ width: 8, height: 8 }}
          animate={{ scale: isPointer ? 0.5 : 1 }}
          transition={{ duration: 0.2 }}
        />
        <motion.span
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-parchment bg-transparent"
          style={{ width: 32, height: 32 }}
          animate={{
            scale: isPointer ? 1.5 : 1,
            opacity: isPointer ? 0.6 : 0.4,
          }}
          transition={{ duration: 0.2 }}
        />
      </motion.div>
    </>
  );
}
