"use client";

import { useEffect, useId, useMemo, useState } from "react";

type WaterBottleAnimationProps = {
  percentageFilled: number;
  isCollected?: boolean;
  onCollect?: () => void;
  className?: string;
  waterColor?: string;
  glassColor?: string;
};

export default function WaterBottleAnimation({
  percentageFilled,
  isCollected = false,
  onCollect,
  className,
  waterColor = "#38bdf8",
  glassColor = "#cbd5e1",
}: WaterBottleAnimationProps) {
  const [isPopping, setIsPopping] = useState(false);
  const clipId = useId();
  const fill = Math.max(0, Math.min(100, percentageFilled));
  const fillY = useMemo(() => 44 - (30 * fill) / 100, [fill]);

  useEffect(() => {
    if (!isCollected) return;
    const enterId = window.setTimeout(() => setIsPopping(true), 0);
    const exitId = window.setTimeout(() => setIsPopping(false), 280);
    return () => {
      window.clearTimeout(enterId);
      window.clearTimeout(exitId);
    };
  }, [isCollected]);

  return (
    <button
      type="button"
      className={`relative w-6 h-6 transition-transform duration-200 active:scale-95 ${isPopping ? "animate-bottle-pop" : ""} ${className ?? ""}`}
      onClick={() => {
        setIsPopping(true);
        onCollect?.();
        window.setTimeout(() => setIsPopping(false), 280);
      }}
      style={
        {
          "--bottle-water": waterColor,
          "--bottle-glass": glassColor,
        } as React.CSSProperties
      }
      aria-label="Water bottle collection"
    >
      <svg viewBox="0 0 44 44" className="w-full h-full">
        <defs>
          <clipPath id={clipId}>
            <path d="M16 7h12v5c0 1.2.6 2.2 1.6 2.9A8 8 0 0 1 33 21v12c0 3.9-3.1 7-7 7h-8c-3.9 0-7-3.1-7-7V21a8 8 0 0 1 3.4-6.1c1-.7 1.6-1.7 1.6-2.9z" />
          </clipPath>
        </defs>
        <rect x="17" y="4" width="10" height="4" rx="1.5" style={{ fill: "var(--bottle-glass)" }} />
        <path
          d="M16 7h12v5c0 1.2.6 2.2 1.6 2.9A8 8 0 0 1 33 21v12c0 3.9-3.1 7-7 7h-8c-3.9 0-7-3.1-7-7V21a8 8 0 0 1 3.4-6.1c1-.7 1.6-1.7 1.6-2.9z"
          fill="none"
          stroke="var(--bottle-glass)"
          strokeWidth="2"
        />
        <g clipPath={`url(#${clipId})`}>
          <rect
            x="10"
            y={fillY}
            width="24"
            height="34"
            style={{ fill: "var(--bottle-water)" }}
            className="transition-all duration-300 ease-out"
          />
          <ellipse
            cx="22"
            cy={fillY}
            rx="12"
            ry="2"
            style={{ fill: "rgba(255,255,255,0.35)" }}
            className="transition-all duration-300 ease-out"
          />
        </g>
      </svg>
    </button>
  );
}
