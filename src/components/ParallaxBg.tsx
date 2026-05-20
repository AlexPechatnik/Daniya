"use client";
import { motion, useScroll, useTransform } from "framer-motion";

export function ParallaxBg() {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 600], [0, -80]);
  const y2 = useTransform(scrollY, [0, 600], [0, -40]);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div style={{ y: y1 }} className="absolute inset-0 parallax-bg" />
      <motion.div style={{ y: y2 }} className="absolute inset-0 grid-pattern" />
    </div>
  );
}
