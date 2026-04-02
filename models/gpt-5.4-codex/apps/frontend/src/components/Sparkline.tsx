import { useEffect, useRef, useState } from "react";

interface SparklineProps {
  points: number[];
}

export const Sparkline = ({ points }: SparklineProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ height: 84, width: 280 });

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setSize({
        height: entry.contentRect.height,
        width: entry.contentRect.width
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(size.width, 32);
      const height = Math.max(size.height, 32);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      if (points.length < 2) {
        return;
      }

      const padding = 8;
      const min = Math.min(...points);
      const max = Math.max(...points);
      const range = max - min || 1;
      const trendUp = points.at(-1)! >= points[0]!;
      const lineColor = trendUp ? "#4ade80" : "#fb7185";
      const fillColor = trendUp ? "rgba(74, 222, 128, 0.16)" : "rgba(251, 113, 133, 0.14)";

      const normalized = points.map((value, index) => {
        const x =
          padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
        const y =
          height -
          padding -
          ((value - min) / range) * (height - padding * 2);

        return { x, y };
      });

      context.beginPath();
      context.moveTo(normalized[0]!.x, normalized[0]!.y);

      for (let index = 1; index < normalized.length - 1; index += 1) {
        const current = normalized[index]!;
        const next = normalized[index + 1]!;
        const controlX = (current.x + next.x) / 2;
        const controlY = (current.y + next.y) / 2;
        context.quadraticCurveTo(current.x, current.y, controlX, controlY);
      }

      const last = normalized.at(-1)!;
      context.lineTo(last.x, last.y);

      const fillGradient = context.createLinearGradient(0, 0, 0, height);
      fillGradient.addColorStop(0, fillColor);
      fillGradient.addColorStop(1, "rgba(3, 7, 18, 0)");

      context.save();
      context.lineTo(last.x, height - padding);
      context.lineTo(normalized[0]!.x, height - padding);
      context.closePath();
      context.fillStyle = fillGradient;
      context.fill();
      context.restore();

      context.beginPath();
      context.moveTo(normalized[0]!.x, normalized[0]!.y);

      for (let index = 1; index < normalized.length - 1; index += 1) {
        const current = normalized[index]!;
        const next = normalized[index + 1]!;
        const controlX = (current.x + next.x) / 2;
        const controlY = (current.y + next.y) / 2;
        context.quadraticCurveTo(current.x, current.y, controlX, controlY);
      }

      context.lineTo(last.x, last.y);
      context.strokeStyle = lineColor;
      context.lineWidth = 2.5;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.shadowBlur = 18;
      context.shadowColor = lineColor;
      context.stroke();
      context.shadowBlur = 0;
    };

    frameRef.current = window.requestAnimationFrame(draw);
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [points, size]);

  return (
    <div className="h-24 w-full" ref={wrapperRef}>
      <canvas className="h-full w-full" ref={canvasRef} />
    </div>
  );
};

