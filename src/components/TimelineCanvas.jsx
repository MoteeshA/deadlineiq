// src/components/TimelineCanvas.jsx
// Canvas player for the DeadlineIQ cinematic motion sequence.

import { useEffect, useRef, useState } from "react";

const DEFAULT_TOTAL_FRAMES = 300;
const FIRST_VISIBLE_FRAME = 1;

function drawFrame(canvas, img, fit) {
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const imageRatio = img.width / img.height;
  const canvasRatio = rect.width / rect.height;
  const shouldCover = fit === "cover";
  const useWidth = shouldCover ? imageRatio < canvasRatio : imageRatio > canvasRatio;
  const drawWidth = useWidth ? rect.width : rect.height * imageRatio;
  const drawHeight = useWidth ? rect.width / imageRatio : rect.height;
  const drawX = (rect.width - drawWidth) / 2;
  const drawY = (rect.height - drawHeight) / 2;

  ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
}

export default function TimelineCanvas({
  className = "",
  fit = "contain",
  framePath = "/rmotion",
  hint = true,
  onRevealComplete,
  totalFrames = DEFAULT_TOTAL_FRAMES,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const imagesRef = useRef([]);
  const frameIndexRef = useRef(0);
  const targetFrameRef = useRef(0);
  const lastInteractionAtRef = useRef(0);
  const animationFrameIdRef = useRef(null);
  const [loadedCount, setLoadedCount] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let loaded = 0;
    let started = false;
    const images = [];

    const renderFrame = () => {
      const canvas = canvasRef.current;
      const currentFrame = frameIndexRef.current;
      const recentlyInteracted = Date.now() - lastInteractionAtRef.current < 1200;

      if (recentlyInteracted) {
        frameIndexRef.current += (targetFrameRef.current - currentFrame) * 0.13;
      } else {
        frameIndexRef.current = (currentFrame + 0.32) % totalFrames;
        targetFrameRef.current = frameIndexRef.current;
      }

      const frameToDraw = Math.max(0, Math.min(totalFrames - 1, Math.round(frameIndexRef.current)));
      const img = imagesRef.current[frameToDraw];

      if (canvas && img?.complete && img.naturalWidth > 0) {
        drawFrame(canvas, img, fit);
      }

      if (frameToDraw === totalFrames - 1) {
        onRevealComplete?.();
      }

      animationFrameIdRef.current = requestAnimationFrame(renderFrame);
    };

    const startPlayback = () => {
      if (started) return;
      started = true;
      setReady(true);
      animationFrameIdRef.current = requestAnimationFrame(renderFrame);
    };

    for (let i = 1; i <= totalFrames; i++) {
      const img = new Image();
      const paddedNum = String(i).padStart(3, "0");
      img.src = `${framePath}/ezgif-frame-${paddedNum}.jpg`;
      img.onload = img.onerror = () => {
        loaded += 1;
        setLoadedCount(loaded);
        if (i === FIRST_VISIBLE_FRAME || loaded >= 10) startPlayback();
      };
      images.push(img);
    }

    imagesRef.current = images;

    const handleResize = () => {
      const canvas = canvasRef.current;
      const img = imagesRef.current[Math.round(frameIndexRef.current)];
      if (canvas && img?.complete && img.naturalWidth > 0) {
        drawFrame(canvas, img, fit);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      window.removeEventListener("resize", handleResize);
    };
  }, [fit, framePath, onRevealComplete, totalFrames]);

  useEffect(() => {
    const handleScroll = () => {
      if (!ready) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const progress = Math.min(Math.max((window.innerHeight - rect.top) / (window.innerHeight + rect.height), 0), 1);
      targetFrameRef.current = Math.round(progress * (totalFrames - 1));
      lastInteractionAtRef.current = Date.now();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [ready, totalFrames]);

  const handlePointerMove = (event) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const verticalProgress = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1);
    targetFrameRef.current = Math.round(verticalProgress * (totalFrames - 1));
    lastInteractionAtRef.current = Date.now();
  };

  const handlePointerLeave = () => {
    lastInteractionAtRef.current = 0;
  };

  const loadPercent = Math.min(Math.floor((loadedCount / totalFrames) * 100), 100);

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`relative flex h-[420px] w-full cursor-ns-resize items-center justify-center overflow-hidden bg-transparent sm:h-[520px] lg:h-[610px] ${className}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(99,102,241,0.12),transparent_40%),linear-gradient(180deg,transparent,rgba(5,5,5,0.8))]" />
      <canvas
        ref={canvasRef}
        className={`relative z-10 h-full w-full object-contain transition duration-700 ${ready ? "opacity-100" : "opacity-35"}`}
      />

      {!ready && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#050505]/70 backdrop-blur-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-350">Preparing motion preview</div>
          <div className="h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-300"
              style={{ width: `${Math.max(loadPercent, 8)}%` }}
            />
          </div>
          <div className="text-xl font-black text-white">{loadPercent}%</div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-32 bg-gradient-to-t from-[#050505] to-transparent" />
    </div>
  );
}
