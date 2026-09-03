import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import katex from "katex";
import { Maximize2, Minimize2, Download, Check } from "lucide-react";
import { downloadSvgAsPng } from "../utils/exportImage";
import { useTheme, ThemeColors } from "../context/ThemeContext";

/* ============================================================
   DESIGN TOKENS & UTILITIES (ADAPTIVE THEME)
   ============================================================ */
let fnThemeColors: ThemeColors | null = null;
export function setFnThemeColors(c: ThemeColors) {
  fnThemeColors = c;
}

const COLORS = {
  get bg() { return fnThemeColors ? fnThemeColors.bg : "#020617"; },
  get panel() { return fnThemeColors ? fnThemeColors.panel : "rgba(15, 23, 42, 0.65)"; },
  get panelSolid() { return fnThemeColors ? fnThemeColors.panelSolid : "#0f172a"; },
  get border() { return fnThemeColors ? fnThemeColors.border : "#1e293b"; },
  get borderLight() { return fnThemeColors ? fnThemeColors.borderLight : "#334155"; },
  get text() { return fnThemeColors ? fnThemeColors.text : "#f8fafc"; },
  get textSecondary() { return fnThemeColors ? fnThemeColors.textSecondary : "#cbd5e1"; },
  get textMuted() { return fnThemeColors ? fnThemeColors.textMuted : "#94a3b8"; },
  get textFaint() { return fnThemeColors ? fnThemeColors.textFaint : "#64748b"; },
  get emerald() { return fnThemeColors ? fnThemeColors.emerald : "#10b981"; },
  get amber() { return fnThemeColors ? fnThemeColors.amber : "#f59e0b"; },
  get cyan() { return fnThemeColors ? fnThemeColors.cyan : "#06b6d4"; },
  get indigo() { return fnThemeColors ? fnThemeColors.indigo : "#6366f1"; },
  get rose() { return fnThemeColors ? fnThemeColors.rose : "#f43f5e"; },
  get purple() { return fnThemeColors ? fnThemeColors.purple : "#a855f7"; },
  get grid() { return fnThemeColors ? fnThemeColors.grid : "rgba(51, 65, 85, 0.35)"; },
  get gridStrong() { return fnThemeColors ? fnThemeColors.gridStrong : "rgba(71, 85, 105, 0.65)"; },
};

const MONO_STACK = `'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace`;

function fmt(n: number, d = 2): string {
  if (!Number.isFinite(n)) return "—";
  const rounded = Number(n.toFixed(d));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(d);
}

function fmtFrac(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Number.isInteger(n)) return String(n);
  // Simple fraction approximation for display
  for (let denom = 2; denom <= 12; denom++) {
    const num = Math.round(n * denom);
    if (Math.abs(n - num / denom) < 1e-4) {
      return `\\frac{${num}}{${denom}}`;
    }
  }
  return fmt(n, 2);
}

function MathDisplay({
  tex,
  inline = false,
  className = "",
}: {
  tex: string;
  inline?: boolean;
  className?: string;
}) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, {
        displayMode: !inline,
        throwOnError: false,
      });
    } catch {
      return tex;
    }
  }, [tex, inline]);

  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/* ============================================================
   PAN & ZOOM 2D COORDINATE ENGINE
   ============================================================ */
const VB_W = 640;
const VB_H = 430;

interface PanZoomConfig {
  defaultOriginX?: number;
  defaultOriginY?: number;
  defaultScale?: number;
  minScale?: number;
  maxScale?: number;
  width?: number;
  height?: number;
}

function useCanvas2DPanZoom({
  defaultOriginX = 320,
  defaultOriginY = 215,
  defaultScale = 32,
  minScale = 8,
  maxScale = 250,
  width = 640,
  height = 430,
}: PanZoomConfig = {}) {
  const [origin, setOrigin] = useState({ x: defaultOriginX, y: defaultOriginY });
  const [scale, setScale] = useState(defaultScale);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ clientX: number; clientY: number; origX: number; origY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const cursorSvgX = ((e.clientX - rect.left) / rect.width) * width;
      const cursorSvgY = ((e.clientY - rect.top) / rect.height) * height;

      setOrigin((currOrigin) => {
        let currScale = scale;
        setScale((prev) => {
          currScale = prev;
          return prev;
        });

        const mathX = (cursorSvgX - currOrigin.x) / currScale;
        const mathY = (currOrigin.y - cursorSvgY) / currScale;

        const zoomFactor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const nextScale = Math.max(minScale, Math.min(maxScale, +(currScale * zoomFactor).toFixed(3)));

        const nextOriginX = cursorSvgX - mathX * nextScale;
        const nextOriginY = cursorSvgY + mathY * nextScale;

        setScale(nextScale);
        return { x: nextOriginX, y: nextOriginY };
      });
    };

    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      svg.removeEventListener("wheel", onWheel);
    };
  }, [width, height, minScale, maxScale, scale]);

  const resetView = useCallback(() => {
    setOrigin({ x: defaultOriginX, y: defaultOriginY });
    setScale(defaultScale);
  }, [defaultOriginX, defaultOriginY, defaultScale]);

  const zoomIn = useCallback(() => {
    setScale((prevScale) => {
      const nextScale = Math.min(maxScale, +(prevScale * 1.25).toFixed(2));
      const cx = width / 2;
      const cy = height / 2;
      setOrigin((currOrigin) => {
        const mathX = (cx - currOrigin.x) / prevScale;
        const mathY = (currOrigin.y - cy) / prevScale;
        return {
          x: cx - mathX * nextScale,
          y: cy + mathY * nextScale,
        };
      });
      return nextScale;
    });
  }, [width, height, maxScale]);

  const zoomOut = useCallback(() => {
    setScale((prevScale) => {
      const nextScale = Math.max(minScale, +(prevScale / 1.25).toFixed(2));
      const cx = width / 2;
      const cy = height / 2;
      setOrigin((currOrigin) => {
        const mathX = (cx - currOrigin.x) / prevScale;
        const mathY = (currOrigin.y - cy) / prevScale;
        return {
          x: cx - mathX * nextScale,
          y: cy + mathY * nextScale,
        };
      });
      return nextScale;
    });
  }, [width, height, minScale]);

  const toPxX = useCallback((x: number) => origin.x + x * scale, [origin.x, scale]);
  const toPxY = useCallback((y: number) => origin.y - y * scale, [origin.y, scale]);
  const toMathX = useCallback((px: number) => (px - origin.x) / scale, [origin.x, scale]);
  const toMathY = useCallback((py: number) => (origin.y - py) / scale, [origin.y, scale]);

  const xMin = (0 - origin.x) / scale - 1;
  const xMax = (width - origin.x) / scale + 1;
  const yMin = (origin.y - height) / scale - 1;
  const yMax = origin.y / scale + 1;

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      panStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        origX: origin.x,
        origY: origin.y,
      };
      setIsPanning(true);
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    },
    [origin.x, origin.y]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!panStartRef.current) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = width / rect.width;
      const scaleY = height / rect.height;

      const dx = (e.clientX - panStartRef.current.clientX) * scaleX;
      const dy = (e.clientY - panStartRef.current.clientY) * scaleY;

      setOrigin({
        x: panStartRef.current.origX + dx,
        y: panStartRef.current.origY + dy,
      });
    },
    [width, height]
  );

  const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    panStartRef.current = null;
    setIsPanning(false);
    try {
      (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
  }, []);

  return {
    origin,
    scale,
    isPanning,
    toPxX,
    toPxY,
    toMathX,
    toMathY,
    xMin,
    xMax,
    yMin,
    yMax,
    zoomIn,
    zoomOut,
    resetView,
    defaultScale,
    bind: {
      ref: svgRef,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}

function Canvas2DNavHUD({
  scale,
  defaultScale,
  onZoomIn,
  onZoomOut,
  onReset,
  origin,
}: {
  scale: number;
  defaultScale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  origin?: { x: number; y: number };
}) {
  const zoomPct = Math.round((scale / defaultScale) * 100);
  return (
    <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10 select-none pointer-events-auto">
      {origin && (
        <span className="hidden sm:inline-block bg-white/95 backdrop-blur-xs border border-slate-300 text-slate-800 font-mono text-[9px] px-1.5 py-0.5 rounded-2xs shadow-xs font-semibold">
          O:({Math.round(origin.x)},{Math.round(origin.y)})
        </span>
      )}
      <div className="flex items-center bg-white/95 backdrop-blur-xs border border-slate-300 rounded-2xs p-0.5 shadow-sm">
        <button
          type="button"
          onClick={onZoomOut}
          className="w-5 h-5 flex items-center justify-center text-slate-700 hover:text-black hover:bg-slate-100 rounded-3xs text-xs font-bold transition-colors cursor-pointer"
          title="Thu nhỏ (-)"
        >
          −
        </button>
        <button
          type="button"
          onClick={onReset}
          className="px-1.5 h-5 flex items-center justify-center text-[9px] font-mono text-slate-900 font-bold hover:bg-slate-100 rounded-3xs transition-colors cursor-pointer"
          title="Đặt lại gốc O và Zoom 100%"
        >
          {zoomPct}%
        </button>
        <button
          type="button"
          onClick={onZoomIn}
          className="w-5 h-5 flex items-center justify-center text-slate-700 hover:text-black hover:bg-slate-100 rounded-3xs text-xs font-bold transition-colors cursor-pointer"
          title="Phóng to (+)"
        >
          +
        </button>
        <button
          type="button"
          onClick={onReset}
          className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-black hover:bg-slate-100 rounded-3xs text-[10px] ml-0.5 border-l border-slate-200 transition-colors cursor-pointer"
          title="Đặt lại tâm toạ độ và tỷ lệ ban đầu"
        >
          ↺
        </button>
      </div>
    </div>
  );
}

function GraphGrid({
  originX = 320,
  originY = 215,
  scale = 32,
  width = VB_W,
  height = VB_H,
}: {
  originX?: number;
  originY?: number;
  scale?: number;
  width?: number;
  height?: number;
}) {
  let gridStep = 1;
  let labelStep = 2;

  if (scale < 14) {
    gridStep = 5;
    labelStep = 5;
  } else if (scale < 24) {
    gridStep = 2;
    labelStep = 2;
  } else if (scale < 45) {
    gridStep = 1;
    labelStep = 2;
  } else if (scale < 90) {
    gridStep = 1;
    labelStep = 1;
  } else {
    gridStep = 0.5;
    labelStep = 0.5;
  }

  const toPxX = (x: number) => originX + x * scale;
  const toPxY = (y: number) => originY - y * scale;

  const xMin = Math.floor((0 - originX) / (scale * gridStep)) * gridStep - gridStep;
  const xMax = Math.ceil((width - originX) / (scale * gridStep)) * gridStep + gridStep;
  const yMin = Math.floor((originY - height) / (scale * gridStep)) * gridStep - gridStep;
  const yMax = Math.ceil(originY / (scale * gridStep)) * gridStep + gridStep;

  const ticks: React.ReactNode[] = [];
  const labels: React.ReactNode[] = [];

  const hasOx = originY >= -20 && originY <= height + 20;
  const hasOy = originX >= -20 && originX <= width + 20;

  // Tick marks & numbers on Ox
  for (let x = xMin; x <= xMax; x += labelStep) {
    if (Math.abs(x) < 0.0001) continue;
    const px = toPxX(x);
    if (px < 15 || px > width - 15) continue;
    if (hasOx) {
      ticks.push(
        <line
          key={"tx" + x.toFixed(2)}
          x1={px}
          y1={originY - 3.5}
          x2={px}
          y2={originY + 3.5}
          stroke="#000000"
          strokeWidth="1.2"
        />
      );
    }
    const labelY = Math.max(14, Math.min(height - 6, originY + 14));
    labels.push(
      <text
        key={"lx" + x.toFixed(2)}
        x={px}
        y={labelY}
        fontSize="9.5"
        fill="#000000"
        fontWeight="bold"
        textAnchor="middle"
        fontFamily={MONO_STACK}
      >
        {Number.isInteger(x) ? x : x.toFixed(1)}
      </text>
    );
  }

  // Tick marks & numbers on Oy
  for (let y = yMin; y <= yMax; y += labelStep) {
    if (Math.abs(y) < 0.0001) continue;
    const py = toPxY(y);
    if (py < 15 || py > height - 15) continue;
    if (hasOy) {
      ticks.push(
        <line
          key={"ty" + y.toFixed(2)}
          x1={originX - 3.5}
          y1={py}
          x2={originX + 3.5}
          y2={py}
          stroke="#000000"
          strokeWidth="1.2"
        />
      );
    }
    const labelX = Math.max(18, Math.min(width - 6, originX - 6));
    labels.push(
      <text
        key={"ly" + y.toFixed(2)}
        x={labelX}
        y={py + 3.5}
        fontSize="9.5"
        fill="#000000"
        fontWeight="bold"
        textAnchor="end"
        fontFamily={MONO_STACK}
      >
        {Number.isInteger(y) ? y : y.toFixed(1)}
      </text>
    );
  }

  return (
    <g>
      {/* Vạch chia toạ độ trên trục */}
      {ticks}

      {/* Trục hoành Ox: màu đen, độ dày 2 */}
      {hasOx && (
        <>
          <line x1={0} y1={originY} x2={width} y2={originY} stroke="#000000" strokeWidth="2" />
          <polygon
            points={`${width - 1},${originY} ${width - 8},${originY - 3.5} ${width - 8},${originY + 3.5}`}
            fill="#000000"
          />
          <text
            x={width - 12}
            y={originY - 7}
            fontSize="11.5"
            fill="#000000"
            fontFamily={MONO_STACK}
            fontWeight="bold"
          >
            x
          </text>
        </>
      )}

      {/* Trục tung Oy: màu đen, độ dày 2 */}
      {hasOy && (
        <>
          <line x1={originX} y1={0} x2={originX} y2={height} stroke="#000000" strokeWidth="2" />
          <polygon
            points={`${originX},1 ${originX - 3.5},8 ${originX + 3.5},8`}
            fill="#000000"
          />
          <text
            x={originX + 8}
            y={12}
            fontSize="11.5"
            fill="#000000"
            fontFamily={MONO_STACK}
            fontWeight="bold"
          >
            y
          </text>
        </>
      )}

      {/* Các số trên trục */}
      {labels}

      {/* Gốc toạ độ O */}
      {hasOx && hasOy && (
        <text
          x={originX - 8}
          y={originY + 13}
          fontSize="10"
          fill="#000000"
          fontFamily={MONO_STACK}
          fontWeight="bold"
        >
          O
        </text>
      )}
    </g>
  );
}

function buildDiscontinuousFnPath(
  fn: (x: number) => number,
  xMin: number,
  xMax: number,
  toPxX: (x: number) => number,
  toPxY: (y: number) => number,
  discontinuities: number[] = [],
  step = 0.03
): string {
  let d = "";
  let started = false;
  const clampedMin = Math.max(-100, xMin);
  const clampedMax = Math.min(100, xMax);

  let lastY = 0;

  for (let x = clampedMin; x <= clampedMax; x += step) {
    // Check if near discontinuity
    const nearDisc = discontinuities.some((disc) => Math.abs(x - disc) < step * 1.5);
    if (nearDisc) {
      started = false;
      continue;
    }

    const y = fn(x);
    if (!Number.isFinite(y) || Math.abs(y) > 300) {
      started = false;
      continue;
    }

    // Check jump
    if (started && Math.abs(y - lastY) > 80) {
      started = false;
    }

    const px = toPxX(x).toFixed(2);
    const py = toPxY(y).toFixed(2);
    d += (started ? "L" : "M") + px + "," + py + " ";
    started = true;
    lastY = y;
  }
  return d;
}

/* ============================================================
   UI HELPERS & CONTROLS
   ============================================================ */
function NumberInput({
  label,
  value,
  min,
  max,
  step = 0.1,
  onChange,
  color = "amber",
  precision = 2,
  quickOptions,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
  color?: "emerald" | "amber" | "cyan" | "rose" | "indigo";
  precision?: number;
  quickOptions?: number[];
}) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    const num = parseFloat(text);
    if (isNaN(num) || Math.abs(num - value) > 1e-5) {
      setText(String(Number(value.toFixed(precision))));
    }
  }, [value, precision]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      let clamped = parsed;
      if (min !== undefined && clamped < min) clamped = min;
      if (max !== undefined && clamped > max) clamped = max;
      onChange(clamped);
    }
  };

  const handleBlur = () => {
    const parsed = parseFloat(text);
    if (isNaN(parsed)) {
      setText(String(value));
    } else {
      let clamped = parsed;
      if (min !== undefined && clamped < min) clamped = min;
      if (max !== undefined && clamped > max) clamped = max;
      const formatted = Number(clamped.toFixed(precision));
      setText(String(formatted));
      onChange(formatted);
    }
  };

  const stepChange = (delta: number) => {
    let next = Math.round((value + delta) * 1000) / 1000;
    if (min !== undefined && next < min) next = min;
    if (max !== undefined && next > max) next = max;
    next = Number(next.toFixed(precision));
    setText(String(next));
    onChange(next);
  };

  const colorAccent =
    color === "emerald"
      ? "text-emerald-300 border-emerald-500/40 focus:border-emerald-400"
      : color === "cyan"
      ? "text-cyan-300 border-cyan-500/40 focus:border-cyan-400"
      : color === "rose"
      ? "text-rose-300 border-rose-500/40 focus:border-rose-400"
      : color === "indigo"
      ? "text-indigo-300 border-indigo-500/40 focus:border-indigo-400"
      : "text-amber-300 border-amber-500/40 focus:border-amber-400";

  return (
    <div className="mb-2 bg-slate-950/60 border border-slate-800/80 p-2 rounded-xs">
      <div className="flex justify-between items-center mb-1 gap-2 font-mono">
        <span className="text-[11px] text-slate-300 font-medium truncate">{label}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => stepChange(-step)}
          className="w-7 h-7 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 rounded-2xs font-mono text-sm flex items-center justify-center transition-colors active:scale-95 shrink-0 cursor-pointer"
        >
          −
        </button>
        <input
          type="number"
          step={step}
          min={min}
          max={max}
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
          className={`flex-1 h-7 bg-slate-900 border rounded-2xs px-2 text-center text-xs font-mono font-bold outline-none transition-colors ${colorAccent}`}
        />
        <button
          type="button"
          onClick={() => stepChange(step)}
          className="w-7 h-7 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 rounded-2xs font-mono text-sm flex items-center justify-center transition-colors active:scale-95 shrink-0 cursor-pointer"
        >
          +
        </button>
      </div>
      {quickOptions && quickOptions.length > 0 && (
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {quickOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                setText(String(opt));
                onChange(opt);
              }}
              className={`px-1.5 py-0.2 rounded-2xs text-[9px] font-mono border transition-colors cursor-pointer ${
                Math.abs(value - opt) < 1e-4
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   BẢNG BIẾN THIÊN (VARIATION TABLE) COMPONENT - CHUẨN GDPT 2018
   - Dòng x: Hoành độ, nghiệm y'=0, tiệm cận đứng
   - Dòng y': Dấu +, - ở chính giữa khoảng; số 0 hoặc || thẳng hàng
   - Dòng y: Mũi tên tăng (↗), giảm (↘) sắc nét; CĐ/CT, ±∞ đặt đúng cao độ
   ============================================================ */
export interface BBTPoint {
  xTex: string;
  yPrime?: "0" | "||" | "";
  isDiscontinuity?: boolean;
  yTex?: string;
  yLevel?: "top" | "mid" | "bottom";
  yLabel?: "CĐ" | "CT" | "Đỉnh" | "";
  leftLimit?: { tex: string; level: "top" | "mid" | "bottom" };
  rightLimit?: { tex: string; level: "top" | "mid" | "bottom" };
}

export interface BBTSegment {
  sign: "+" | "-";
  trend: "up" | "down";
  startLevel: "top" | "mid" | "bottom";
  endLevel: "top" | "mid" | "bottom";
}

export interface BBTData {
  points: BBTPoint[];
  segments: BBTSegment[];
}

export interface BBTColumn {
  x: string;
  yPrime: string; // "+", "-", "0", "||", ""
  y: string;
  yType?: "peak" | "valley" | "mid" | "limit-plus" | "limit-minus" | "asymptote";
  yLeft?: string;
  yRight?: string;
}

export interface BBTProps {
  data?: BBTData;
  columns?: BBTColumn[];
  discontinuities?: number[];
  discontinuityIdx?: number[]; // indices of vertical asymptote
}

function convertColumnsToBBTData(columns: BBTColumn[]): BBTData {
  const points: BBTPoint[] = [];
  const segments: BBTSegment[] = [];

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const isDiscontinuity = col.yType === "asymptote" || col.yPrime === "||";
    let yLevel: "top" | "mid" | "bottom" = "mid";
    let yLabel: "CĐ" | "CT" | "" = "";

    if (col.yType === "peak") {
      yLevel = "top";
      yLabel = "CĐ";
    } else if (col.yType === "valley") {
      yLevel = "bottom";
      yLabel = "CT";
    } else if (col.yType === "limit-plus" || col.y === "+\\infty") {
      yLevel = "top";
    } else if (col.yType === "limit-minus" || col.y === "-\\infty") {
      yLevel = "bottom";
    }

    if (isDiscontinuity) {
      const leftLevel: "top" | "mid" | "bottom" = col.yLeft?.includes("+") ? "top" : col.yLeft?.includes("-") ? "bottom" : "mid";
      const rightLevel: "top" | "mid" | "bottom" = col.yRight?.includes("+") ? "top" : col.yRight?.includes("-") ? "bottom" : "mid";
      points.push({
        xTex: col.x,
        yPrime: "||",
        isDiscontinuity: true,
        leftLimit: { tex: col.yLeft || "-\\infty", level: leftLevel },
        rightLimit: { tex: col.yRight || "+\\infty", level: rightLevel },
      });
    } else {
      points.push({
        xTex: col.x,
        yPrime: col.yPrime === "0" ? "0" : "",
        isDiscontinuity: false,
        yTex: col.y,
        yLevel,
        yLabel,
      });
    }
  }

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const startLevel = p1.isDiscontinuity ? (p1.rightLimit?.level || "mid") : (p1.yLevel || "mid");
    const endLevel = p2.isDiscontinuity ? (p2.leftLimit?.level || "mid") : (p2.yLevel || "mid");

    const rawSign = (columns[i]?.yPrime === "+" || columns[i + 1]?.yPrime === "+" || (startLevel === "bottom" && endLevel === "top")) ? "+" : "-";
    const isUp = rawSign === "+" || (startLevel === "bottom" && endLevel === "top") || (startLevel === "mid" && endLevel === "top") || (startLevel === "bottom" && endLevel === "mid");
    segments.push({
      sign: rawSign as "+" | "-",
      trend: isUp ? "up" : "down",
      startLevel,
      endLevel,
    });
  }

  return { points, segments };
}

/* ============================================================
   VARIATION TABLE (BẢNG BIẾN THIÊN CHUẨN SGK GDPT)
   Area increased by 20% (640x168), white background, black frame & text,
   with direct high-resolution PNG export (.png)
   ============================================================ */

function parseTex(raw: string): {
  type: "plain" | "fraction";
  text: string;
  sign?: string;
  num: string;
  den: string;
} {
  if (!raw) return { type: "plain", text: "", num: "", den: "" };
  let str = raw.trim();
  str = str.replace(/-\\infty/g, "−∞").replace(/\+\\infty/g, "+∞").replace(/\\infty/g, "∞");
  str = str.replace(/\\sqrt\{([^}]+)\}/g, "√$1");
  str = str.replace(/\\text\{([^}]+)\}/g, "$1");
  str = str.replace(/\\pm/g, "±");
  str = str.replace(/\\left|\\right/g, "");

  const fracRegex = /^([+-]?)\s*\\frac\{([^}]+)\}\{([^}]+)\}$/;
  const m = str.match(fracRegex);
  if (m) {
    const rawSign = m[1];
    const sign = rawSign === "-" ? "−" : rawSign === "+" ? "+" : "";
    const num = m[2]
      .replace(/-\\infty/g, "−∞")
      .replace(/\+\\infty/g, "+∞")
      .replace(/\\sqrt\{([^}]+)\}/g, "√$1")
      .replace(/-/g, "−");
    const den = m[3]
      .replace(/\\sqrt\{([^}]+)\}/g, "√$1")
      .replace(/-/g, "−");
    return { type: "fraction", text: `${sign}${num}/${den}`, sign, num, den };
  }

  const clean = str.replace(/-/g, "−");
  return { type: "plain", text: clean, num: "", den: "" };
}

function SvgMathValue({
  tex,
  x,
  y,
  align = "middle",
  fontSize = 13,
}: {
  tex: string;
  x: number;
  y: number;
  align?: "middle" | "start" | "end";
  fontSize?: number;
  key?: React.Key;
}) {
  const parsed = useMemo(() => parseTex(tex), [tex]);

  if (parsed.type === "fraction") {
    const sign = parsed.sign;
    const textX = align === "middle" ? x : align === "start" ? x + 10 : x - 10;
    const fracX = textX + (sign ? 7 : 0);
    const maxLen = Math.max(parsed.num.length, parsed.den.length);
    const barW = Math.max(14, maxLen * 7.5 + 4);

    return (
      <g>
        {sign && (
          <text
            x={fracX - barW / 2 - 5}
            y={y + 1}
            fill="#000000"
            fontSize={fontSize}
            fontWeight="bold"
            textAnchor="middle"
            fontFamily="'IBM Plex Mono', 'Space Grotesk', system-ui, sans-serif"
          >
            {sign}
          </text>
        )}
        <text
          x={fracX}
          y={y - 5}
          fill="#000000"
          fontSize={Math.round(fontSize * 0.85)}
          fontWeight="bold"
          textAnchor="middle"
          fontFamily="'IBM Plex Mono', 'Space Grotesk', system-ui, sans-serif"
        >
          {parsed.num}
        </text>
        <line
          x1={fracX - barW / 2}
          y1={y - 1}
          x2={fracX + barW / 2}
          y2={y - 1}
          stroke="#000000"
          strokeWidth="1.2"
        />
        <text
          x={fracX}
          y={y + 8}
          fill="#000000"
          fontSize={Math.round(fontSize * 0.85)}
          fontWeight="bold"
          textAnchor="middle"
          fontFamily="'IBM Plex Mono', 'Space Grotesk', system-ui, sans-serif"
        >
          {parsed.den}
        </text>
      </g>
    );
  }

  return (
    <text
      x={x}
      y={y + 4.5}
      fill="#000000"
      fontSize={fontSize}
      fontWeight="bold"
      textAnchor={align}
      fontFamily="'IBM Plex Mono', 'Space Grotesk', system-ui, sans-serif"
    >
      {parsed.text}
    </text>
  );
}

function exportBBTToPng(bbt: BBTData, fileName: string = "bang-bien-thien") {
  const { points, segments } = bbt;
  const numPoints = points.length;
  if (numPoints < 2) return;

  const SCALE = 3; // 3x high-resolution crisp print output (1920x504)
  const SVG_W = 640;
  const SVG_H = 168;
  const HDR_W = 52;
  const ROW1_H = 30;
  const ROW2_H = 30;
  const Y_LINE_1 = ROW1_H;
  const Y_LINE_2 = ROW1_H + ROW2_H;
  const Y_PRIME_CENTER = (Y_LINE_1 + Y_LINE_2) / 2;

  const Y_TOP = 84;
  const Y_MID = 114;
  const Y_BOT = 144;

  const getYLevel = (lvl?: "top" | "mid" | "bottom") => {
    if (lvl === "top") return Y_TOP;
    if (lvl === "bottom") return Y_BOT;
    return Y_MID;
  };

  const X_PAD_LEFT = 32;
  const X_PAD_RIGHT = 32;
  const X_START = HDR_W + X_PAD_LEFT;
  const X_END = SVG_W - X_PAD_RIGHT;
  const AVAILABLE_W = X_END - X_START;

  const getPointX = (idx: number) => {
    return X_START + (AVAILABLE_W / (numPoints - 1)) * idx;
  };

  const canvas = document.createElement("canvas");
  canvas.width = SVG_W * SCALE;
  canvas.height = SVG_H * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 1. Fill background with pure WHITE (#ffffff)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Black Frame & Divider Lines (#000000)
  ctx.strokeStyle = "#000000";
  ctx.fillStyle = "#000000";

  // Outer frame
  ctx.lineWidth = 1.8 * SCALE;
  ctx.strokeRect(SCALE, SCALE, (SVG_W - 2) * SCALE, (SVG_H - 2) * SCALE);

  // Horizontal divider 1
  ctx.lineWidth = 1.4 * SCALE;
  ctx.beginPath();
  ctx.moveTo(0, Y_LINE_1 * SCALE);
  ctx.lineTo(SVG_W * SCALE, Y_LINE_1 * SCALE);
  ctx.stroke();

  // Horizontal divider 2
  ctx.beginPath();
  ctx.moveTo(0, Y_LINE_2 * SCALE);
  ctx.lineTo(SVG_W * SCALE, Y_LINE_2 * SCALE);
  ctx.stroke();

  // Vertical column divider
  ctx.lineWidth = 1.6 * SCALE;
  ctx.beginPath();
  ctx.moveTo(HDR_W * SCALE, 0);
  ctx.lineTo(HDR_W * SCALE, SVG_H * SCALE);
  ctx.stroke();

  // Helper to draw text or stacked fractions on canvas
  const drawMathOnCanvas = (
    tex: string,
    cx: number,
    cy: number,
    align: CanvasTextAlign = "center",
    baseFontSize = 13
  ) => {
    const parsed = parseTex(tex);
    const scaledFont = baseFontSize * SCALE;

    if (parsed.type === "fraction") {
      const fracFont = Math.round(scaledFont * 0.85);
      ctx.font = `bold ${fracFont}px 'IBM Plex Mono', 'Space Grotesk', system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const sign = parsed.sign;
      const fracX = align === "center" ? cx : align === "left" ? cx + 18 * SCALE : cx - 18 * SCALE;
      const numW = ctx.measureText(parsed.num).width;
      const denW = ctx.measureText(parsed.den).width;
      const barW = Math.max(14 * SCALE, Math.max(numW, denW) + 6 * SCALE);

      if (sign) {
        ctx.font = `bold ${scaledFont}px 'IBM Plex Mono', 'Space Grotesk', system-ui, sans-serif`;
        ctx.fillText(sign, fracX - barW / 2 - 6 * SCALE, cy);
      }

      ctx.font = `bold ${fracFont}px 'IBM Plex Mono', 'Space Grotesk', system-ui, sans-serif`;
      ctx.fillText(parsed.num, fracX, cy - 6 * SCALE);
      ctx.lineWidth = 1.2 * SCALE;
      ctx.beginPath();
      ctx.moveTo(fracX - barW / 2, cy);
      ctx.lineTo(fracX + barW / 2, cy);
      ctx.stroke();
      ctx.fillText(parsed.den, fracX, cy + 7 * SCALE);
    } else {
      ctx.font = `bold ${scaledFont}px 'IBM Plex Mono', 'Space Grotesk', system-ui, sans-serif`;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.fillText(parsed.text, cx, cy);
    }
  };

  // Header Labels: x, y', y in Black
  ctx.font = `italic bold ${14 * SCALE}px 'IBM Plex Mono', 'Space Grotesk', serif, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("x", (HDR_W / 2) * SCALE, (Y_LINE_1 / 2) * SCALE);
  ctx.fillText("y'", (HDR_W / 2) * SCALE, Y_PRIME_CENTER * SCALE);
  ctx.fillText("y", (HDR_W / 2) * SCALE, Y_MID * SCALE);

  // Row 1: x values
  points.forEach((pt, i) => {
    const x = getPointX(i) * SCALE;
    const y = (Y_LINE_1 / 2) * SCALE;
    drawMathOnCanvas(pt.xTex, x, y, "center", 13);
  });

  // Row 2: y' values
  points.forEach((pt, i) => {
    const x = getPointX(i) * SCALE;
    if (pt.isDiscontinuity) {
      ctx.lineWidth = 1.4 * SCALE;
      ctx.beginPath();
      ctx.moveTo(x - 2.5 * SCALE, Y_LINE_1 * SCALE);
      ctx.lineTo(x - 2.5 * SCALE, SVG_H * SCALE);
      ctx.moveTo(x + 2.5 * SCALE, Y_LINE_1 * SCALE);
      ctx.lineTo(x + 2.5 * SCALE, SVG_H * SCALE);
      ctx.stroke();
    } else if (pt.yPrime === "0") {
      ctx.font = `bold ${14 * SCALE}px 'IBM Plex Mono', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("0", x, Y_PRIME_CENTER * SCALE);
    }
  });

  // Row 2: Signs (+, −) in intervals
  segments.forEach((seg, i) => {
    const x1 = getPointX(i);
    const x2 = getPointX(i + 1);
    const xMid = ((x1 + x2) / 2) * SCALE;
    ctx.font = `bold ${16 * SCALE}px 'IBM Plex Mono', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(seg.sign === "+" ? "+" : "−", xMid, Y_PRIME_CENTER * SCALE);
  });

  // Row 3: Arrows in Black
  segments.forEach((seg, i) => {
    const p1 = points[i];
    const p2 = points[i + 1];
    const x1 = getPointX(i);
    const x2 = getPointX(i + 1);
    const y1 = getYLevel(seg.startLevel);
    const y2 = getYLevel(seg.endLevel);

    const xOffsetStart = p1.isDiscontinuity ? 26 : 22;
    const xOffsetEnd = p2.isDiscontinuity ? 26 : 22;

    const startX = (x1 + xOffsetStart) * SCALE;
    const endX = (x2 - xOffsetEnd) * SCALE;

    const isUp = seg.trend === "up";
    const startY = (isUp ? y1 - 3 : y1 + 3) * SCALE;
    const endY = (isUp ? y2 + 3 : y2 - 3) * SCALE;

    // Line
    ctx.lineWidth = 1.8 * SCALE;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Sharp vector arrowhead
    const angle = Math.atan2(endY - startY, endX - startX);
    const headLen = 9 * SCALE;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - headLen * Math.cos(angle - Math.PI / 7),
      endY - headLen * Math.sin(angle - Math.PI / 7)
    );
    ctx.lineTo(
      endX - headLen * Math.cos(angle + Math.PI / 7),
      endY - headLen * Math.sin(angle + Math.PI / 7)
    );
    ctx.closePath();
    ctx.fill();
  });

  // Row 3: Values
  points.forEach((pt, i) => {
    const x = getPointX(i) * SCALE;
    if (pt.isDiscontinuity) {
      const yLeft = getYLevel(pt.leftLimit?.level) * SCALE;
      const yRight = getYLevel(pt.rightLimit?.level) * SCALE;
      drawMathOnCanvas(pt.leftLimit?.tex || "", x - 6 * SCALE, yLeft, "right", 11.5);
      drawMathOnCanvas(pt.rightLimit?.tex || "", x + 6 * SCALE, yRight, "left", 11.5);
    } else {
      const yPos = getYLevel(pt.yLevel) * SCALE;
      drawMathOnCanvas(pt.yTex || "", x, yPos, "center", 12.5);
    }
  });

  // Direct PNG download with .png extension
  canvas.toBlob((blob) => {
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  }, "image/png");
}

export function getBBTData(data?: BBTData, columns?: BBTColumn[]): BBTData {
  if (data && data.points.length > 0) return data;
  if (columns && columns.length > 0) return convertColumnsToBBTData(columns);
  return { points: [], segments: [] };
}

export function VariationTable({ data, columns }: BBTProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const bbt = useMemo(() => {
    return getBBTData(data, columns);
  }, [data, columns]);

  const { points, segments } = bbt;
  const numPoints = points.length;

  if (numPoints < 2) {
    return (
      <div className="p-4 text-center text-slate-500 font-mono text-xs bg-white rounded-xs border border-black">
        Đang tạo bảng biến thiên...
      </div>
    );
  }

  // Geometry specs (Area increased by 20%: 640x168 = 107,520 vs 560x160 = 89,600)
  const SVG_W = 640;
  const SVG_H = 168;
  const HDR_W = 52;
  const ROW1_H = 30; // Row x: 0 -> 30
  const ROW2_H = 30; // Row y': 30 -> 60
  const Y_LINE_1 = ROW1_H; // 30
  const Y_LINE_2 = ROW1_H + ROW2_H; // 60
  const Y_PRIME_CENTER = (Y_LINE_1 + Y_LINE_2) / 2; // 45

  // 3 distinct elevation levels in row y (Height 108px: 60 -> 168)
  const Y_TOP = 84; // For +\infty, CĐ (Local Maximum)
  const Y_MID = 114; // For Asymptote y0, Inflection point
  const Y_BOT = 144; // For -\infty, CT (Local Minimum)

  const getYLevel = (lvl?: "top" | "mid" | "bottom") => {
    if (lvl === "top") return Y_TOP;
    if (lvl === "bottom") return Y_BOT;
    return Y_MID;
  };

  const X_PAD_LEFT = 32;
  const X_PAD_RIGHT = 32;
  const X_START = HDR_W + X_PAD_LEFT;
  const X_END = SVG_W - X_PAD_RIGHT;
  const AVAILABLE_W = X_END - X_START;

  const getPointX = (idx: number) => {
    return X_START + (AVAILABLE_W / (numPoints - 1)) * idx;
  };

  return (
    <div className="w-full my-2 border-2 border-black bg-white rounded-xs shadow-md font-mono text-xs select-none overflow-hidden bbt-table-wrapper">
      {/* SVG Canvas (White Background, Black Elements) */}
      <div className="p-3.5 bg-white flex items-center justify-center overflow-x-auto">
        <svg
          ref={svgRef}
          id="bbt-svg-element"
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full h-auto max-w-[760px] min-w-[520px] block bg-white"
        >
          <defs>
            {/* Sleek Black Vector Arrowhead */}
            <marker
              id="bbt-arr-black"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#000000" />
            </marker>
          </defs>

          {/* 1. White Backgrounds */}
          <rect x="0" y="0" width={SVG_W} height={SVG_H} fill="#ffffff" />
          <rect x="0" y="0" width={HDR_W} height={SVG_H} fill="#ffffff" />

          {/* 2. Black Grid Dividers */}
          <line x1="0" y1={Y_LINE_1} x2={SVG_W} y2={Y_LINE_1} stroke="#000000" strokeWidth="1.4" />
          <line x1="0" y1={Y_LINE_2} x2={SVG_W} y2={Y_LINE_2} stroke="#000000" strokeWidth="1.4" />
          <line x1={HDR_W} y1="0" x2={HDR_W} y2={SVG_H} stroke="#000000" strokeWidth="1.6" />
          <rect x="1" y="1" width={SVG_W - 2} height={SVG_H - 2} fill="none" stroke="#000000" strokeWidth="1.8" />

          {/* 3. Header Row Labels: x, y', y in Black */}
          <text
            x={HDR_W / 2}
            y={Y_LINE_1 / 2 + 4.5}
            textAnchor="middle"
            fill="#000000"
            fontStyle="italic"
            fontWeight="bold"
            fontSize="14"
            fontFamily="'IBM Plex Mono', 'Space Grotesk', serif, sans-serif"
          >
            x
          </text>
          <text
            x={HDR_W / 2}
            y={Y_PRIME_CENTER + 4.5}
            textAnchor="middle"
            fill="#000000"
            fontStyle="italic"
            fontWeight="bold"
            fontSize="14"
            fontFamily="'IBM Plex Mono', 'Space Grotesk', serif, sans-serif"
          >
            y'
          </text>
          <text
            x={HDR_W / 2}
            y={Y_MID + 4.5}
            textAnchor="middle"
            fill="#000000"
            fontStyle="italic"
            fontWeight="bold"
            fontSize="14"
            fontFamily="'IBM Plex Mono', 'Space Grotesk', serif, sans-serif"
          >
            y
          </text>

          {/* 4. ROW 1 (x values in Black) */}
          {points.map((pt, i) => {
            const x = getPointX(i);
            return (
              <SvgMathValue
                key={`x-${i}`}
                tex={pt.xTex}
                x={x}
                y={Y_LINE_1 / 2}
                align="middle"
                fontSize={13}
              />
            );
          })}

          {/* 5. ROW 2 (y' values: 0, || in Black) */}
          {points.map((pt, i) => {
            const x = getPointX(i);
            if (pt.isDiscontinuity) {
              return (
                <g key={`disc-${i}`}>
                  <line x1={x - 2.5} y1={Y_LINE_1} x2={x - 2.5} y2={SVG_H} stroke="#000000" strokeWidth="1.4" />
                  <line x1={x + 2.5} y1={Y_LINE_1} x2={x + 2.5} y2={SVG_H} stroke="#000000" strokeWidth="1.4" />
                </g>
              );
            }
            if (pt.yPrime === "0") {
              return (
                <text
                  key={`yprime-0-${i}`}
                  x={x}
                  y={Y_PRIME_CENTER + 4.5}
                  textAnchor="middle"
                  fill="#000000"
                  fontWeight="bold"
                  fontSize="14"
                  fontFamily="'IBM Plex Mono', 'Space Grotesk', system-ui, sans-serif"
                >
                  0
                </text>
              );
            }
            return null;
          })}

          {/* Signs (+ / −) in Black in exact center of intervals */}
          {segments.map((seg, i) => {
            const x1 = getPointX(i);
            const x2 = getPointX(i + 1);
            const xMid = (x1 + x2) / 2;
            return (
              <text
                key={`sign-${i}`}
                x={xMid}
                y={Y_PRIME_CENTER + 4.5}
                textAnchor="middle"
                fill="#000000"
                fontWeight="bold"
                fontSize="16"
                fontFamily="'IBM Plex Mono', 'Space Grotesk', system-ui, sans-serif"
              >
                {seg.sign === "+" ? "+" : "−"}
              </text>
            );
          })}

          {/* 6. ROW 3 (y variation arrows and values in Black) */}
          {/* Slanted Vector Arrows in Black */}
          {segments.map((seg, i) => {
            const p1 = points[i];
            const p2 = points[i + 1];
            const x1 = getPointX(i);
            const x2 = getPointX(i + 1);
            const y1 = getYLevel(seg.startLevel);
            const y2 = getYLevel(seg.endLevel);

            const xOffsetStart = p1.isDiscontinuity ? 26 : 22;
            const xOffsetEnd = p2.isDiscontinuity ? 26 : 22;

            const startX = x1 + xOffsetStart;
            const endX = x2 - xOffsetEnd;

            const isUp = seg.trend === "up";
            const startY = isUp ? y1 - 3 : y1 + 3;
            const endY = isUp ? y2 + 3 : y2 - 3;

            return (
              <line
                key={`arrow-${i}`}
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke="#000000"
                strokeWidth="1.8"
                markerEnd="url(#bbt-arr-black)"
                strokeLinecap="round"
              />
            );
          })}

          {/* Values at Nodes in Row y in Black */}
          {points.map((pt, i) => {
            const x = getPointX(i);

            if (pt.isDiscontinuity) {
              const yLeft = getYLevel(pt.leftLimit?.level);
              const yRight = getYLevel(pt.rightLimit?.level);

              return (
                <g key={`disc-val-${i}`}>
                  <SvgMathValue
                    tex={pt.leftLimit?.tex || ""}
                    x={x - 6}
                    y={yLeft}
                    align="end"
                    fontSize={11.5}
                  />
                  <SvgMathValue
                    tex={pt.rightLimit?.tex || ""}
                    x={x + 6}
                    y={yRight}
                    align="start"
                    fontSize={11.5}
                  />
                </g>
              );
            }

            const yPos = getYLevel(pt.yLevel);

            return (
              <SvgMathValue
                key={`val-${i}`}
                tex={pt.yTex || ""}
                x={x}
                y={yPos}
                align="middle"
                fontSize={12.5}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ============================================================
   SMART LATEX & FORMULA PARSER & DETECTOR
   Detects polynomial degree 2, 3, 4, rational 1/1, rational 2/1
   ============================================================ */
export interface FunctionAnalysisResult {
  fnType: "quadratic" | "cubic" | "biquadratic" | "rational11" | "rational21" | "general";
  domain: string; // Tập xác định
  derivativeTex: string; // Công thức đạo hàm
  derivativeRootsTex: string[]; // Nghiệm y' = 0
  extrema: { type: "Cực đại" | "Cực tiểu" | "Đỉnh Parabol"; x: number; y: number; label: string }[];
  symmetryAxis?: string; // Trục đối xứng
  inflectionPoint?: { x: number; y: number; label: string }; // Điểm uốn / Tâm đối xứng
  asymptotes?: {
    vertical?: { eq: string; x: number };
    horizontal?: { eq: string; y: number };
    slant?: { eq: string; m: number; c: number };
    intersection?: { x: number; y: number };
  };
  monotonicity: {
    increasing: string[];
    decreasing: string[];
  };
  bbtData?: BBTData;
  bbtColumns: BBTColumn[];
  discontinuities: number[];
  formulaTex: string;
  fn: (x: number) => number;
}

function analyzeQuadratic(a: number, b: number, c: number): FunctionAnalysisResult {
  const safeA = a === 0 ? 0.0001 : a;
  const vx = -b / (2 * safeA);
  const vy = safeA * vx * vx + b * vx + c;

  const aStr = safeA === 1 ? "" : safeA === -1 ? "-" : fmt(safeA);
  const bPart = b === 0 ? "" : b > 0 ? ` + ${b === 1 ? "" : fmt(b)}x` : ` - ${b === -1 ? "" : fmt(Math.abs(b))}x`;
  const cPart = c === 0 ? "" : c > 0 ? ` + ${fmt(c)}` : ` - ${fmt(Math.abs(c))}`;
  const formulaTex = `${aStr}x^2${bPart}${cPart}`;

  const derivA = 2 * safeA;
  const derivAStr = derivA === 1 ? "" : derivA === -1 ? "-" : fmt(derivA);
  const derivBPart = b === 0 ? "" : b > 0 ? ` + ${fmt(b)}` : ` - ${fmt(Math.abs(b))}`;
  const derivativeTex = `y' = ${derivAStr}x${derivBPart}`;

  const isMin = safeA > 0;
  const extremumType = isMin ? "Cực tiểu" : "Cực đại";

  const vxTex = fmtFrac(vx);
  const vyTex = fmtFrac(vy);

  const bbtData: BBTData = isMin
    ? {
        points: [
          { xTex: "-\\infty", yTex: "+\\infty", yLevel: "top" },
          { xTex: vxTex, yPrime: "0", yTex: vyTex, yLevel: "bottom", yLabel: "CT" },
          { xTex: "+\\infty", yTex: "+\\infty", yLevel: "top" },
        ],
        segments: [
          { sign: "-", trend: "down", startLevel: "top", endLevel: "bottom" },
          { sign: "+", trend: "up", startLevel: "bottom", endLevel: "top" },
        ],
      }
    : {
        points: [
          { xTex: "-\\infty", yTex: "-\\infty", yLevel: "bottom" },
          { xTex: vxTex, yPrime: "0", yTex: vyTex, yLevel: "top", yLabel: "CĐ" },
          { xTex: "+\\infty", yTex: "-\\infty", yLevel: "bottom" },
        ],
        segments: [
          { sign: "+", trend: "up", startLevel: "bottom", endLevel: "top" },
          { sign: "-", trend: "down", startLevel: "top", endLevel: "bottom" },
        ],
      };

  const bbtColumns: BBTColumn[] = isMin
    ? [
        { x: "-\\infty", yPrime: "-", y: "+\\infty", yType: "limit-plus" },
        { x: vxTex, yPrime: "0", y: vyTex, yType: "valley" },
        { x: "+\\infty", yPrime: "+", y: "+\\infty", yType: "limit-plus" },
      ]
    : [
        { x: "-\\infty", yPrime: "+", y: "-\\infty", yType: "limit-minus" },
        { x: vxTex, yPrime: "0", y: vyTex, yType: "peak" },
        { x: "+\\infty", yPrime: "-", y: "-\\infty", yType: "limit-minus" },
      ];

  return {
    fnType: "quadratic",
    domain: "D = \\mathbb{R}",
    derivativeTex,
    derivativeRootsTex: [`x = ${vxTex}`],
    extrema: [
      {
        type: extremumType,
        x: vx,
        y: vy,
        label: `I(${fmt(vx)}; ${fmt(vy)})`,
      },
    ],
    symmetryAxis: `x = ${vxTex}`,
    monotonicity: isMin
      ? {
          increasing: [`(${vxTex}; +\\infty)`],
          decreasing: [`(-\\infty; ${vxTex})`],
        }
      : {
          increasing: [`(-\\infty; ${vxTex})`],
          decreasing: [`(${vxTex}; +\\infty)`],
        },
    bbtData,
    bbtColumns,
    discontinuities: [],
    formulaTex,
    fn: (x: number) => safeA * x * x + b * x + c,
  };
}

function analyzeCubic(a: number, b: number, c: number, d: number): FunctionAnalysisResult {
  const safeA = a === 0 ? 0.0001 : a;
  const fn = (x: number) => safeA * x * x * x + b * x * x + c * x + d;

  // y' = 3ax^2 + 2bx + c
  const A = 3 * safeA;
  const B = 2 * b;
  const C = c;
  const deltaPrime = b * b - 3 * safeA * c;

  const aStr = safeA === 1 ? "" : safeA === -1 ? "-" : fmt(safeA);
  const bPart = b === 0 ? "" : b > 0 ? ` + ${b === 1 ? "" : fmt(b)}x^2` : ` - ${b === -1 ? "" : fmt(Math.abs(b))}x^2`;
  const cPart = c === 0 ? "" : c > 0 ? ` + ${c === 1 ? "" : fmt(c)}x` : ` - ${c === -1 ? "" : fmt(Math.abs(c))}x`;
  const dPart = d === 0 ? "" : d > 0 ? ` + ${fmt(d)}` : ` - ${fmt(Math.abs(d))}`;
  const formulaTex = `${aStr}x^3${bPart}${cPart}${dPart}`;

  const derivAStr = A === 1 ? "" : A === -1 ? "-" : fmt(A);
  const derivBPart = B === 0 ? "" : B > 0 ? ` + ${fmt(B)}x` : ` - ${fmt(Math.abs(B))}x`;
  const derivCPart = C === 0 ? "" : C > 0 ? ` + ${fmt(C)}` : ` - ${fmt(Math.abs(C))}`;
  const derivativeTex = `y' = ${derivAStr}x^2${derivBPart}${derivCPart}`;

  // Điểm uốn
  const ux = -b / (3 * safeA);
  const uy = fn(ux);
  const inflectionPoint = {
    x: ux,
    y: uy,
    label: `U(${fmt(ux)}; ${fmt(uy)})`,
  };

  let derivativeRootsTex: string[] = [];
  const extrema: { type: "Cực đại" | "Cực tiểu"; x: number; y: number; label: string }[] = [];
  let monotonicity = { increasing: [] as string[], decreasing: [] as string[] };
  let bbtData: BBTData = { points: [], segments: [] };
  let bbtColumns: BBTColumn[] = [];

  if (deltaPrime > 0.00001) {
    const sq = Math.sqrt(deltaPrime);
    const r1 = (-b - sq) / (3 * safeA);
    const r2 = (-b + sq) / (3 * safeA);
    const x1 = Math.min(r1, r2);
    const x2 = Math.max(r1, r2);
    const y1 = fn(x1);
    const y2 = fn(x2);

    derivativeRootsTex = [`x_1 = ${fmtFrac(x1)}`, `x_2 = ${fmtFrac(x2)}`];

    if (safeA > 0) {
      // a > 0: x1 is Max, x2 is Min
      extrema.push({ type: "Cực đại", x: x1, y: y1, label: `CĐ(${fmt(x1)}; ${fmt(y1)})` });
      extrema.push({ type: "Cực tiểu", x: x2, y: y2, label: `CT(${fmt(x2)}; ${fmt(y2)})` });
      monotonicity = {
        increasing: [`(-\\infty; ${fmtFrac(x1)})`, `(${fmtFrac(x2)}; +\\infty)`],
        decreasing: [`(${fmtFrac(x1)}; ${fmtFrac(x2)})`],
      };
      bbtData = {
        points: [
          { xTex: "-\\infty", yTex: "-\\infty", yLevel: "bottom" },
          { xTex: fmtFrac(x1), yPrime: "0", yTex: fmtFrac(y1), yLevel: "top", yLabel: "CĐ" },
          { xTex: fmtFrac(x2), yPrime: "0", yTex: fmtFrac(y2), yLevel: "bottom", yLabel: "CT" },
          { xTex: "+\\infty", yTex: "+\\infty", yLevel: "top" },
        ],
        segments: [
          { sign: "+", trend: "up", startLevel: "bottom", endLevel: "top" },
          { sign: "-", trend: "down", startLevel: "top", endLevel: "bottom" },
          { sign: "+", trend: "up", startLevel: "bottom", endLevel: "top" },
        ],
      };
      bbtColumns = [
        { x: "-\\infty", yPrime: "+", y: "-\\infty", yType: "limit-minus" },
        { x: fmtFrac(x1), yPrime: "0", y: fmtFrac(y1), yType: "peak" },
        { x: fmtFrac(x2), yPrime: "0", y: fmtFrac(y2), yType: "valley" },
        { x: "+\\infty", yPrime: "+", y: "+\\infty", yType: "limit-plus" },
      ];
    } else {
      // a < 0: x1 is Min, x2 is Max
      extrema.push({ type: "Cực tiểu", x: x1, y: y1, label: `CT(${fmt(x1)}; ${fmt(y1)})` });
      extrema.push({ type: "Cực đại", x: x2, y: y2, label: `CĐ(${fmt(x2)}; ${fmt(y2)})` });
      monotonicity = {
        increasing: [`(${fmtFrac(x1)}; ${fmtFrac(x2)})`],
        decreasing: [`(-\\infty; ${fmtFrac(x1)})`, `(${fmtFrac(x2)}; +\\infty)`],
      };
      bbtData = {
        points: [
          { xTex: "-\\infty", yTex: "+\\infty", yLevel: "top" },
          { xTex: fmtFrac(x1), yPrime: "0", yTex: fmtFrac(y1), yLevel: "bottom", yLabel: "CT" },
          { xTex: fmtFrac(x2), yPrime: "0", yTex: fmtFrac(y2), yLevel: "top", yLabel: "CĐ" },
          { xTex: "+\\infty", yTex: "-\\infty", yLevel: "bottom" },
        ],
        segments: [
          { sign: "-", trend: "down", startLevel: "top", endLevel: "bottom" },
          { sign: "+", trend: "up", startLevel: "bottom", endLevel: "top" },
          { sign: "-", trend: "down", startLevel: "top", endLevel: "bottom" },
        ],
      };
      bbtColumns = [
        { x: "-\\infty", yPrime: "-", y: "+\\infty", yType: "limit-plus" },
        { x: fmtFrac(x1), yPrime: "0", y: fmtFrac(y1), yType: "valley" },
        { x: fmtFrac(x2), yPrime: "0", y: fmtFrac(y2), yType: "peak" },
        { x: "+\\infty", yPrime: "-", y: "-\\infty", yType: "limit-minus" },
      ];
    }
  } else if (Math.abs(deltaPrime) <= 0.00001) {
    const x0 = -b / (3 * safeA);
    derivativeRootsTex = [`x_0 = ${fmtFrac(x0)} \\text{ (nghiệm kép)}`];
    if (safeA > 0) {
      monotonicity = { increasing: ["\\mathbb{R}"], decreasing: [] };
      bbtData = {
        points: [
          { xTex: "-\\infty", yTex: "-\\infty", yLevel: "bottom" },
          { xTex: fmtFrac(x0), yPrime: "0", yTex: fmtFrac(fn(x0)), yLevel: "mid" },
          { xTex: "+\\infty", yTex: "+\\infty", yLevel: "top" },
        ],
        segments: [
          { sign: "+", trend: "up", startLevel: "bottom", endLevel: "mid" },
          { sign: "+", trend: "up", startLevel: "mid", endLevel: "top" },
        ],
      };
      bbtColumns = [
        { x: "-\\infty", yPrime: "+", y: "-\\infty", yType: "limit-minus" },
        { x: fmtFrac(x0), yPrime: "0", y: fmtFrac(fn(x0)), yType: "mid" },
        { x: "+\\infty", yPrime: "+", y: "+\\infty", yType: "limit-plus" },
      ];
    } else {
      monotonicity = { increasing: [], decreasing: ["\\mathbb{R}"] };
      bbtData = {
        points: [
          { xTex: "-\\infty", yTex: "+\\infty", yLevel: "top" },
          { xTex: fmtFrac(x0), yPrime: "0", yTex: fmtFrac(fn(x0)), yLevel: "mid" },
          { xTex: "+\\infty", yTex: "-\\infty", yLevel: "bottom" },
        ],
        segments: [
          { sign: "-", trend: "down", startLevel: "top", endLevel: "mid" },
          { sign: "-", trend: "down", startLevel: "mid", endLevel: "bottom" },
        ],
      };
      bbtColumns = [
        { x: "-\\infty", yPrime: "-", y: "+\\infty", yType: "limit-plus" },
        { x: fmtFrac(x0), yPrime: "0", y: fmtFrac(fn(x0)), yType: "mid" },
        { x: "+\\infty", yPrime: "-", y: "-\\infty", yType: "limit-minus" },
      ];
    }
  } else {
    derivativeRootsTex = ["\\text{Vô nghiệm (}\\Delta' < 0\\text{)}"];
    if (safeA > 0) {
      monotonicity = { increasing: ["\\mathbb{R}"], decreasing: [] };
      bbtData = {
        points: [
          { xTex: "-\\infty", yTex: "-\\infty", yLevel: "bottom" },
          { xTex: "+\\infty", yTex: "+\\infty", yLevel: "top" },
        ],
        segments: [
          { sign: "+", trend: "up", startLevel: "bottom", endLevel: "top" },
        ],
      };
      bbtColumns = [
        { x: "-\\infty", yPrime: "+", y: "-\\infty", yType: "limit-minus" },
        { x: "+\\infty", yPrime: "+", y: "+\\infty", yType: "limit-plus" },
      ];
    } else {
      monotonicity = { increasing: [], decreasing: ["\\mathbb{R}"] };
      bbtData = {
        points: [
          { xTex: "-\\infty", yTex: "+\\infty", yLevel: "top" },
          { xTex: "+\\infty", yTex: "-\\infty", yLevel: "bottom" },
        ],
        segments: [
          { sign: "-", trend: "down", startLevel: "top", endLevel: "bottom" },
        ],
      };
      bbtColumns = [
        { x: "-\\infty", yPrime: "-", y: "+\\infty", yType: "limit-plus" },
        { x: "+\\infty", yPrime: "-", y: "-\\infty", yType: "limit-minus" },
      ];
    }
  }

  return {
    fnType: "cubic",
    domain: "D = \\mathbb{R}",
    derivativeTex,
    derivativeRootsTex,
    extrema,
    inflectionPoint,
    monotonicity,
    bbtData,
    bbtColumns,
    discontinuities: [],
    formulaTex,
    fn,
  };
}

function analyzeBiquadratic(a: number, b: number, c: number): FunctionAnalysisResult {
  const safeA = a === 0 ? 0.0001 : a;
  const fn = (x: number) => safeA * x * x * x * x + b * x * x + c;

  const aStr = safeA === 1 ? "" : safeA === -1 ? "-" : fmt(safeA);
  const bPart = b === 0 ? "" : b > 0 ? ` + ${b === 1 ? "" : fmt(b)}x^2` : ` - ${b === -1 ? "" : fmt(Math.abs(b))}x^2`;
  const cPart = c === 0 ? "" : c > 0 ? ` + ${fmt(c)}` : ` - ${fmt(Math.abs(c))}`;
  const formulaTex = `${aStr}x^4${bPart}${cPart}`;

  // y' = 4ax^3 + 2bx = 2x(2ax^2 + b)
  const derivA = 4 * safeA;
  const derivB = 2 * b;
  const derivAStr = derivA === 1 ? "" : derivA === -1 ? "-" : fmt(derivA);
  const derivBPart = derivB === 0 ? "" : derivB > 0 ? ` + ${fmt(derivB)}x` : ` - ${fmt(Math.abs(derivB))}x`;
  const derivativeTex = `y' = ${derivAStr}x^3${derivBPart}`;

  const has3Extrema = -b / (2 * safeA) > 0.0001;
  const extrema: { type: "Cực đại" | "Cực tiểu"; x: number; y: number; label: string }[] = [];
  let derivativeRootsTex: string[] = [];
  let monotonicity = { increasing: [] as string[], decreasing: [] as string[] };
  let bbtData: BBTData = { points: [], segments: [] };
  let bbtColumns: BBTColumn[] = [];

  if (has3Extrema) {
    const x0 = 0;
    const y0 = c;
    const x1 = -Math.sqrt(-b / (2 * safeA));
    const x2 = Math.sqrt(-b / (2 * safeA));
    const y1 = fn(x1);
    const y2 = fn(x2);

    derivativeRootsTex = [`x_1 = -${fmt(Math.abs(x1))}`, "x_2 = 0", `x_3 = ${fmt(x2)}`];

    if (safeA > 0) {
      // W-shape: x1 is Min, x0 is Max, x2 is Min
      extrema.push({ type: "Cực tiểu", x: x1, y: y1, label: `CT_1(${fmt(x1)}; ${fmt(y1)})` });
      extrema.push({ type: "Cực đại", x: x0, y: y0, label: `CĐ(0; ${fmt(y0)})` });
      extrema.push({ type: "Cực tiểu", x: x2, y: y2, label: `CT_2(${fmt(x2)}; ${fmt(y2)})` });

      monotonicity = {
        increasing: [`(${fmtFrac(x1)}; 0)`, `(${fmtFrac(x2)}; +\\infty)`],
        decreasing: [`(-\\infty; ${fmtFrac(x1)})`, `(0; ${fmtFrac(x2)})`],
      };

      bbtData = {
        points: [
          { xTex: "-\\infty", yTex: "+\\infty", yLevel: "top" },
          { xTex: fmtFrac(x1), yPrime: "0", yTex: fmtFrac(y1), yLevel: "bottom", yLabel: "CT" },
          { xTex: "0", yPrime: "0", yTex: fmtFrac(y0), yLevel: "top", yLabel: "CĐ" },
          { xTex: fmtFrac(x2), yPrime: "0", yTex: fmtFrac(y2), yLevel: "bottom", yLabel: "CT" },
          { xTex: "+\\infty", yTex: "+\\infty", yLevel: "top" },
        ],
        segments: [
          { sign: "-", trend: "down", startLevel: "top", endLevel: "bottom" },
          { sign: "+", trend: "up", startLevel: "bottom", endLevel: "top" },
          { sign: "-", trend: "down", startLevel: "top", endLevel: "bottom" },
          { sign: "+", trend: "up", startLevel: "bottom", endLevel: "top" },
        ],
      };

      bbtColumns = [
        { x: "-\\infty", yPrime: "-", y: "+\\infty", yType: "limit-plus" },
        { x: fmtFrac(x1), yPrime: "0", y: fmtFrac(y1), yType: "valley" },
        { x: "0", yPrime: "0", y: fmtFrac(y0), yType: "peak" },
        { x: fmtFrac(x2), yPrime: "0", y: fmtFrac(y2), yType: "valley" },
        { x: "+\\infty", yPrime: "+", y: "+\\infty", yType: "limit-plus" },
      ];
    } else {
      // M-shape: x1 is Max, x0 is Min, x2 is Max
      extrema.push({ type: "Cực đại", x: x1, y: y1, label: `CĐ_1(${fmt(x1)}; ${fmt(y1)})` });
      extrema.push({ type: "Cực tiểu", x: x0, y: y0, label: `CT(0; ${fmt(y0)})` });
      extrema.push({ type: "Cực đại", x: x2, y: y2, label: `CĐ_2(${fmt(x2)}; ${fmt(y2)})` });

      monotonicity = {
        increasing: [`(-\\infty; ${fmtFrac(x1)})`, `(0; ${fmtFrac(x2)})`],
        decreasing: [`(${fmtFrac(x1)}; 0)`, `(${fmtFrac(x2)}; +\\infty)`],
      };

      bbtData = {
        points: [
          { xTex: "-\\infty", yTex: "-\\infty", yLevel: "bottom" },
          { xTex: fmtFrac(x1), yPrime: "0", yTex: fmtFrac(y1), yLevel: "top", yLabel: "CĐ" },
          { xTex: "0", yPrime: "0", yTex: fmtFrac(y0), yLevel: "bottom", yLabel: "CT" },
          { xTex: fmtFrac(x2), yPrime: "0", yTex: fmtFrac(y2), yLevel: "top", yLabel: "CĐ" },
          { xTex: "+\\infty", yTex: "-\\infty", yLevel: "bottom" },
        ],
        segments: [
          { sign: "+", trend: "up", startLevel: "bottom", endLevel: "top" },
          { sign: "-", trend: "down", startLevel: "top", endLevel: "bottom" },
          { sign: "+", trend: "up", startLevel: "bottom", endLevel: "top" },
          { sign: "-", trend: "down", startLevel: "top", endLevel: "bottom" },
        ],
      };

      bbtColumns = [
        { x: "-\\infty", yPrime: "+", y: "-\\infty", yType: "limit-minus" },
        { x: fmtFrac(x1), yPrime: "0", y: fmtFrac(y1), yType: "peak" },
        { x: "0", yPrime: "0", y: fmtFrac(y0), yType: "valley" },
        { x: fmtFrac(x2), yPrime: "0", y: fmtFrac(y2), yType: "peak" },
        { x: "+\\infty", yPrime: "-", y: "-\\infty", yType: "limit-minus" },
      ];
    }
  } else {
    // 1 Extremum at x = 0
    derivativeRootsTex = ["x = 0"];
    const y0 = c;

    if (safeA > 0) {
      extrema.push({ type: "Cực tiểu", x: 0, y: y0, label: `CT(0; ${fmt(y0)})` });
      monotonicity = {
        increasing: ["(0; +\\infty)"],
        decreasing: ["(-\\infty; 0)"],
      };
      bbtData = {
        points: [
          { xTex: "-\\infty", yTex: "+\\infty", yLevel: "top" },
          { xTex: "0", yPrime: "0", yTex: fmtFrac(y0), yLevel: "bottom", yLabel: "CT" },
          { xTex: "+\\infty", yTex: "+\\infty", yLevel: "top" },
        ],
        segments: [
          { sign: "-", trend: "down", startLevel: "top", endLevel: "bottom" },
          { sign: "+", trend: "up", startLevel: "bottom", endLevel: "top" },
        ],
      };
      bbtColumns = [
        { x: "-\\infty", yPrime: "-", y: "+\\infty", yType: "limit-plus" },
        { x: "0", yPrime: "0", y: fmtFrac(y0), yType: "valley" },
        { x: "+\\infty", yPrime: "+", y: "+\\infty", yType: "limit-plus" },
      ];
    } else {
      extrema.push({ type: "Cực đại", x: 0, y: y0, label: `CĐ(0; ${fmt(y0)})` });
      monotonicity = {
        increasing: ["(-\\infty; 0)"],
        decreasing: ["(0; +\\infty)"],
      };
      bbtData = {
        points: [
          { xTex: "-\\infty", yTex: "-\\infty", yLevel: "bottom" },
          { xTex: "0", yPrime: "0", yTex: fmtFrac(y0), yLevel: "top", yLabel: "CĐ" },
          { xTex: "+\\infty", yTex: "-\\infty", yLevel: "bottom" },
        ],
        segments: [
          { sign: "+", trend: "up", startLevel: "bottom", endLevel: "top" },
          { sign: "-", trend: "down", startLevel: "top", endLevel: "bottom" },
        ],
      };
      bbtColumns = [
        { x: "-\\infty", yPrime: "+", y: "-\\infty", yType: "limit-minus" },
        { x: "0", yPrime: "0", y: fmtFrac(y0), yType: "peak" },
        { x: "+\\infty", yPrime: "-", y: "-\\infty", yType: "limit-minus" },
      ];
    }
  }

  return {
    fnType: "biquadratic",
    domain: "D = \\mathbb{R}",
    derivativeTex,
    derivativeRootsTex,
    extrema,
    symmetryAxis: "x = 0 \\text{ (Trục Oy)}",
    monotonicity,
    bbtData,
    bbtColumns,
    discontinuities: [],
    formulaTex,
    fn,
  };
}

function analyzeRational11(a: number, b: number, c: number, d: number): FunctionAnalysisResult {
  const safeC = c === 0 ? 1 : c;
  const pole = -d / safeC;
  const det = a * d - b * safeC;

  const fn = (x: number) => {
    if (Math.abs(safeC * x + d) < 1e-6) return NaN;
    return (a * x + b) / (safeC * x + d);
  };

  const aStr = a === 1 ? "x" : a === -1 ? "-x" : a === 0 ? "" : `${fmt(a)}x`;
  const bPart = b === 0 && a !== 0 ? "" : b > 0 && a !== 0 ? ` + ${fmt(b)}` : b < 0 && a !== 0 ? ` - ${fmt(Math.abs(b))}` : `${fmt(b)}`;
  const cStr = safeC === 1 ? "x" : safeC === -1 ? "-x" : `${fmt(safeC)}x`;
  const dPart = d === 0 ? "" : d > 0 ? ` + ${fmt(d)}` : ` - ${fmt(Math.abs(d))}`;
  const formulaTex = `\\frac{${aStr || "0"}${bPart}}{${cStr}${dPart}}`;

  const denomTex = safeC === 1 ? (d === 0 ? "x^2" : `(x ${d > 0 ? `+ ${fmt(d)}` : `- ${fmt(Math.abs(d))}`})^2`) : `(${cStr}${dPart})^2`;
  const derivativeTex = `y' = \\frac{${fmt(det)}}{${denomTex}}`;

  const poleTex = fmtFrac(pole);
  const tcnY = a / safeC;
  const tcnTex = fmtFrac(tcnY);

  const isInc = det > 0;
  const monotonicity = isInc
    ? {
        increasing: [`(-\\infty; ${poleTex})`, `(${poleTex}; +\\infty)`],
        decreasing: [],
      }
    : {
        increasing: [],
        decreasing: [`(-\\infty; ${poleTex})`, `(${poleTex}; +\\infty)`],
      };

  const bbtData: BBTData = isInc
    ? {
        points: [
          { xTex: "-\\infty", yTex: tcnTex, yLevel: "mid" },
          {
            xTex: poleTex,
            yPrime: "||",
            isDiscontinuity: true,
            leftLimit: { tex: "+\\infty", level: "top" },
            rightLimit: { tex: "-\\infty", level: "bottom" },
          },
          { xTex: "+\\infty", yTex: tcnTex, yLevel: "mid" },
        ],
        segments: [
          { sign: "+", trend: "up", startLevel: "mid", endLevel: "top" },
          { sign: "+", trend: "up", startLevel: "bottom", endLevel: "mid" },
        ],
      }
    : {
        points: [
          { xTex: "-\\infty", yTex: tcnTex, yLevel: "mid" },
          {
            xTex: poleTex,
            yPrime: "||",
            isDiscontinuity: true,
            leftLimit: { tex: "-\\infty", level: "bottom" },
            rightLimit: { tex: "+\\infty", level: "top" },
          },
          { xTex: "+\\infty", yTex: tcnTex, yLevel: "mid" },
        ],
        segments: [
          { sign: "-", trend: "down", startLevel: "mid", endLevel: "bottom" },
          { sign: "-", trend: "down", startLevel: "top", endLevel: "mid" },
        ],
      };

  const bbtColumns: BBTColumn[] = isInc
    ? [
        { x: "-\\infty", yPrime: "+", y: tcnTex, yType: "mid" },
        { x: poleTex, yPrime: "||", y: "", yType: "asymptote", yLeft: "+\\infty", yRight: "-\\infty" },
        { x: "+\\infty", yPrime: "+", y: tcnTex, yType: "mid" },
      ]
    : [
        { x: "-\\infty", yPrime: "-", y: tcnTex, yType: "mid" },
        { x: poleTex, yPrime: "||", y: "", yType: "asymptote", yLeft: "-\\infty", yRight: "+\\infty" },
        { x: "+\\infty", yPrime: "-", y: tcnTex, yType: "mid" },
      ];

  return {
    fnType: "rational11",
    domain: `D = \\mathbb{R} \\setminus \\{${poleTex}\\}`,
    derivativeTex,
    derivativeRootsTex: ["\\text{Vô nghiệm (hàm số không có cực trị)}"],
    extrema: [],
    asymptotes: {
      vertical: { eq: `x = ${poleTex}`, x: pole },
      horizontal: { eq: `y = ${tcnTex}`, y: tcnY },
      intersection: { x: pole, y: tcnY },
    },
    inflectionPoint: {
      x: pole,
      y: tcnY,
      label: `I(${fmt(pole)}; ${fmt(tcnY)})`,
    },
    monotonicity,
    bbtData,
    bbtColumns,
    discontinuities: [pole],
    formulaTex,
    fn,
  };
}

function analyzeRational21(a: number, b: number, c: number, p: number, q: number): FunctionAnalysisResult {
  const safeP = p === 0 ? 1 : p;
  const safeA = a === 0 ? 1 : a;
  const pole = -q / safeP;

  const fn = (x: number) => {
    if (Math.abs(safeP * x + q) < 1e-6) return NaN;
    return (safeA * x * x + b * x + c) / (safeP * x + q);
  };

  // Formula string
  const aStr = safeA === 1 ? "x^2" : safeA === -1 ? "-x^2" : `${fmt(safeA)}x^2`;
  const bPart = b === 0 ? "" : b > 0 ? ` + ${b === 1 ? "" : fmt(b)}x` : ` - ${b === -1 ? "" : fmt(Math.abs(b))}x`;
  const cPart = c === 0 ? "" : c > 0 ? ` + ${fmt(c)}` : ` - ${fmt(Math.abs(c))}`;
  const pStr = safeP === 1 ? "x" : safeP === -1 ? "-x" : `${fmt(safeP)}x`;
  const qPart = q === 0 ? "" : q > 0 ? ` + ${fmt(q)}` : ` - ${fmt(Math.abs(q))}`;
  const formulaTex = `\\frac{${aStr}${bPart}${cPart}}{${pStr}${qPart}}`;

  // y' = [ a p x^2 + 2aq x + (bq - cp) ] / (px+q)^2
  const dA = safeA * safeP;
  const dB = 2 * safeA * q;
  const dC = b * q - c * safeP;
  const denomTex = `(${pStr}${qPart})^2`;

  const dAStr = dA === 1 ? "x^2" : dA === -1 ? "-x^2" : `${fmt(dA)}x^2`;
  const dBPart = dB === 0 ? "" : dB > 0 ? ` + ${fmt(dB)}x` : ` - ${fmt(Math.abs(dB))}x`;
  const dCPart = dC === 0 ? "" : dC > 0 ? ` + ${fmt(dC)}` : ` - ${fmt(Math.abs(dC))}`;
  const derivativeTex = `y' = \\frac{${dAStr}${dBPart}${dCPart}}{${denomTex}}`;

  // Asymptotes
  const slantM = safeA / safeP;
  const slantC = (b * safeP - safeA * q) / (safeP * safeP);
  const slantMStr = slantM === 1 ? "x" : slantM === -1 ? "-x" : `${fmt(slantM)}x`;
  const slantCPart = slantC === 0 ? "" : slantC > 0 ? ` + ${fmt(slantC)}` : ` - ${fmt(Math.abs(slantC))}`;
  const slantEq = `y = ${slantMStr}${slantCPart}`;
  const poleTex = fmtFrac(pole);

  // Delta of numerator of y'
  const deltaDeriv = dB * dB - 4 * dA * dC;
  const extrema: { type: "Cực đại" | "Cực tiểu"; x: number; y: number; label: string }[] = [];
  let derivativeRootsTex: string[] = [];
  let monotonicity = { increasing: [] as string[], decreasing: [] as string[] };
  let bbtData: BBTData = { points: [], segments: [] };
  let bbtColumns: BBTColumn[] = [];

  const symCenterY = slantM * pole + slantC;
  const inflectionPoint = {
    x: pole,
    y: symCenterY,
    label: `I(${fmt(pole)}; ${fmt(symCenterY)})`,
  };

  if (deltaDeriv > 0.0001 && Math.abs(dA) > 0.0001) {
    const sq = Math.sqrt(deltaDeriv);
    const r1 = (-dB - sq) / (2 * dA);
    const r2 = (-dB + sq) / (2 * dA);
    const x1 = Math.min(r1, r2);
    const x2 = Math.max(r1, r2);
    const y1 = fn(x1);
    const y2 = fn(x2);

    derivativeRootsTex = [`x_1 = ${fmtFrac(x1)}`, `x_2 = ${fmtFrac(x2)}`];

    if (dA > 0) {
      // Branch left has local max x1, branch right has local min x2
      extrema.push({ type: "Cực đại", x: x1, y: y1, label: `CĐ(${fmt(x1)}; ${fmt(y1)})` });
      extrema.push({ type: "Cực tiểu", x: x2, y: y2, label: `CT(${fmt(x2)}; ${fmt(y2)})` });

      monotonicity = {
        increasing: [`(-\\infty; ${fmtFrac(x1)})`, `(${fmtFrac(x2)}; +\\infty)`],
        decreasing: [`(${fmtFrac(x1)}; ${poleTex})`, `(${poleTex}; ${fmtFrac(x2)})`],
      };

      bbtData = {
        points: [
          { xTex: "-\\infty", yTex: "-\\infty", yLevel: "bottom" },
          { xTex: fmtFrac(x1), yPrime: "0", yTex: fmtFrac(y1), yLevel: "top", yLabel: "CĐ" },
          {
            xTex: poleTex,
            yPrime: "||",
            isDiscontinuity: true,
            leftLimit: { tex: "-\\infty", level: "bottom" },
            rightLimit: { tex: "+\\infty", level: "top" },
          },
          { xTex: fmtFrac(x2), yPrime: "0", yTex: fmtFrac(y2), yLevel: "bottom", yLabel: "CT" },
          { xTex: "+\\infty", yTex: "+\\infty", yLevel: "top" },
        ],
        segments: [
          { sign: "+", trend: "up", startLevel: "bottom", endLevel: "top" },
          { sign: "-", trend: "down", startLevel: "top", endLevel: "bottom" },
          { sign: "-", trend: "down", startLevel: "top", endLevel: "bottom" },
          { sign: "+", trend: "up", startLevel: "bottom", endLevel: "top" },
        ],
      };

      bbtColumns = [
        { x: "-\\infty", yPrime: "+", y: "-\\infty", yType: "limit-minus" },
        { x: fmtFrac(x1), yPrime: "0", y: fmtFrac(y1), yType: "peak" },
        { x: poleTex, yPrime: "||", y: "", yType: "asymptote", yLeft: "-\\infty", yRight: "+\\infty" },
        { x: fmtFrac(x2), yPrime: "0", y: fmtFrac(y2), yType: "valley" },
        { x: "+\\infty", yPrime: "+", y: "+\\infty", yType: "limit-plus" },
      ];
    } else {
      extrema.push({ type: "Cực tiểu", x: x1, y: y1, label: `CT(${fmt(x1)}; ${fmt(y1)})` });
      extrema.push({ type: "Cực đại", x: x2, y: y2, label: `CĐ(${fmt(x2)}; ${fmt(y2)})` });

      monotonicity = {
        increasing: [`(${fmtFrac(x1)}; ${poleTex})`, `(${poleTex}; ${fmtFrac(x2)})`],
        decreasing: [`(-\\infty; ${fmtFrac(x1)})`, `(${fmtFrac(x2)}; +\\infty)`],
      };

      bbtData = {
        points: [
          { xTex: "-\\infty", yTex: "+\\infty", yLevel: "top" },
          { xTex: fmtFrac(x1), yPrime: "0", yTex: fmtFrac(y1), yLevel: "bottom", yLabel: "CT" },
          {
            xTex: poleTex,
            yPrime: "||",
            isDiscontinuity: true,
            leftLimit: { tex: "+\\infty", level: "top" },
            rightLimit: { tex: "-\\infty", level: "bottom" },
          },
          { xTex: fmtFrac(x2), yPrime: "0", yTex: fmtFrac(y2), yLevel: "top", yLabel: "CĐ" },
          { xTex: "+\\infty", yTex: "-\\infty", yLevel: "bottom" },
        ],
        segments: [
          { sign: "-", trend: "down", startLevel: "top", endLevel: "bottom" },
          { sign: "+", trend: "up", startLevel: "bottom", endLevel: "top" },
          { sign: "+", trend: "up", startLevel: "bottom", endLevel: "top" },
          { sign: "-", trend: "down", startLevel: "top", endLevel: "bottom" },
        ],
      };

      bbtColumns = [
        { x: "-\\infty", yPrime: "-", y: "+\\infty", yType: "limit-plus" },
        { x: fmtFrac(x1), yPrime: "0", y: fmtFrac(y1), yType: "valley" },
        { x: poleTex, yPrime: "||", y: "", yType: "asymptote", yLeft: "+\\infty", yRight: "-\\infty" },
        { x: fmtFrac(x2), yPrime: "0", y: fmtFrac(y2), yType: "peak" },
        { x: "+\\infty", yPrime: "-", y: "-\\infty", yType: "limit-minus" },
      ];
    }
  } else {
    derivativeRootsTex = ["\\text{Vô nghiệm (hàm số không có cực trị)}"];
    if (dA > 0) {
      monotonicity = {
        increasing: [`(-\\infty; ${poleTex})`, `(${poleTex}; +\\infty)`],
        decreasing: [],
      };
      bbtData = {
        points: [
          { xTex: "-\\infty", yTex: "-\\infty", yLevel: "bottom" },
          {
            xTex: poleTex,
            yPrime: "||",
            isDiscontinuity: true,
            leftLimit: { tex: "+\\infty", level: "top" },
            rightLimit: { tex: "-\\infty", level: "bottom" },
          },
          { xTex: "+\\infty", yTex: "+\\infty", yLevel: "top" },
        ],
        segments: [
          { sign: "+", trend: "up", startLevel: "bottom", endLevel: "top" },
          { sign: "+", trend: "up", startLevel: "bottom", endLevel: "top" },
        ],
      };
      bbtColumns = [
        { x: "-\\infty", yPrime: "+", y: "-\\infty", yType: "limit-minus" },
        { x: poleTex, yPrime: "||", y: "", yType: "asymptote", yLeft: "+\\infty", yRight: "-\\infty" },
        { x: "+\\infty", yPrime: "+", y: "+\\infty", yType: "limit-plus" },
      ];
    } else {
      monotonicity = {
        increasing: [],
        decreasing: [`(-\\infty; ${poleTex})`, `(${poleTex}; +\\infty)`],
      };
      bbtData = {
        points: [
          { xTex: "-\\infty", yTex: "+\\infty", yLevel: "top" },
          {
            xTex: poleTex,
            yPrime: "||",
            isDiscontinuity: true,
            leftLimit: { tex: "-\\infty", level: "bottom" },
            rightLimit: { tex: "+\\infty", level: "top" },
          },
          { xTex: "+\\infty", yTex: "-\\infty", yLevel: "bottom" },
        ],
        segments: [
          { sign: "-", trend: "down", startLevel: "top", endLevel: "bottom" },
          { sign: "-", trend: "down", startLevel: "top", endLevel: "bottom" },
        ],
      };
      bbtColumns = [
        { x: "-\\infty", yPrime: "-", y: "+\\infty", yType: "limit-plus" },
        { x: poleTex, yPrime: "||", y: "", yType: "asymptote", yLeft: "-\\infty", yRight: "+\\infty" },
        { x: "+\\infty", yPrime: "-", y: "-\\infty", yType: "limit-minus" },
      ];
    }
  }

  return {
    fnType: "rational21",
    domain: `D = \\mathbb{R} \\setminus \\{${poleTex}\\}`,
    derivativeTex,
    derivativeRootsTex,
    extrema,
    asymptotes: {
      vertical: { eq: `x = ${poleTex}`, x: pole },
      slant: { eq: slantEq, m: slantM, c: slantC },
      intersection: { x: pole, y: symCenterY },
    },
    inflectionPoint,
    monotonicity,
    bbtData,
    bbtColumns,
    discontinuities: [pole],
    formulaTex,
    fn,
  };
}

/** Tự động trích xuất hệ số từ biểu thức chuỗi bất kỳ */
function parseFormulaToAnalysis(expr: string): FunctionAnalysisResult | null {
  if (!expr || !expr.trim()) return null;
  const clean = expr.replace(/\s+/g, "").replace(/^(?:y|f\(x\))=/, "");

  // 1. Phân thức (frac{...}{...} or (...)/(...))
  const fracMatch = clean.match(/\\(?:d)?frac\{([^{}]+)\}\{([^{}]+)\}/) || clean.match(/^\(?([^/()]+)\)?\/\(?([^/()]+)\)?$/);
  if (fracMatch) {
    const num = fracMatch[1];
    const den = fracMatch[2];

    // Check if den is px + q
    const denMatch = den.match(/^([+-]?\d*(?:\.\d+)?)x([+-]\d+(?:\.\d+)?)?$/) || den.match(/^x$/);
    if (denMatch) {
      const pRaw = denMatch[1] === "" || denMatch[1] === "+" ? "1" : denMatch[1] === "-" ? "-1" : denMatch[1] || "1";
      const p = parseFloat(pRaw) || 1;
      const q = parseFloat(denMatch[2] || "0") || 0;

      // Check num: ax + b (Rational 1/1)
      const num1Match = num.match(/^([+-]?\d*(?:\.\d+)?)x([+-]\d+(?:\.\d+)?)?$/);
      if (num1Match) {
        const aRaw = num1Match[1] === "" || num1Match[1] === "+" ? "1" : num1Match[1] === "-" ? "-1" : num1Match[1];
        const a = parseFloat(aRaw) || 0;
        const b = parseFloat(num1Match[2] || "0") || 0;
        return analyzeRational11(a, b, p, q);
      }

      // Check num: ax^2 + bx + c (Rational 2/1)
      const num2Match = num.match(/^([+-]?\d*(?:\.\d+)?)x\^?2(?:([+-]\d*(?:\.\d+)?)x)?([+-]\d+(?:\.\d+)?)?$/);
      if (num2Match) {
        const aRaw = num2Match[1] === "" || num2Match[1] === "+" ? "1" : num2Match[1] === "-" ? "-1" : num2Match[1] || "1";
        const a = parseFloat(aRaw) || 1;
        const bRaw = num2Match[2] === "" || num2Match[2] === "+" ? "1" : num2Match[2] === "-" ? "-1" : num2Match[2] || "0";
        const b = parseFloat(bRaw) || 0;
        const c = parseFloat(num2Match[3] || "0") || 0;
        return analyzeRational21(a, b, c, p, q);
      }
    }
  }

  // 2. Bậc 4 trùng phương: ax^4 + bx^2 + c
  const biquadMatch = clean.match(/^([+-]?\d*(?:\.\d+)?)x\^?4(?:([+-]\d*(?:\.\d+)?)x\^?2)?([+-]\d+(?:\.\d+)?)?$/);
  if (biquadMatch) {
    const aRaw = biquadMatch[1] === "" || biquadMatch[1] === "+" ? "1" : biquadMatch[1] === "-" ? "-1" : biquadMatch[1] || "1";
    const a = parseFloat(aRaw) || 1;
    const bRaw = biquadMatch[2] === "" || biquadMatch[2] === "+" ? "1" : biquadMatch[2] === "-" ? "-1" : biquadMatch[2] || "0";
    const b = parseFloat(bRaw) || 0;
    const c = parseFloat(biquadMatch[3] || "0") || 0;
    return analyzeBiquadratic(a, b, c);
  }

  // 3. Bậc 3: ax^3 + bx^2 + cx + d
  const cubicMatch = clean.match(/^([+-]?\d*(?:\.\d+)?)x\^?3(?:([+-]\d*(?:\.\d+)?)x\^?2)?(?:([+-]\d*(?:\.\d+)?)x)?([+-]\d+(?:\.\d+)?)?$/);
  if (cubicMatch) {
    const aRaw = cubicMatch[1] === "" || cubicMatch[1] === "+" ? "1" : cubicMatch[1] === "-" ? "-1" : cubicMatch[1] || "1";
    const a = parseFloat(aRaw) || 1;
    const bRaw = cubicMatch[2] === "" || cubicMatch[2] === "+" ? "1" : cubicMatch[2] === "-" ? "-1" : cubicMatch[2] || "0";
    const b = parseFloat(bRaw) || 0;
    const cRaw = cubicMatch[3] === "" || cubicMatch[3] === "+" ? "1" : cubicMatch[3] === "-" ? "-1" : cubicMatch[3] || "0";
    const c = parseFloat(cRaw) || 0;
    const d = parseFloat(cubicMatch[4] || "0") || 0;
    return analyzeCubic(a, b, c, d);
  }

  // 4. Bậc 2: ax^2 + bx + c
  const quadMatch = clean.match(/^([+-]?\d*(?:\.\d+)?)x\^?2(?:([+-]\d*(?:\.\d+)?)x)?([+-]\d+(?:\.\d+)?)?$/);
  if (quadMatch) {
    const aRaw = quadMatch[1] === "" || quadMatch[1] === "+" ? "1" : quadMatch[1] === "-" ? "-1" : quadMatch[1] || "1";
    const a = parseFloat(aRaw) || 1;
    const bRaw = quadMatch[2] === "" || quadMatch[2] === "+" ? "1" : quadMatch[2] === "-" ? "-1" : quadMatch[2] || "0";
    const b = parseFloat(bRaw) || 0;
    const c = parseFloat(quadMatch[3] || "0") || 0;
    return analyzeQuadratic(a, b, c);
  }

  return null;
}

/* ============================================================
   MAIN FUNCTION MODULE COMPONENT
   ============================================================ */
type RightTabId = "bbt" | "derivative" | "monotonicity" | "extrema" | "asymptotes";

const RIGHT_TABS: { id: RightTabId; label: string }[] = [
  { id: "bbt", label: "BẢNG BIẾN THIÊN" },
  { id: "derivative", label: "ĐẠO HÀM" },
  { id: "monotonicity", label: "KHOẢNG BIẾN THIÊN" },
  { id: "extrema", label: "CỰC TRỊ" },
  { id: "asymptotes", label: "CÁC TIỆM CẬN" },
];

export function FunctionModule() {
  const { colors } = useTheme();
  setFnThemeColors(colors);

  const [customLatex, setCustomLatex] = useState("x^2 - 4x + 3");
  const lastValidAnalysisRef = useRef<FunctionAnalysisResult>(analyzeQuadratic(1, -4, 3));
  const [activeRightTab, setActiveRightTab] = useState<RightTabId>("bbt");

  // Toggles
  const [showExtrema, setShowExtrema] = useState(true);
  const [showAsymptotes, setShowAsymptotes] = useState(true);
  const [showSymmetry, setShowSymmetry] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    if (!isFullScreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullScreen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullScreen]);

  const nav = useCanvas2DPanZoom({
    defaultOriginX: 320,
    defaultOriginY: 215,
    defaultScale: 32,
    width: VB_W,
    height: VB_H,
  });

  // Calculate analysis result
  const analysis: FunctionAnalysisResult = useMemo(() => {
    const parsed = parseFormulaToAnalysis(customLatex);
    if (parsed) {
      lastValidAnalysisRef.current = parsed;
      return parsed;
    }
    return lastValidAnalysisRef.current;
  }, [customLatex]);

  // Compute curve path
  const curvePath = useMemo(() => {
    return buildDiscontinuousFnPath(
      analysis.fn,
      nav.xMin,
      nav.xMax,
      nav.toPxX,
      nav.toPxY,
      analysis.discontinuities,
      Math.max(0.015, 1.2 / nav.scale)
    );
  }, [analysis.fn, analysis.discontinuities, nav.xMin, nav.xMax, nav.toPxX, nav.toPxY, nav.scale]);

  const [bbtDownloadSuccess, setBbtDownloadSuccess] = useState(false);

  const handleDownloadBBT = useCallback(() => {
    const bbt = getBBTData(analysis.bbtData, analysis.bbtColumns);
    if (bbt.points.length >= 2) {
      exportBBTToPng(bbt, `bang-bien-thien-${Date.now()}`);
      setBbtDownloadSuccess(true);
      setTimeout(() => setBbtDownloadSuccess(false), 2500);
    }
  }, [analysis.bbtData, analysis.bbtColumns]);

  return (
    <div id="module-function" className="flex flex-col xl:flex-row gap-3 w-full items-start">
      {/* ============================================================
          1. CỬA SỔ BÊN TRÁI: KHU VỰC ĐIỀU KHIỂN (CHIẾM 15% DIỆN TÍCH)
          ============================================================ */}
      <div id="window-function-controls" className="w-full xl:w-[calc(15%-8px)] 2xl:w-[calc(15%-8px)] shrink-0 flex flex-col gap-3">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xs p-3 shadow-sm flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-tight font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-indigo-500 rounded-2xs inline-block"></span>
              BẢNG ĐIỀU KHIỂN
            </span>
            <span className="text-[9px] bg-slate-800 text-amber-400 px-1.5 py-0.5 rounded font-mono border border-slate-700/60 font-bold">
              15% VIEW
            </span>
          </div>

          {/* NHẬP HÀM SỐ */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between bg-slate-950 px-2.5 py-1.5 rounded-2xs border border-amber-500/40 shadow-xs mb-1">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <span className="w-1.5 h-2.5 bg-amber-400 rounded-3xs inline-block"></span>
                NHẬP HÀM SỐ
              </span>
              <span className="text-[8.5px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                f(x)
              </span>
            </div>

            <div>
              <div className="text-[9.5px] text-slate-400 font-mono mb-1">
                Nhập công thức f(x) bất kỳ:
              </div>
              <input
                type="text"
                id="input-function-formula"
                value={customLatex}
                onChange={(e) => setCustomLatex(e.target.value)}
                placeholder="VD: x^2 - 4x + 3, \frac{2x+1}{x-1}..."
                className="w-full bg-slate-950 border border-slate-700 rounded-2xs px-2 py-1.5 text-xs font-mono text-amber-300 outline-none focus:border-amber-500 shadow-inner"
              />
            </div>
          </div>

          {/* Visual Display Toggles */}
          <div className="border-t border-slate-800 mt-3 pt-3 space-y-1.5">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1 font-mono">
              TÙY CHỌN HIỂN THỊ:
            </div>
            <label className="flex items-center justify-between text-[10.5px] font-mono text-slate-300 cursor-pointer bg-slate-950/60 p-1.5 rounded-xs border border-slate-800/80">
              <span>Điểm Cực trị / Đỉnh</span>
              <input
                type="checkbox"
                checked={showExtrema}
                onChange={(e) => setShowExtrema(e.target.checked)}
                className="rounded accent-emerald-500 cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between text-[10.5px] font-mono text-slate-300 cursor-pointer bg-slate-950/60 p-1.5 rounded-xs border border-slate-800/80">
              <span>Đường tiệm cận</span>
              <input
                type="checkbox"
                checked={showAsymptotes}
                onChange={(e) => setShowAsymptotes(e.target.checked)}
                className="rounded accent-cyan-500 cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between text-[10.5px] font-mono text-slate-300 cursor-pointer bg-slate-950/60 p-1.5 rounded-xs border border-slate-800/80">
              <span>Trục / Tâm đối xứng</span>
              <input
                type="checkbox"
                checked={showSymmetry}
                onChange={(e) => setShowSymmetry(e.target.checked)}
                className="rounded accent-purple-500 cursor-pointer"
              />
            </label>
          </div>
        </div>
      </div>

      {/* ============================================================
          2. CỬA SỔ TRUNG TÂM: HIỂN THỊ ĐỒ THỊ, MÔ HÌNH (40% DIỆN TÍCH)
          ============================================================ */}
      <div id="window-function-center-graph" className="w-full xl:w-[calc(40%-8px)] 2xl:w-[calc(40%-8px)] shrink-0 flex flex-col gap-3">
        {/* 1. 2D Coordinate Graph with Extrema & Asymptote Visuals */}
        <div
          id="function-cartesian-panel"
          className={`${
            isFullScreen
              ? "fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md p-3 sm:p-4 flex flex-col w-screen h-screen overflow-hidden shadow-2xl animate-in fade-in duration-150"
              : "bg-slate-900/60 border border-slate-800 rounded-xs overflow-hidden shadow-sm flex flex-col"
          }`}
        >
          <div className="h-8 bg-slate-900/90 border-b border-slate-800/80 px-3 flex items-center justify-between shrink-0 text-xs select-none">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-3 bg-emerald-500 rounded-2xs inline-block"></span>
              <span className="font-bold text-slate-200 uppercase tracking-tight text-[11px] font-mono">
                MẶT PHẲNG TOẠ ĐỘ OXY // CARTESIAN_VIEW
              </span>
              <span className="text-[9px] bg-slate-800 text-amber-400 border border-slate-700/60 px-1 py-0.2 rounded font-mono">
                {analysis.fnType.toUpperCase()}
              </span>
              {isFullScreen && (
                <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-mono font-bold">
                  FULLSCREEN
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 mr-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                LIVE GRAPH
              </div>
              <button
                type="button"
                id="btn-function-graph-download"
                onClick={() => {
                  downloadSvgAsPng(nav.bind.ref.current, `do-thi-ham-so-${analysis.fnType}-${Date.now()}`, 2, "#ffffff");
                }}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-2xs text-[10px] font-mono border transition-all cursor-pointer active:scale-95 bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700/80 hover:text-white"
                title="Tải xuống hình ảnh đồ thị hàm số PNG"
              >
                <Download className="w-3 h-3 text-emerald-400" />
                <span>TẢI ĐỒ THỊ (PNG)</span>
              </button>
              <button
                type="button"
                id="btn-function-graph-fullscreen"
                onClick={() => setIsFullScreen((f) => !f)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-2xs text-[10px] font-mono border transition-all cursor-pointer active:scale-95 ${
                  isFullScreen
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/60 hover:bg-amber-500/30"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700/80 hover:text-white"
                }`}
                title={isFullScreen ? "Thu nhỏ lại (Phím ESC)" : "Xem toàn màn hình đồ thị"}
              >
                {isFullScreen ? (
                  <>
                    <Minimize2 className="w-3 h-3 text-amber-400" />
                    <span>THU NHỎ (ESC)</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3 h-3 text-cyan-400" />
                    <span>TOÀN MÀN HÌNH</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className={`p-2 ${isFullScreen ? "flex-1 flex flex-col min-h-0 h-full p-2 sm:p-3" : ""}`}>
            <div className={`relative bg-white border-2 border-black rounded-xs shadow-sm overflow-hidden select-none ${isFullScreen ? "flex-1 h-full flex flex-col min-h-0" : ""}`}>
              <Canvas2DNavHUD
                scale={nav.scale}
                defaultScale={nav.defaultScale}
                onZoomIn={nav.zoomIn}
                onZoomOut={nav.zoomOut}
                onReset={nav.resetView}
                origin={nav.origin}
              />

              <svg
                {...nav.bind}
                viewBox={`0 0 ${VB_W} ${VB_H}`}
                className={`w-full ${isFullScreen ? "flex-1 h-full max-h-[calc(100vh-140px)]" : "h-auto"} block touch-none ${nav.isPanning ? "cursor-grabbing" : "cursor-grab"}`}
              >
                {/* Nền đồ thị màu trắng */}
                <rect width={VB_W} height={VB_H} fill="#ffffff" />

                {/* Trục toạ độ Oxy & Vạch chia: màu đen, độ dày 2 */}
                <GraphGrid originX={nav.origin.x} originY={nav.origin.y} scale={nav.scale} width={VB_W} height={VB_H} />

                {/* Vertical Asymptote Line */}
                {showAsymptotes && analysis.asymptotes?.vertical && (
                  <g>
                    <line
                      x1={nav.toPxX(analysis.asymptotes.vertical.x)}
                      y1={0}
                      x2={nav.toPxX(analysis.asymptotes.vertical.x)}
                      y2={VB_H}
                      stroke="#000000"
                      strokeWidth="1.5"
                      strokeDasharray="5 3"
                    />
                    <text
                      x={nav.toPxX(analysis.asymptotes.vertical.x) + 5}
                      y={20}
                      fill="#000000"
                      fontSize="10"
                      fontFamily={MONO_STACK}
                      fontWeight="bold"
                    >
                      TCĐ: {analysis.asymptotes.vertical.eq}
                    </text>
                  </g>
                )}

                {/* Horizontal Asymptote Line */}
                {showAsymptotes && analysis.asymptotes?.horizontal && (
                  <g>
                    <line
                      x1={0}
                      y1={nav.toPxY(analysis.asymptotes.horizontal.y)}
                      x2={VB_W}
                      y2={nav.toPxY(analysis.asymptotes.horizontal.y)}
                      stroke="#000000"
                      strokeWidth="1.5"
                      strokeDasharray="5 3"
                    />
                    <text
                      x={15}
                      y={nav.toPxY(analysis.asymptotes.horizontal.y) - 6}
                      fill="#000000"
                      fontSize="10"
                      fontFamily={MONO_STACK}
                      fontWeight="bold"
                    >
                      TCN: {analysis.asymptotes.horizontal.eq}
                    </text>
                  </g>
                )}

                {/* Slant Asymptote Line */}
                {showAsymptotes && analysis.asymptotes?.slant && (
                  <g>
                    <line
                      x1={nav.toPxX(nav.xMin)}
                      y1={nav.toPxY(analysis.asymptotes.slant.m * nav.xMin + analysis.asymptotes.slant.c)}
                      x2={nav.toPxX(nav.xMax)}
                      y2={nav.toPxY(analysis.asymptotes.slant.m * nav.xMax + analysis.asymptotes.slant.c)}
                      stroke="#000000"
                      strokeWidth="1.5"
                      strokeDasharray="5 3"
                    />
                    <text
                      x={nav.toPxX(3)}
                      y={nav.toPxY(analysis.asymptotes.slant.m * 3 + analysis.asymptotes.slant.c) - 8}
                      fill="#000000"
                      fontSize="10"
                      fontFamily={MONO_STACK}
                      fontWeight="bold"
                    >
                      TCX: {analysis.asymptotes.slant.eq}
                    </text>
                  </g>
                )}

                {/* Axis of Symmetry (for Parabolas) */}
                {showSymmetry && analysis.symmetryAxis && analysis.extrema.length > 0 && (
                  <g>
                    <line
                      x1={nav.toPxX(analysis.extrema[0].x)}
                      y1={0}
                      x2={nav.toPxX(analysis.extrema[0].x)}
                      y2={VB_H}
                      stroke="#000000"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                      opacity="0.8"
                    />
                    <text
                      x={nav.toPxX(analysis.extrema[0].x) + 4}
                      y={VB_H - 12}
                      fill="#000000"
                      fontSize="9.5"
                      fontFamily={MONO_STACK}
                      fontWeight="bold"
                    >
                      Trục đ/x: x = {fmt(analysis.extrema[0].x)}
                    </text>
                  </g>
                )}

                {/* Function Graph Curve: màu đen, độ dày 2 đồng nhất với trục toạ độ */}
                <path d={curvePath} stroke="#000000" strokeWidth="2" fill="none" strokeLinejoin="round" />

                {/* Extrema / Vertex Points: màu đen, chữ màu đen */}
                {showExtrema &&
                  analysis.extrema.map((pt, idx) => {
                    const px = nav.toPxX(pt.x);
                    const py = nav.toPxY(pt.y);
                    const isOutside = px < -20 || px > VB_W + 20 || py < -20 || py > VB_H + 20;
                    if (isOutside) return null;
                    return (
                      <g key={idx}>
                        <circle cx={px} cy={py} r="4.5" fill="#000000" stroke="#ffffff" strokeWidth="1.5" />
                        <text
                          x={px + 7}
                          y={py - 6}
                          fill="#000000"
                          fontSize="10"
                          fontFamily={MONO_STACK}
                          fontWeight="bold"
                        >
                          {pt.label}
                        </text>
                      </g>
                    );
                  })}

                {/* Inflection Point / Center of Symmetry: màu đen, chữ màu đen */}
                {showSymmetry && analysis.inflectionPoint && (
                  <g>
                    <circle
                      cx={nav.toPxX(analysis.inflectionPoint.x)}
                      cy={nav.toPxY(analysis.inflectionPoint.y)}
                      r="4.5"
                      fill="#000000"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <text
                      x={nav.toPxX(analysis.inflectionPoint.x) + 6}
                      y={nav.toPxY(analysis.inflectionPoint.y) + 12}
                      fill="#000000"
                      fontSize="9.5"
                      fontFamily={MONO_STACK}
                      fontWeight="bold"
                    >
                      {analysis.inflectionPoint.label}
                    </text>
                  </g>
                )}
              </svg>

              <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between font-mono text-[9px] text-slate-700 pointer-events-none">
                <span className="bg-white/95 border border-black px-2 py-0.5 rounded-2xs text-black font-bold shadow-xs">
                  y = f(x)
                </span>
                <span className="bg-white/90 backdrop-blur-xs border border-slate-300 px-2 py-0.5 rounded-2xs text-slate-700 shadow-xs">
                  💡 Cuộn chuột để Zoom · Nhấn giữ chuột để Di chuyển gốc toạ độ
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          3. CỬA SỔ BÊN PHẢI: CÁC THÔNG TIN LIÊN QUAN (45% DIỆN TÍCH)
          ============================================================ */}
      <div id="window-function-right-info" className="w-full xl:w-[calc(45%-8px)] 2xl:w-[calc(45%-8px)] shrink-0 flex flex-col gap-3">
        {/* 2. Textbook Math Formula Header (Compact Height & Proportional Font Size) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xs px-3 py-2 font-mono shadow-sm">
          <div className="flex items-center justify-between text-[9px] text-slate-400 uppercase tracking-wider border-b border-slate-800/80 pb-1 mb-1">
            <span className="text-emerald-400 font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
              CÔNG THỨC HÀM SỐ f(x) (CHUẨN SÁCH GIÁO KHOA GDPT 2018)
            </span>
            <span className="text-slate-400 text-[9px]">TẬP XÁC ĐỊNH: <MathDisplay tex={analysis.domain} inline /></span>
          </div>
          <div className="text-center py-1 text-emerald-300 text-[16px] md:text-[17px] font-sans tracking-normal leading-tight [&_.katex-display]:my-0 [&_.katex]:text-[16px] md:[&_.katex]:text-[17px]">
            <MathDisplay tex={`y = f(x) = ${analysis.formulaTex}`} inline />
          </div>
        </div>

        {/* 3. DANH SÁCH LỰA CHỌN THEO HÀNG NGANG */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xs p-1.5 shadow-sm font-mono">
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar scroll-smooth">
            {RIGHT_TABS.map((tab, idx) => {
              const isActive = activeRightTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  id={`tab-${tab.id}`}
                  onClick={() => setActiveRightTab(tab.id)}
                  className={`whitespace-nowrap px-2.5 py-1.5 text-[10.5px] font-mono font-bold rounded-2xs border transition-all cursor-pointer select-none flex items-center gap-1.5 ${
                    isActive
                      ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-xs"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 hover:bg-slate-900"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-amber-400" : "bg-slate-600"}`}></span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. HỘP HIỂN THỊ NỘI DUNG THEO ĐỐI TƯỢNG ĐƯỢC CHỌN */}
        {/* ĐỐI TƯỢNG 1: BẢNG BIẾN THIÊN */}
        {activeRightTab === "bbt" && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xs p-3 shadow-sm font-mono">
            <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1.5 mb-2 font-bold">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-amber-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-2.5 bg-amber-500 rounded-3xs inline-block"></span>
                  BẢNG BIẾN THIÊN CỦA HÀM SỐ
                </span>
                <button
                  type="button"
                  id="btn-download-bbt-png"
                  onClick={handleDownloadBBT}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-xs border transition-all cursor-pointer text-[9.5px] font-bold active:scale-95 shadow-xs ${
                    bbtDownloadSuccess
                      ? "bg-emerald-600 text-white border-emerald-700"
                      : "bg-black hover:bg-slate-800 text-cyan-300 border-slate-700 hover:text-white"
                  }`}
                  title="Tải xuống hình ảnh bảng biến thiên định dạng PNG (.png)"
                >
                  {bbtDownloadSuccess ? (
                    <>
                      <Check className="w-3 h-3 text-white" />
                      <span>ĐÃ TẢI XONG (.PNG)</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3 h-3 text-cyan-400" />
                      <span>TẢI ẢNH BBT</span>
                    </>
                  )}
                </button>
              </div>
              <span className="text-slate-500 text-[9px]">GDPT 2018</span>
            </div>
            <VariationTable data={analysis.bbtData} columns={analysis.bbtColumns} discontinuities={analysis.discontinuities} />
          </div>
        )}

        {/* ĐỐI TƯỢNG 2: ĐẠO HÀM */}
        {activeRightTab === "derivative" && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xs p-4 shadow-sm font-mono space-y-3">
            <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1.5 font-bold">
              <span className="text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-2.5 bg-emerald-500 rounded-3xs inline-block"></span>
                ĐẠO HÀM f'(x) & NGHIỆM PHƯƠNG TRÌNH f'(x) = 0
              </span>
              <span className="text-slate-500 text-[9px]">ĐẠO HÀM</span>
            </div>

            <div className="bg-slate-950/80 border border-slate-800/90 p-3.5 rounded-xs space-y-3">
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1 text-emerald-400">
                  • ĐẠO HÀM BẬC NHẤT:
                </div>
                <div className="text-emerald-300 text-base md:text-lg pl-3 py-1 font-sans">
                  <MathDisplay tex={`f'(x) = ${analysis.derivativeTex}`} inline />
                </div>
              </div>

              <div className="border-t border-slate-800/80 pt-3">
                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1.5 text-amber-400">
                  • PHƯƠNG TRÌNH ĐẠO HÀM BẰNG 0:
                </div>
                <div className="text-slate-200 text-sm pl-3 py-0.5 font-sans">
                  <MathDisplay tex={`f'(x) = 0 \\iff ${analysis.derivativeTex} = 0`} inline />
                </div>

                <div className="mt-2.5 pl-3">
                  {analysis.derivativeRootsTex && analysis.derivativeRootsTex.length > 0 ? (
                    <div className="flex items-center flex-wrap gap-2 text-sm">
                      <span className="text-slate-400 font-sans text-xs">Nghiệm của f'(x) = 0:</span>
                      {analysis.derivativeRootsTex.map((r, i) => (
                        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-2xs bg-amber-500/15 border border-amber-500/40 text-amber-300 font-semibold font-mono text-xs shadow-2xs">
                          <MathDisplay tex={r} inline />
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-400 italic text-xs">
                      Phương trình <MathDisplay tex="f'(x) = 0" inline /> vô nghiệm (đạo hàm giữ nguyên dấu trên từng khoảng xác định).
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ĐỐI TƯỢNG 3: KHOẢNG BIẾN THIÊN */}
        {activeRightTab === "monotonicity" && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xs p-4 shadow-sm font-mono space-y-3">
            <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1.5 font-bold">
              <span className="text-cyan-400 flex items-center gap-1.5">
                <span className="w-1.5 h-2.5 bg-cyan-500 rounded-3xs inline-block"></span>
                KHOẢNG BIẾN THIÊN (ĐỒNG BIẾN & NGHỊCH BIẾN)
              </span>
              <span className="text-slate-500 text-[9px]">BIẾN THIÊN</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Đồng biến */}
              <div className="bg-slate-950/80 border border-slate-800/90 p-3.5 rounded-xs space-y-2">
                <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="text-base">↗</span> HÀM SỐ ĐỒNG BIẾN TRÊN:
                </div>
                <div className="pl-2">
                  {analysis.monotonicity.increasing.length > 0 ? (
                    <div className="space-y-1.5">
                      {analysis.monotonicity.increasing.map((intv, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                          <span className="text-emerald-300 font-bold text-sm bg-emerald-500/10 px-2.5 py-0.5 rounded-2xs border border-emerald-500/30 font-mono">
                            <MathDisplay tex={intv} inline />
                          </span>
                        </div>
                      ))}
                      <div className="text-[10px] text-slate-400 mt-2 italic">
                        (f'(x) ≥ 0 trên các khoảng này)
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-400 italic text-xs">Không có khoảng đồng biến.</div>
                  )}
                </div>
              </div>

              {/* Nghịch biến */}
              <div className="bg-slate-950/80 border border-slate-800/90 p-3.5 rounded-xs space-y-2">
                <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                  <span className="text-base">↘</span> HÀM SỐ NGHỊCH BIẾN TRÊN:
                </div>
                <div className="pl-2">
                  {analysis.monotonicity.decreasing.length > 0 ? (
                    <div className="space-y-1.5">
                      {analysis.monotonicity.decreasing.map((intv, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
                          <span className="text-amber-300 font-bold text-sm bg-amber-500/10 px-2.5 py-0.5 rounded-2xs border border-amber-500/30 font-mono">
                            <MathDisplay tex={intv} inline />
                          </span>
                        </div>
                      ))}
                      <div className="text-[10px] text-slate-400 mt-2 italic">
                        (f'(x) ≤ 0 trên các khoảng này)
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-400 italic text-xs">Không có khoảng nghịch biến.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ĐỐI TƯỢNG 4: CỰC TRỊ */}
        {activeRightTab === "extrema" && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xs p-4 shadow-sm font-mono space-y-3">
            <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1.5 font-bold">
              <span className="text-rose-400 flex items-center gap-1.5">
                <span className="w-1.5 h-2.5 bg-rose-500 rounded-3xs inline-block"></span>
                CỰC TRỊ (TỌA ĐỘ ĐIỂM CỰC TRỊ / ĐỈNH)
              </span>
              <span className="text-slate-500 text-[9px]">CỰC TRỊ</span>
            </div>

            {analysis.extrema.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {analysis.extrema.map((ex, idx) => {
                  const isCD = ex.type === "Cực đại";
                  return (
                    <div
                      key={idx}
                      className={`bg-slate-950/80 border p-3.5 rounded-xs space-y-2 ${
                        isCD ? "border-rose-500/40 shadow-xs" : "border-emerald-500/40 shadow-xs"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold uppercase tracking-wider ${isCD ? "text-rose-400" : "text-emerald-400"}`}>
                          • {ex.type}
                        </span>
                        <span className="text-[9.5px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                          Điểm {idx + 1}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-200">
                        <div>
                          <span className="text-slate-400">Điểm cực trị: </span>
                          <span className="text-amber-300 font-bold">
                            <MathDisplay tex={`x = ${fmtFrac(ex.x)}`} inline />
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Giá trị cực trị: </span>
                          <span className="text-emerald-300 font-bold">
                            <MathDisplay tex={`y = ${fmtFrac(ex.y)}`} inline />
                          </span>
                        </div>
                        <div className="pt-1.5 border-t border-slate-800/80">
                          <span className="text-slate-400">Điểm trên đồ thị: </span>
                          <span className="text-amber-300 font-bold text-sm">
                            <MathDisplay tex={`M(${fmtFrac(ex.x)}; ${fmtFrac(ex.y)})`} inline />
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-slate-950/80 border border-slate-800/90 p-4 rounded-xs text-slate-400 italic text-xs">
                Hàm số không có điểm cực trị (đạo hàm không đổi dấu hoặc hàm phân thức bậc nhất trên bậc nhất luôn đồng biến/nghịch biến trên từng khoảng xác định).
              </div>
            )}
          </div>
        )}

        {/* ĐỐI TƯỢNG 5: CÁC TIỆM CẬN */}
        {activeRightTab === "asymptotes" && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xs p-4 shadow-sm font-mono space-y-3">
            <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1.5 font-bold">
              <span className="text-purple-400 flex items-center gap-1.5">
                <span className="w-1.5 h-2.5 bg-purple-500 rounded-3xs inline-block"></span>
                CÁC TIỆM CẬN (ĐƯỜNG TIỆM CẬN / TÂM & TRỤC ĐỐI XỨNG)
              </span>
              <span className="text-slate-500 text-[9px]">CÁC TIỆM CẬN</span>
            </div>

            <div className="space-y-2.5">
              {/* Trục đối xứng */}
              {analysis.symmetryAxis && (
                <div className="bg-slate-950/80 border border-slate-800/90 p-3 rounded-xs flex items-center justify-between">
                  <div>
                    <span className="text-purple-300 font-bold text-xs">• Trục đối xứng của đồ thị:</span>
                    <div className="text-[10px] text-slate-400 mt-0.5">Đường thẳng thẳng đứng đi qua đỉnh hoặc trục tung</div>
                  </div>
                  <div className="text-emerald-300 font-bold text-sm bg-slate-900 px-3 py-1 rounded border border-slate-700">
                    <MathDisplay tex={analysis.symmetryAxis} inline />
                  </div>
                </div>
              )}

              {/* Tiệm cận đứng (TCĐ) */}
              {analysis.asymptotes?.vertical && (
                <div className="bg-slate-950/80 border border-slate-800/90 p-3 rounded-xs flex items-center justify-between">
                  <div>
                    <span className="text-cyan-400 font-bold text-xs">• Tiệm cận đứng (TCĐ):</span>
                    <div className="text-[10px] text-slate-400 mt-0.5">Nghiệm của mẫu số (nghiệm làm hàm số không xác định)</div>
                  </div>
                  <div className="text-cyan-300 font-bold text-sm bg-slate-900 px-3 py-1 rounded border border-slate-700">
                    <MathDisplay tex={analysis.asymptotes.vertical.eq} inline />
                  </div>
                </div>
              )}

              {/* Tiệm cận ngang (TCN) */}
              {analysis.asymptotes?.horizontal && (
                <div className="bg-slate-950/80 border border-slate-800/90 p-3 rounded-xs flex items-center justify-between">
                  <div>
                    <span className="text-cyan-400 font-bold text-xs">• Tiệm cận ngang (TCN):</span>
                    <div className="text-[10px] text-slate-400 mt-0.5">Giới hạn của f(x) khi x tiến ra ±∞</div>
                  </div>
                  <div className="text-cyan-300 font-bold text-sm bg-slate-900 px-3 py-1 rounded border border-slate-700">
                    <MathDisplay tex={analysis.asymptotes.horizontal.eq} inline />
                  </div>
                </div>
              )}

              {/* Tiệm cận xiên (TCX) */}
              {analysis.asymptotes?.slant && (
                <div className="bg-slate-950/80 border border-slate-800/90 p-3 rounded-xs flex items-center justify-between">
                  <div>
                    <span className="text-cyan-400 font-bold text-xs">• Tiệm cận xiên (TCX):</span>
                    <div className="text-[10px] text-slate-400 mt-0.5">Thương khi chia đa thức tử số cho mẫu số</div>
                  </div>
                  <div className="text-cyan-300 font-bold text-sm bg-slate-900 px-3 py-1 rounded border border-slate-700">
                    <MathDisplay tex={analysis.asymptotes.slant.eq} inline />
                  </div>
                </div>
              )}

              {/* Tâm đối xứng / Điểm uốn */}
              {analysis.inflectionPoint && (
                <div className="bg-slate-950/80 border border-slate-800/90 p-3 rounded-xs flex items-center justify-between">
                  <div>
                    <span className="text-purple-400 font-bold text-xs">• Tâm đối xứng / Điểm uốn:</span>
                    <div className="text-[10px] text-slate-400 mt-0.5">Giao điểm hai tiệm cận hoặc điểm uốn f''(x)=0</div>
                  </div>
                  <div className="text-amber-300 font-bold text-sm bg-slate-900 px-3 py-1 rounded border border-slate-700">
                    <MathDisplay
                      tex={`I(${fmtFrac(analysis.inflectionPoint.x)}; ${fmtFrac(analysis.inflectionPoint.y)})`}
                      inline
                    />
                  </div>
                </div>
              )}

              {/* Fallback nếu không có tiệm cận hay tâm đối xứng */}
              {!analysis.symmetryAxis &&
                !analysis.asymptotes?.vertical &&
                !analysis.asymptotes?.horizontal &&
                !analysis.asymptotes?.slant &&
                !analysis.inflectionPoint && (
                  <div className="bg-slate-950/80 border border-slate-800/90 p-4 rounded-xs text-slate-400 italic text-xs">
                    Đồ thị hàm số không có đường tiệm cận hay tâm đối xứng đặc biệt.
                  </div>
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
