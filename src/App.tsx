import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import * as THREE from "three";
import katex from "katex";
import { Maximize2, Minimize2, Download, Sun, Moon } from "lucide-react";
import { PolyhedraModule } from "./components/PolyhedraModule";
import { FunctionModule } from "./components/FunctionModule";
import { downloadSvgAsPng, downloadCanvas3D } from "./utils/exportImage";
import { useTheme, ThemeColors } from "./context/ThemeContext";

/* ============================================================
   DESIGN TOKENS — ADAPTIVE CONSOLE THEME (DARK / LIGHT)
   Deep Slate-950 or Clean Slate-50 panels, Emerald/Amber/Cyan accents,
   dense monospace telemetry and crisp 1px borders.
   ============================================================ */
let activeThemeColors: ThemeColors | null = null;
export function setGlobalThemeColors(c: ThemeColors) {
  activeThemeColors = c;
}

const COLORS = {
  get bg() { return activeThemeColors ? activeThemeColors.bg : "#020617"; },
  get panel() { return activeThemeColors ? activeThemeColors.panel : "rgba(15, 23, 42, 0.65)"; },
  get panelSolid() { return activeThemeColors ? activeThemeColors.panelSolid : "#0f172a"; },
  get panelHeader() { return activeThemeColors ? activeThemeColors.panelHeader : "rgba(15, 23, 42, 0.9)"; },
  get panelSub() { return activeThemeColors ? activeThemeColors.panelSub : "#020617"; },
  get border() { return activeThemeColors ? activeThemeColors.border : "#1e293b"; },
  get borderLight() { return activeThemeColors ? activeThemeColors.borderLight : "#334155"; },
  get text() { return activeThemeColors ? activeThemeColors.text : "#f8fafc"; },
  get textSecondary() { return activeThemeColors ? activeThemeColors.textSecondary : "#cbd5e1"; },
  get textMuted() { return activeThemeColors ? activeThemeColors.textMuted : "#94a3b8"; },
  get textFaint() { return activeThemeColors ? activeThemeColors.textFaint : "#64748b"; },
  get emerald() { return activeThemeColors ? activeThemeColors.emerald : "#10b981"; },
  get emeraldGlow() { return "rgba(16, 185, 129, 0.4)"; },
  get amber() { return activeThemeColors ? activeThemeColors.amber : "#f59e0b"; },
  get amberGlow() { return "rgba(245, 158, 11, 0.35)"; },
  get cyan() { return activeThemeColors ? activeThemeColors.cyan : "#06b6d4"; },
  get indigo() { return activeThemeColors ? activeThemeColors.indigo : "#6366f1"; },
  get rose() { return activeThemeColors ? activeThemeColors.rose : "#f43f5e"; },
  get grid() { return activeThemeColors ? activeThemeColors.grid : "rgba(51, 65, 85, 0.35)"; },
  get gridStrong() { return activeThemeColors ? activeThemeColors.gridStrong : "rgba(71, 85, 105, 0.65)"; },
};

const MONO_STACK = `'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace`;
const SANS_STACK = `'Space Grotesk', system-ui, sans-serif`;

function fmt(n: number, d = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(d);
}

function signStr(v: number): string {
  return v >= 0 ? "+" : "-";
}

/* ============================================================
   KATEX MATH DISPLAY & LATEX EXPRESSION EVALUATOR
   Renders textbook-grade mathematical typography (GDPT 2018)
   ============================================================ */
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

/** Chuyển đổi công thức LaTeX hoặc biểu thức đại số sang hàm JavaScript f(x) */
function parseMathOrLatexToFunction(expr: string): ((x: number) => number) | null {
  if (!expr || !expr.trim()) return null;
  try {
    let clean = expr.trim();

    // 1. Chuẩn hoá các dạng luỹ thừa x^2, x^3
    clean = clean.replace(/\\left\(/g, "(").replace(/\\right\)/g, ")");
    clean = clean.replace(/\\left\[/g, "(").replace(/\\right\]/g, ")");

    // 2. Chuyển phân số \frac{a}{b} hoặc \dfrac{a}{b}
    let prev = "";
    while (clean !== prev) {
      prev = clean;
      clean = clean.replace(/\\d?frac\{([^{}]+)\}\{([^{}]+)\}/g, "(( $1 ) / ( $2 ))");
    }

    // 3. Chuyển hàm lượng giác & hàm toán học LaTeX
    clean = clean.replace(/\\sin\b/g, "sin");
    clean = clean.replace(/\\cos\b/g, "cos");
    clean = clean.replace(/\\tan\b/g, "tan");
    clean = clean.replace(/\\cot\b/g, "(1/tan)");
    clean = clean.replace(/\\sqrt\{([^{}]+)\}/g, "sqrt( $1 )");
    clean = clean.replace(/\\sqrt/g, "sqrt");
    clean = clean.replace(/\\ln\b/g, "log");
    clean = clean.replace(/\\log\b/g, "log10");
    clean = clean.replace(/\\exp\b/g, "exp");
    clean = clean.replace(/\\pi\b/g, "PI");
    clean = clean.replace(/\\cdot/g, "*");
    clean = clean.replace(/\\times/g, "*");
    clean = clean.replace(/\{/g, "(").replace(/\}/g, ")");

    // 4. Thay thế dấu mũ ^ thành **
    clean = clean.replace(/\^/g, "**");

    // 5. Thêm Math. vào trước hàm
    clean = clean.replace(/\bsin\b/g, "Math.sin");
    clean = clean.replace(/\bcos\b/g, "Math.cos");
    clean = clean.replace(/\btan\b/g, "Math.tan");
    clean = clean.replace(/\bsqrt\b/g, "Math.sqrt");
    clean = clean.replace(/\blog10\b/g, "Math.log10");
    clean = clean.replace(/\blog\b/g, "Math.log");
    clean = clean.replace(/\bexp\b/g, "Math.exp");
    clean = clean.replace(/\bPI\b/g, "Math.PI");
    clean = clean.replace(/\babs\b/g, "Math.abs");

    // 6. Xử lý phép nhân ẩn (Implicit Multiplication)
    clean = clean.replace(/(\d)\s*x\b/gi, "$1*x");
    clean = clean.replace(/(\d)\s*(Math\.[a-z]+|\()/gi, "$1*$2");
    clean = clean.replace(/\bx\s*(Math\.[a-z]+|\()/gi, "x*$1");
    clean = clean.replace(/\)\s*x\b/gi, ")*x");
    clean = clean.replace(/\)\s*\(/g, ")*(");
    clean = clean.replace(/\)\s*(\d)/g, ")*$1");
    clean = clean.replace(/(\d)\s*\(/g, "$1*(");

    const fn = new Function("x", `"use strict"; try { return Number(${clean}); } catch (e) { return NaN; }`) as (x: number) => number;
    const testVal = fn(1);
    if (typeof testVal !== "number") return null;
    return fn;
  } catch {
    return null;
  }
}

/* ============================================================
   ICONS (HIGH DENSITY HUD-STYLE)
   ============================================================ */
interface IconProps extends React.SVGProps<SVGSVGElement> {}

const Icon = {
  Curve: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M2 19c3-1 4-13 7-13s3 11 6 11 3-7 7-7" strokeLinecap="round" />
    </svg>
  ),
  Circle: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 12 L17.5 8" strokeLinecap="round" />
      <circle cx="17.5" cy="8" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  Vector: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <line x1="4" y1="20" x2="18" y2="6" strokeLinecap="round" />
      <path d="M10.5 6 H18 V13.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Tangent: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M3 19c3-1 4-13 8-13s3 9 10-1" strokeLinecap="round" />
      <line x1="2" y1="17" x2="20" y2="5" strokeLinecap="round" opacity="0.6" />
      <circle cx="10.2" cy="10.6" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  Integral: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M4 18 C4 12 6 6 12 6 C18 6 15 18 21 18" strokeLinecap="round" opacity="0.6" />
      <path d="M6 18 L6 13 C8 8 15 8 16 12 L16 18 Z" fill="currentColor" stroke="none" opacity="0.3" />
      <line x1="4" y1="18" x2="21" y2="18" strokeLinecap="round" />
    </svg>
  ),
  Cone: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M12 3 L20 18 A9 3.4 0 0 1 4 18 Z" />
      <ellipse cx="12" cy="18" rx="8" ry="3" />
    </svg>
  ),
  Cube: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M12 3 L21 7.5 L21 16.5 L12 21 L3 16.5 L3 7.5 Z" />
      <path d="M3 7.5 L12 12 L21 7.5" />
      <path d="M12 12 L12 21" />
    </svg>
  ),
};

/* ============================================================
   HIGH DENSITY UI PRIMITIVES
   ============================================================ */
function Panel({
  children,
  style,
  id,
  title,
  badge,
  action,
  isFullScreen,
  onToggleFullScreen,
  onDownloadImage,
  downloadLabel,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  id?: string;
  title?: string;
  badge?: string;
  action?: React.ReactNode;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  onDownloadImage?: () => void;
  downloadLabel?: string;
}) {
  return (
    <div
      id={id}
      className={`${
        isFullScreen
          ? "fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md p-3 sm:p-4 flex flex-col w-screen h-screen overflow-hidden shadow-2xl animate-in fade-in duration-150"
          : "bg-slate-900/60 border border-slate-800 rounded-xs overflow-hidden flex flex-col shadow-sm"
      }`}
      style={style}
    >
      {title && (
        <div className="h-8 bg-slate-900/90 border-b border-slate-800/80 px-3 flex items-center justify-between shrink-0 text-xs select-none">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-3 bg-emerald-500 rounded-2xs inline-block"></span>
            <span className="font-bold text-slate-200 uppercase tracking-tight text-[11px] font-mono">{title}</span>
            {badge && (
              <span className="text-[9px] bg-slate-800 text-slate-400 border border-slate-700/60 px-1 py-0.2 rounded font-mono">
                {badge}
              </span>
            )}
            {isFullScreen && (
              <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-mono font-bold">
                FULLSCREEN
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {action && <div className="text-[10px] text-slate-400 font-mono">{action}</div>}
            {onDownloadImage && (
              <button
                type="button"
                id={id ? `${id}-download-btn` : undefined}
                onClick={onDownloadImage}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-2xs text-[10px] font-mono border transition-all cursor-pointer active:scale-95 bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700/80 hover:text-white"
                title="Tải xuống hình ảnh định dạng PNG độ phân giải cao"
              >
                <Download className="w-3 h-3 text-emerald-400" />
                <span>{downloadLabel || "TẢI ẢNH (PNG)"}</span>
              </button>
            )}
            {onToggleFullScreen && (
              <button
                type="button"
                id={id ? `${id}-fullscreen-btn` : undefined}
                onClick={onToggleFullScreen}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-2xs text-[10px] font-mono border transition-all cursor-pointer active:scale-95 ${
                  isFullScreen
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/60 hover:bg-amber-500/30"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700/80 hover:text-white"
                }`}
                title={isFullScreen ? "Thu nhỏ lại (Phím ESC)" : "Xem toàn màn hình cửa sổ trung tâm"}
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
            )}
          </div>
        </div>
      )}
      <div className={`p-3 flex-1 ${isFullScreen ? "flex flex-col min-h-0 h-full p-2 sm:p-3" : ""}`}>{children}</div>
    </div>
  );
}

function SectionLabel({ children, iconColor = "bg-indigo-500" }: { children: React.ReactNode; iconColor?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-mono">
      <span className={`w-1 h-2.5 ${iconColor} rounded-3xs inline-block`}></span>
      <span>{children}</span>
    </div>
  );
}

function TheoryBox({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <div
      id={id}
      className="border-l-2 border-emerald-500 bg-slate-900/70 border-y border-r border-slate-800/90 p-3 mb-3 text-xs leading-relaxed text-slate-300 font-mono"
    >
      <div className="flex items-center justify-between mb-1.5 text-[10px] text-emerald-400 uppercase tracking-wider font-bold">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
          KIẾN THỨC TRỌNG TÂM // CHUẨN GDPT 2018
        </span>
        <span className="text-slate-500 text-[9px] bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/50">
          DOC_REF #THPT-MATH
        </span>
      </div>
      <div className="text-slate-300 text-[12px] leading-relaxed font-sans">{children}</div>
    </div>
  );
}

interface NumberInputProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
  unit?: string;
  id?: string;
  color?: "emerald" | "amber" | "cyan" | "rose";
  precision?: number;
  quickOptions?: number[];
  display?: string;
  className?: string;
}

function NumberInput({
  label,
  value,
  min,
  max,
  step = 0.1,
  onChange,
  unit,
  id,
  color = "amber",
  precision = 2,
  quickOptions,
  className,
}: NumberInputProps) {
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
      : "text-amber-300 border-amber-500/40 focus:border-amber-400";

  return (
    <div
      id={id ? `${id}-container` : undefined}
      className={`${className ?? "mb-2.5"} bg-slate-950/60 border border-slate-800/80 p-2 rounded-xs`}
    >
      <div className="flex justify-between items-center mb-1 gap-2 font-mono">
        <span className="text-[11px] text-slate-300 uppercase tracking-tight font-medium truncate">{label}</span>
        {unit && <span className="text-[10px] text-slate-400 font-mono">{unit}</span>}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => stepChange(-step)}
          className="w-7 h-7 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 rounded-2xs font-mono text-sm flex items-center justify-center transition-colors active:scale-95 shrink-0"
          title={`Giảm ${step}`}
        >
          −
        </button>
        <input
          id={id}
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
          className="w-7 h-7 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 rounded-2xs font-mono text-sm flex items-center justify-center transition-colors active:scale-95 shrink-0"
          title={`Tăng ${step}`}
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
              className={`px-1.5 py-0.2 rounded-2xs text-[9px] font-mono border transition-colors ${
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

// Backward-compatible Slider wrapper mapped to NumberInput
function Slider(props: NumberInputProps) {
  return <NumberInput {...props} />;
}

interface LatexFunctionInputProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (latex: string) => void;
  presets?: { label: string; latex: string }[];
  hideSymbols?: boolean;
  hidePresets?: boolean;
}

function LatexFunctionInput({
  id = "latex-fn-input",
  label = "BIỂU THỨC HÀM SỐ f(x) (NHẬP LATEX / TOÁN HỌC)",
  value,
  onChange,
  presets = [
    { label: "x² − 2x − 1", latex: "x^2 - 2x - 1" },
    { label: "−x² + 4", latex: "-x^2 + 4" },
    { label: "x³ − 3x", latex: "x^3 - 3x" },
    { label: "2sin(x)", latex: "2\\sin(x)" },
    { label: "cos(2x)", latex: "\\cos(2x)" },
    { label: "½x² − 2", latex: "\\frac{1}{2}x^2 - 2" },
  ],
  hideSymbols = false,
  hidePresets = false,
}: LatexFunctionInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const insertSymbol = (sym: string) => {
    const input = inputRef.current;
    if (!input) {
      onChange(value + sym);
      return;
    }
    const start = input.selectionStart || value.length;
    const end = input.selectionEnd || value.length;
    const next = value.substring(0, start) + sym + value.substring(end);
    onChange(next);
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + sym.length, start + sym.length);
    }, 10);
  };

  const parsedFn = useMemo(() => parseMathOrLatexToFunction(value), [value]);
  const isValid = parsedFn !== null;

  return (
    <div id={id} className="mb-3 bg-slate-950/70 border border-slate-800/90 p-2.5 rounded-xs">
      <div className="flex items-center justify-between mb-1.5 font-mono">
        <span className="text-[11px] font-bold text-slate-200 uppercase tracking-tight flex items-center gap-1.5">
          <span className="w-1.5 h-2.5 bg-emerald-500 rounded-3xs inline-block"></span>
          {label}
        </span>
        <span
          className={`text-[9px] px-1.5 py-0.2 rounded font-mono border ${
            isValid
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
          }`}
        >
          {isValid ? "CÚ PHÁP HỢP LỆ" : "KIỂM TRA CÚ PHÁP"}
        </span>
      </div>

      {/* Input box */}
      <div className="relative mb-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nhập công thức (VD: x^2 - 2x + 1, \sin(2x), x^3 - 3x...)"
          className="w-full bg-slate-900 border border-slate-700/90 rounded-2xs px-2.5 py-1.5 text-xs font-mono text-amber-300 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40"
        />
      </div>

      {/* Math symbol insertion toolbar */}
      {!hideSymbols && (
        <div className="flex gap-1 flex-wrap mb-2">
          <span className="text-[9px] text-slate-400 font-mono self-center mr-1">Ký tự:</span>
          {[
            { label: "x²", sym: "x^2" },
            { label: "x³", sym: "x^3" },
            { label: "xⁿ", sym: "^" },
            { label: "½", sym: "\\frac{1}{2}" },
            { label: "⅓", sym: "\\frac{1}{3}" },
            { label: "\\frac{a}{b}", sym: "\\frac{a}{b}" },
            { label: "\\sin", sym: "\\sin(x)" },
            { label: "\\cos", sym: "\\cos(x)" },
            { label: "\\tan", sym: "\\tan(x)" },
            { label: "\\sqrt{x}", sym: "\\sqrt{x}" },
            { label: "π", sym: "\\pi" },
            { label: "+", sym: " + " },
            { label: "−", sym: " - " },
          ].map((btn, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => insertSymbol(btn.sym)}
              className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 rounded-2xs text-[10px] font-mono transition-colors active:scale-95"
              title={`Chèn ${btn.sym}`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}

      {/* Real-time Textbook Grade KaTeX Render */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xs p-2 text-center my-1.5 flex flex-col items-center justify-center min-h-[46px] shadow-inner">
        <div className="text-[9px] text-slate-400 uppercase tracking-widest font-mono mb-1">
          HIỂN THỊ CHUẨN SÁCH GIÁO KHOA
        </div>
        <div className="text-emerald-300 text-sm font-sans tracking-wide">
          <MathDisplay tex={`f(x) = ${value || "0"}`} />
        </div>
      </div>

      {/* Preset Textbook Functions */}
      {!hidePresets && presets && presets.length > 0 && (
        <div className="mt-2 pt-1.5 border-t border-slate-800/80">
          <div className="text-[9px] text-slate-400 font-mono mb-1">CÁC HÀM MẪU SÁCH GIÁO KHOA:</div>
          <div className="flex gap-1 flex-wrap">
            {presets.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onChange(p.latex)}
                className={`text-[10px] px-2 py-0.5 rounded-2xs border transition-all font-mono ${
                  value === p.latex
                    ? "bg-amber-500/20 border-amber-500 text-amber-300 font-bold"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  id,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
}) {
  return (
    <label
      id={id}
      className="flex items-center justify-between p-2 bg-slate-950/50 border border-slate-800/60 rounded-xs cursor-pointer mb-3 text-xs text-slate-200 select-none hover:bg-slate-900/60 transition-colors font-mono"
    >
      <span className="text-[11px] text-slate-300">{label}</span>
      <div
        onClick={() => onChange(!checked)}
        className={`w-8 h-4 rounded-full relative transition-colors cursor-pointer ${
          checked ? "bg-emerald-500" : "bg-slate-800 border border-slate-700"
        }`}
      >
        <span
          className={`absolute top-0.5 w-3 h-3 rounded-full bg-slate-950 transition-all ${
            checked ? "left-4.5 bg-slate-950 shadow-sm" : "left-0.5 bg-slate-400"
          }`}
        />
      </div>
    </label>
  );
}

interface Option<T> {
  value: T;
  label: string;
}

function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  id,
}: {
  options: Option<T>[];
  value: T;
  onChange: (val: T) => void;
  id?: string;
}) {
  return (
    <div id={id} className="flex gap-1.5 flex-wrap mb-3">
      {options.map((o) => {
        const isSel = value === o.value;
        return (
          <button
            key={String(o.value)}
            id={id ? `${id}-opt-${String(o.value)}` : undefined}
            type="button"
            onClick={() => onChange(o.value)}
            className={`font-mono text-[11px] px-2.5 py-1 rounded-2xs border transition-all cursor-pointer ${
              isSel
                ? "bg-emerald-500/15 border-emerald-500/70 text-emerald-300 font-semibold shadow-[0_0_8px_rgba(16,185,129,0.15)]"
                : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Formula({ children, id, title = "CALC_MATRIX // OUTPUT" }: { children: React.ReactNode; id?: string; title?: string }) {
  return (
    <div
      id={id}
      className="text-[11px] bg-slate-950/90 border border-slate-800 rounded-xs p-2.5 text-slate-300 leading-relaxed shadow-inner font-mono"
    >
      <div className="flex items-center justify-between text-[9px] text-slate-500 uppercase tracking-widest border-b border-slate-900 pb-1 mb-1.5 font-mono">
        <span className="text-emerald-400 font-bold">{title}</span>
        <span>STATUS: LIVE</span>
      </div>
      {typeof children === "string" ? (
        <pre className="whitespace-pre-wrap font-mono text-emerald-400/90 selection:bg-emerald-500/30">{children}</pre>
      ) : (
        <div className="text-slate-200">{children}</div>
      )}
    </div>
  );
}

function Note({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <div
      id={id}
      className="mt-2 text-[11px] text-slate-400 leading-normal bg-slate-900/30 border border-slate-800/70 p-2 rounded-xs font-mono"
    >
      <span className="text-amber-400 font-bold mr-1">// GHI CHÚ:</span>
      <span className="font-sans text-slate-300">{children}</span>
    </div>
  );
}

/* ============================================================
   SHARED 2D COORDINATE SYSTEM (SVG)
   High Density Blueprint Grid with Zoom & Pan Coordinate Crosshairs
   ============================================================ */
const VB_W = 640;
const VB_H = 420;
const ORIGIN_X = 320;
const ORIGIN_Y = 220;
const SCALE = 28;

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
  defaultOriginY = 220,
  defaultScale = 28,
  minScale = 8,
  maxScale = 250,
  width = 640,
  height = 420,
}: PanZoomConfig = {}) {
  const [origin, setOrigin] = useState({ x: defaultOriginX, y: defaultOriginY });
  const [scale, setScale] = useState(defaultScale);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ clientX: number; clientY: number; origX: number; origY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Wheel zoom attached with non-passive listener to prevent page scrolling
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
      const target = e.target as HTMLElement | SVGElement;
      if (target.dataset && target.dataset.noPan === "true") return;

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
    setOrigin,
    scale,
    setScale,
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
  defaultScale = 28,
  onZoomIn,
  onZoomOut,
  onReset,
  origin,
}: {
  scale: number;
  defaultScale?: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  origin?: { x: number; y: number };
}) {
  const zoomPct = Math.round((scale / defaultScale) * 100);
  return (
    <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10 select-none pointer-events-auto">
      {origin && (
        <span className="hidden sm:inline-block bg-slate-950/85 backdrop-blur-xs border border-slate-800/90 text-slate-400 font-mono text-[9px] px-1.5 py-0.5 rounded-2xs">
          O:({Math.round(origin.x)},{Math.round(origin.y)})
        </span>
      )}
      <div className="flex items-center bg-slate-950/90 backdrop-blur-xs border border-slate-800/90 rounded-2xs p-0.5 shadow-md">
        <button
          type="button"
          onClick={onZoomOut}
          className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 rounded-3xs text-xs font-bold transition-colors cursor-pointer"
          title="Thu nhỏ (-)"
        >
          −
        </button>
        <button
          type="button"
          onClick={onReset}
          className="px-1.5 h-5 flex items-center justify-center text-[9px] font-mono text-amber-400 hover:text-amber-300 hover:bg-slate-800 rounded-3xs transition-colors cursor-pointer"
          title="Đặt lại gốc O và Zoom 100%"
        >
          {zoomPct}%
        </button>
        <button
          type="button"
          onClick={onZoomIn}
          className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 rounded-3xs text-xs font-bold transition-colors cursor-pointer"
          title="Phóng to (+)"
        >
          +
        </button>
        <button
          type="button"
          onClick={onReset}
          className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-emerald-300 hover:bg-slate-800 rounded-3xs text-[10px] ml-0.5 border-l border-slate-800 transition-colors cursor-pointer"
          title="Đặt lại tâm toạ độ và tỷ lệ ban đầu"
        >
          ↺
        </button>
      </div>
    </div>
  );
}

function buildFnPath(
  fn: (x: number) => number,
  xMin: number,
  xMax: number,
  toPxX: (x: number) => number,
  toPxY: (y: number) => number,
  step = 0.04
): string {
  let d = "";
  let started = false;
  const clampedMin = Math.max(-100, xMin);
  const clampedMax = Math.min(100, xMax);
  for (let x = clampedMin; x <= clampedMax; x += step) {
    const y = fn(x);
    if (!Number.isFinite(y) || Math.abs(y) > 250) {
      started = false;
      continue;
    }
    const px = toPxX(x).toFixed(2);
    const py = toPxY(y).toFixed(2);
    d += (started ? "L" : "M") + px + "," + py + " ";
    started = true;
  }
  return d;
}

function GraphGrid({
  originX = ORIGIN_X,
  originY = ORIGIN_Y,
  scale = SCALE,
  width = VB_W,
  height = VB_H,
  axisColor,
  axisWidth = 1.6,
}: {
  originX?: number;
  originY?: number;
  scale?: number;
  width?: number;
  height?: number;
  axisColor?: string;
  axisWidth?: number;
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

  const labels: React.ReactNode[] = [];

  const hasOx = originY >= -20 && originY <= height + 20;
  const hasOy = originX >= -20 && originX <= width + 20;

  for (let x = xMin; x <= xMax; x += labelStep) {
    if (Math.abs(x) < 0.0001) continue;
    const px = toPxX(x);
    if (px < 15 || px > width - 15) continue;
    const labelY = Math.max(14, Math.min(height - 6, originY + 13));
    labels.push(
      <text
        key={"lx" + x.toFixed(2)}
        x={px}
        y={labelY}
        fontSize="9"
        fill={axisColor ? "#f1f5f9" : COLORS.textFaint}
        textAnchor="middle"
        fontFamily={MONO_STACK}
      >
        {Number.isInteger(x) ? x : x.toFixed(1)}
      </text>
    );
  }

  for (let y = yMin; y <= yMax; y += labelStep) {
    if (Math.abs(y) < 0.0001) continue;
    const py = toPxY(y);
    if (py < 15 || py > height - 15) continue;
    const labelX = Math.max(18, Math.min(width - 6, originX - 6));
    labels.push(
      <text
        key={"ly" + y.toFixed(2)}
        x={labelX}
        y={py + 3}
        fontSize="9"
        fill={axisColor ? "#f1f5f9" : COLORS.textFaint}
        textAnchor="end"
        fontFamily={MONO_STACK}
      >
        {Number.isInteger(y) ? y : y.toFixed(1)}
      </text>
    );
  }

  const effectiveAxisColor = axisColor || COLORS.gridStrong;
  const effectiveArrowColor = axisColor || COLORS.textMuted;
  const effectiveLabelColor = axisColor || COLORS.textSecondary;
  const effectiveOriginColor = axisColor || COLORS.textFaint;

  return (
    <g>
      {/* Principal Axes */}
      {hasOx && (
        <>
          <line x1={0} y1={originY} x2={width} y2={originY} stroke={effectiveAxisColor} strokeWidth={axisWidth} />
          <path d={`M${width - 8},${originY - 3.5} L${width - 1},${originY} L${width - 8},${originY + 3.5}`} fill={effectiveArrowColor} />
          <text x={width - 12} y={originY - 7} fontSize="11" fill={effectiveLabelColor} fontFamily={MONO_STACK} fontWeight="600">
            x
          </text>
        </>
      )}
      {hasOy && (
        <>
          <line x1={originX} y1={0} x2={originX} y2={height} stroke={effectiveAxisColor} strokeWidth={axisWidth} />
          <path d={`M${originX - 3.5},8 L${originX},1 L${originX + 3.5},8`} fill={effectiveArrowColor} />
          <text x={originX + 8} y={12} fontSize="11" fill={effectiveLabelColor} fontFamily={MONO_STACK} fontWeight="600">
            y
          </text>
        </>
      )}
      {labels}
      {hasOx && hasOy && (
        <text x={originX - 8} y={originY + 12} fontSize="9" fill={effectiveOriginColor} fontFamily={MONO_STACK}>
          O
        </text>
      )}
    </g>
  );
}

interface ArrowProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  dashed?: boolean;
  width?: number;
}

function Arrow({ x1, y1, x2, y2, color, dashed, width }: ArrowProps) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const hl = 9;
  const hx1 = x2 - hl * Math.cos(angle - Math.PI / 6);
  const hy1 = y2 - hl * Math.sin(angle - Math.PI / 6);
  const hx2 = x2 - hl * Math.cos(angle + Math.PI / 6);
  const hy2 = y2 - hl * Math.sin(angle + Math.PI / 6);
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={width || 2.2}
        strokeDasharray={dashed ? "4 3" : undefined}
        strokeLinecap="round"
      />
      <polygon points={`${x2},${y2} ${hx1},${hy1} ${hx2},${hy2}`} fill={color} />
    </g>
  );
}

function VectorSvgLabel({
  x,
  y,
  symbol,
  color,
}: {
  x: number;
  y: number;
  symbol: "a" | "b" | "a+b" | "a-b";
  color: string;
}) {
  const renderVectorChar = (char: string, offsetX: number = 0) => (
    <g transform={`translate(${offsetX}, 0)`}>
      {/* Arrow line */}
      <line x1="0" y1="-11" x2="10.5" y2="-11" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      {/* Arrowhead */}
      <path
        d="M 7.5 -13.2 L 11 -11 L 7.5 -8.8"
        stroke={color}
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Character */}
      <text
        x="1"
        y="0"
        fontSize="13.5"
        fontStyle="italic"
        fontWeight="600"
        fill={color}
        fontFamily="Georgia, Cambria, 'Times New Roman', serif"
      >
        {char}
      </text>
    </g>
  );

  return (
    <g transform={`translate(${x}, ${y})`} className="select-none pointer-events-none">
      {symbol === "a" && renderVectorChar("a")}
      {symbol === "b" && renderVectorChar("b")}
      {symbol === "a+b" && (
        <g>
          {renderVectorChar("a", 0)}
          <text x="13.5" y="-0.5" fontSize="12" fontWeight="bold" fill={color} fontFamily="sans-serif">
            +
          </text>
          {renderVectorChar("b", 23.5)}
        </g>
      )}
      {symbol === "a-b" && (
        <g>
          {renderVectorChar("a", 0)}
          <text x="13.5" y="-0.5" fontSize="13" fontWeight="bold" fill={color} fontFamily="sans-serif">
            −
          </text>
          {renderVectorChar("b", 23.5)}
        </g>
      )}
    </g>
  );
}

/* ============================================================
   MODULE 1 — ĐỒ THỊ HÀM SỐ (Lớp 10–12, 2D)
   Integrated from ./components/FunctionModule.tsx
   ============================================================ */

/* ============================================================
   MODULE 2 — ĐƯỜNG TRÒN LƯỢNG GIÁC (Lớp 10–11, 2D)
   ============================================================ */
function CircleModule() {
  const [deg, setDeg] = useState(45);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1);
  const [playDirection, setPlayDirection] = useState<1 | -1>(1);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [customAngleInput, setCustomAngleInput] = useState<string>("+60");
  const isDraggingPointRef = useRef(false);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isFullScreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullScreen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullScreen]);

  // Clean up any running animation on unmount
  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const nav = useCanvas2DPanZoom({
    defaultOriginX: 200,
    defaultOriginY: 200,
    defaultScale: 140,
    minScale: 35,
    maxScale: 350,
    width: 400,
    height: 400,
  });

  // Animation loop using requestAnimationFrame for continuous smooth angle rotation
  useEffect(() => {
    if (!isPlaying) return;
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    let lastTime = performance.now();
    let animId: number;

    const loop = (currentTime: number) => {
      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      // 45 degrees per second base speed
      const deltaDeg = 45 * playSpeed * playDirection * dt;
      setDeg((prev) => {
        let next = (prev + deltaDeg) % 360;
        if (next < 0) next += 360;
        return +next.toFixed(2);
      });
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, playSpeed, playDirection]);

  // Quay mượt mà đến góc đích (targetDeg) theo chiều chỉ định hoặc chiều hiện tại
  const rotateTo = (target: number, customDir?: 1 | -1) => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    setIsPlaying(false);

    const targetClamped = ((target % 360) + 360) % 360;
    const dir = customDir ?? playDirection;
    const startDeg = deg;

    let diff = 0;
    if (dir === 1) {
      // Ngược chiều kim đồng hồ (chiều dương +): góc tăng dần
      diff = (targetClamped - startDeg + 360) % 360;
      if (diff === 0 && Math.abs(targetClamped - startDeg) > 0.1) diff = 360;
    } else {
      // Cùng chiều kim đồng hồ (chiều âm −): góc giảm dần
      diff = -((startDeg - targetClamped + 360) % 360);
      if (diff === 0 && Math.abs(startDeg - targetClamped) > 0.1) diff = -360;
    }

    if (Math.abs(diff) < 0.2) {
      setDeg(+targetClamped.toFixed(1));
      return;
    }

    const duration = Math.min(650, Math.max(220, Math.abs(diff) * 2.2));
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Cubic ease-out
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = (startDeg + diff * ease) % 360;
      const normalized = current < 0 ? current + 360 : current;
      setDeg(+normalized.toFixed(1));

      if (progress < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        setDeg(+targetClamped.toFixed(1));
        animRef.current = null;
      }
    };

    animRef.current = requestAnimationFrame(step);
  };

  // Quay tương đối theo bước nhảy góc hoặc góc tự do không giới hạn (360°, 720°...)
  const rotateBy = (delta: number) => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    setIsPlaying(false);

    if (Math.abs(delta) < 0.05) return;

    const startDeg = deg;
    const targetClamped = (((startDeg + delta) % 360) + 360) % 360;

    // Thời lượng quay tỷ lệ với góc nhưng được giới hạn từ 320ms đến 2500ms để quan sát trực quan
    const duration = Math.min(2500, Math.max(320, Math.abs(delta) * 2.2));
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Cubic ease-out
      const ease = 1 - Math.pow(1 - progress, 3);
      const raw = startDeg + delta * ease;
      const normalized = ((raw % 360) + 360) % 360;
      setDeg(+normalized.toFixed(1));

      if (progress < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        setDeg(+targetClamped.toFixed(1));
        animRef.current = null;
      }
    };

    animRef.current = requestAnimationFrame(step);
  };

  // Xử lý góc quay tùy ý từ ô nhập:
  // Quy ước: "+ Ngược CKĐH, - Cùng CKĐH"
  const handleApplyCustomAngle = () => {
    const trimmed = customAngleInput.trim();
    if (!trimmed) return;
    const isNegative = trimmed.startsWith("-");
    const numStr = trimmed.replace(/^[+-]/, "").trim();
    const val = parseFloat(numStr);
    if (isNaN(val) || val === 0) return;

    if (isNegative) {
      // Nhập dấu - : quay cùng chiều kim đồng hồ (chiều âm)
      rotateBy(-Math.abs(val));
    } else {
      // Nhập dấu + hoặc số dương: quay ngược chiều kim đồng hồ (chiều dương)
      rotateBy(Math.abs(val));
    }
  };

  const cx = nav.origin.x;
  const cy = nav.origin.y;
  const R = nav.scale; // Unit circle radius matches scale (R = 1.0)
  const rad = (deg * Math.PI) / 180;
  const px = cx + R * Math.cos(rad);
  const py = cy - R * Math.sin(rad);
  const sinV = Math.sin(rad);
  const cosV = Math.cos(rad);
  const tanV = Math.abs(cosV) > 0.001 ? Math.tan(rad) : NaN;
  const commonAngles = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];

  function angleFromEvent(e: React.PointerEvent<SVGSVGElement | SVGCircleElement>) {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    const svg = nav.bind.ref.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 400;
    const y = ((e.clientY - rect.top) / rect.height) * 400;
    // accurate angle relative to current origin cx, cy
    let ang = (Math.atan2(-(y - cy), x - cx) * 180) / Math.PI;
    if (ang < 0) ang += 360;
    setDeg(+ang.toFixed(1));
  }

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isDraggingPointRef.current) return;
    nav.bind.onPointerDown(e);
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isDraggingPointRef.current) {
      angleFromEvent(e);
      return;
    }
    nav.bind.onPointerMove(e);
  };

  const handleSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    isDraggingPointRef.current = false;
    nav.bind.onPointerUp(e);
  };

  // Tính toán cung góc lượng giác kèm mũi tên chỉ hướng quay
  const arcR = 30;
  const clampedArcDeg = Math.min(359.8, Math.max(0.1, deg));
  const arcRad = (clampedArcDeg * Math.PI) / 180;
  const arcEndX = cx + arcR * Math.cos(arcRad);
  const arcEndY = cy - arcR * Math.sin(arcRad);
  const largeArcFlag = clampedArcDeg > 180 ? 1 : 0;
  // Tiếp tuyến chỉ theo chiều ngược chiều kim đồng hồ (chiều dương +)
  const tanX = -Math.sin(arcRad);
  const tanY = -Math.cos(arcRad);
  const normX = Math.cos(arcRad);
  const normY = -Math.sin(arcRad);
  const arrowLen = 6;
  const arrowWid = 3;
  const arrowTipX = arcEndX;
  const arrowTipY = arcEndY;
  const arrowP1X = arcEndX - arrowLen * tanX + arrowWid * normX;
  const arrowP1Y = arcEndY - arrowLen * tanY + arrowWid * normY;
  const arrowP2X = arcEndX - arrowLen * tanX - arrowWid * normX;
  const arrowP2Y = arcEndY - arrowLen * tanY - arrowWid * normY;

  return (
    <div id="module-circle" className="grid grid-cols-1 md:grid-cols-12 gap-3">
      <div className="md:col-span-8 flex flex-col gap-3">
        <Panel
          id="circle-canvas-panel"
          title="ĐƯỜNG TRÒN ĐƠN VỊ // UNIT_CIRCLE_RADAR"
          badge="TRIG_RADAR"
          isFullScreen={isFullScreen}
          onToggleFullScreen={() => setIsFullScreen((f) => !f)}
          onDownloadImage={() => downloadSvgAsPng(nav.bind.ref.current, `duong-tron-luong-giac-${Math.round(deg)}deg-${Date.now()}`, 2)}
          downloadLabel="TẢI ẢNH (PNG)"
          action={
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-mono text-[10px]">R = 1.000</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-2xs border ${isPlaying ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-slate-900 text-slate-400 border-slate-800"}`}>
                {isPlaying ? "▶ RUNNING" : "⏸ PAUSED"}
              </span>
            </div>
          }
        >
          <div className={`relative bg-slate-950 border border-slate-800/80 rounded-2xs overflow-hidden flex items-center justify-center p-2 select-none ${isFullScreen ? "w-full flex-1 h-full min-h-0" : ""}`}>
            <Canvas2DNavHUD
              scale={nav.scale}
              defaultScale={nav.defaultScale}
              onZoomIn={nav.zoomIn}
              onZoomOut={nav.zoomOut}
              onReset={nav.resetView}
              origin={nav.origin}
            />

            <svg
              ref={nav.bind.ref}
              viewBox="0 0 400 400"
              className={`w-full ${isFullScreen ? "h-full max-h-[calc(100vh-100px)]" : "max-w-[420px] h-auto"} block touch-none ${nav.isPanning ? "cursor-grabbing" : "cursor-grab"}`}
              onPointerDown={handleSvgPointerDown}
              onPointerMove={handleSvgPointerMove}
              onPointerUp={handleSvgPointerUp}
              onPointerCancel={handleSvgPointerUp}
            >
              {/* Axes with Origin (cx, cy) - Màu trắng sáng, có mũi tên chỉ hướng dương */}
              {/* Trục hoành Ox (cos) */}
              <line x1={0} y1={cy} x2={392} y2={cy} stroke="#ffffff" strokeWidth="1.6" />
              <polygon points={`399,${cy} 390,${cy - 4} 390,${cy + 4}`} fill="#ffffff" />
              
              {/* Trục tung Oy (sin) */}
              <line x1={cx} y1={400} x2={cx} y2={8} stroke="#ffffff" strokeWidth="1.6" />
              <polygon points={`${cx},1 ${cx - 4},10 ${cx + 4},10`} fill="#ffffff" />

              {/* Nhãn trục toạ độ & Gốc toạ độ O - Màu trắng sáng */}
              <text x={386} y={cy - 8} fontSize="10.5" fill="#ffffff" fontWeight="bold" fontFamily={MONO_STACK} textAnchor="end">
                x (cos)
              </text>
              <text x={cx + 8} y={15} fontSize="10.5" fill="#ffffff" fontWeight="bold" fontFamily={MONO_STACK}>
                y (sin)
              </text>
              <text x={cx - 12} y={cy + 14} fontSize="10.5" fill="#ffffff" fontWeight="bold" fontFamily={MONO_STACK}>
                O
              </text>

              {/* Vạch chia toạ độ ±1 trên 2 trục toạ độ */}
              <line x1={cx + R} y1={cy - 3} x2={cx + R} y2={cy + 3} stroke="#ffffff" strokeWidth="1.4" opacity="0.8" />
              <text x={cx + R - 3} y={cy + 13} fontSize="9" fill="#ffffff" opacity="0.9" fontFamily={MONO_STACK}>
                1
              </text>
              <line x1={cx - R} y1={cy - 3} x2={cx - R} y2={cy + 3} stroke="#ffffff" strokeWidth="1.4" opacity="0.8" />
              <text x={cx - R - 6} y={cy + 13} fontSize="9" fill="#ffffff" opacity="0.9" fontFamily={MONO_STACK}>
                -1
              </text>
              <line x1={cx - 3} y1={cy - R} x2={cx + 3} y2={cy - R} stroke="#ffffff" strokeWidth="1.4" opacity="0.8" />
              <text x={cx - 13} y={cy - R + 4} fontSize="9" fill="#ffffff" opacity="0.9" fontFamily={MONO_STACK}>
                1
              </text>
              <line x1={cx - 3} y1={cy + R} x2={cx + 3} y2={cy + R} stroke="#ffffff" strokeWidth="1.4" opacity="0.8" />
              <text x={cx - 16} y={cy + R + 4} fontSize="9" fill="#ffffff" opacity="0.9" fontFamily={MONO_STACK}>
                -1
              </text>

              {/* Đường tròn lượng giác - Màu đỏ tươi, có vùng click nhạy để chọn góc trực tiếp */}
              <circle
                cx={cx}
                cy={cy}
                r={R}
                fill="none"
                stroke="transparent"
                strokeWidth="20"
                className="cursor-pointer"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  angleFromEvent(e);
                }}
              />
              <circle cx={cx} cy={cy} r={R} fill="none" stroke="#ff2a2a" strokeWidth="2" />

              {/* Angle sector arc & directional arrowhead (cung góc có mũi tên chỉ chiều quay) */}
              {deg > 1.5 && (
                <g>
                  <path
                    d={`M${cx},${cy} L${cx + arcR},${cy} A${arcR} ${arcR} 0 ${largeArcFlag} 0 ${arcEndX.toFixed(1)},${arcEndY.toFixed(1)} Z`}
                    fill={COLORS.amber}
                    opacity="0.22"
                    stroke={COLORS.amber}
                    strokeWidth="1.2"
                  />
                  {/* Mũi tên chỉ hướng quay ở đầu cung tròn lượng giác */}
                  <polygon
                    points={`${arrowTipX.toFixed(1)},${arrowTipY.toFixed(1)} ${arrowP1X.toFixed(1)},${arrowP1Y.toFixed(1)} ${arrowP2X.toFixed(1)},${arrowP2Y.toFixed(1)}`}
                    fill={COLORS.amber}
                  />
                </g>
              )}

              {/* Các điểm góc đặc biệt trên đường tròn - Kích chuột trực tiếp để quay đến góc */}
              {commonAngles.map((ang) => {
                const r2 = (ang * Math.PI) / 180;
                const dotX = cx + R * Math.cos(r2);
                const dotY = cy - R * Math.sin(r2);
                const isSelected = Math.abs(deg - ang) < 0.8 || (ang === 0 && Math.abs(deg - 360) < 0.8);
                return (
                  <g
                    key={ang}
                    className="cursor-pointer group"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      rotateTo(ang);
                    }}
                  >
                    <circle cx={dotX} cy={dotY} r="10" fill="transparent" />
                    <circle
                      cx={dotX}
                      cy={dotY}
                      r={isSelected ? "4" : "2.2"}
                      fill={isSelected ? "#fbbf24" : "rgba(255,255,255,0.65)"}
                      stroke={isSelected ? "#ffffff" : "none"}
                      strokeWidth={isSelected ? "1" : "0"}
                      className="transition-transform group-hover:scale-125"
                    />
                  </g>
                );
              })}

              {/* Projections */}
              <line x1={px} y1={py} x2={px} y2={cy} stroke={COLORS.cyan} strokeWidth="1.5" strokeDasharray="3 3" />
              <line x1={px} y1={py} x2={cx} y2={py} stroke={COLORS.emerald} strokeWidth="1.5" strokeDasharray="3 3" />

              {/* Radius vector OM */}
              <line x1={cx} y1={cy} x2={px} y2={py} stroke={COLORS.amber} strokeWidth="2.2" />
              <circle cx={cx} cy={cy} r="2.5" fill="#ffffff" />

              {/* Draggable point M - Giảm kích thước xuống r=4.5 hài hòa với các đối tượng khác */}
              <g
                className="cursor-pointer"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  isDraggingPointRef.current = true;
                  angleFromEvent(e);
                  (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (isDraggingPointRef.current) {
                    angleFromEvent(e);
                  }
                }}
                onPointerUp={(e) => {
                  isDraggingPointRef.current = false;
                  try {
                    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
                  } catch {
                    // ignore
                  }
                }}
              >
                {/* Vùng tương tác rộng rãi giúp thao tác mượt mà trên cảm ứng / chuột */}
                <circle cx={px} cy={py} r="14" fill="transparent" />
                {/* Điểm màu đỏ tươi tinh tế, viền trắng sáng */}
                <circle
                  cx={px}
                  cy={py}
                  r="4.5"
                  fill="#ff2a2a"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  className="transition-transform hover:scale-125"
                />
                {/* Tên điểm M */}
                <text
                  x={px + 9 * Math.cos(rad)}
                  y={py - 9 * Math.sin(rad)}
                  fontSize="10.5"
                  fontWeight="bold"
                  fill="#ff4d4f"
                  stroke="#020617"
                  strokeWidth="2"
                  paintOrder="stroke"
                  textAnchor={Math.cos(rad) >= 0 ? "start" : "end"}
                  dominantBaseline="central"
                  fontFamily={MONO_STACK}
                >
                  M
                </text>
              </g>

              {/* Value labels */}
              <text
                x={px + (cosV >= 0 ? 10 : -10)}
                y={cy + 14}
                fontSize="11"
                fill={COLORS.cyan}
                fontFamily={MONO_STACK}
                textAnchor={cosV >= 0 ? "start" : "end"}
              >
                cos = {fmt(cosV, 3)}
              </text>
              <text x={cx + 8} y={py - 8} fontSize="11" fill={COLORS.emerald} fontFamily={MONO_STACK}>
                sin = {fmt(sinV, 3)}
              </text>
            </svg>

            <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between font-mono text-[9px] text-slate-400 pointer-events-none">
              <span className="bg-slate-900/90 border border-slate-800 px-1.5 py-0.5 rounded-2xs text-amber-400">
                M(cos θ; sin θ)
              </span>
              <span className="bg-slate-950/85 backdrop-blur-xs border border-slate-800/80 px-1.5 py-0.5 rounded-2xs text-slate-400">
                💡 Cuộn chuột để Zoom · Nhấn giữ chuột để Di chuyển gốc O · Kích chuột chọn góc trực tiếp
              </span>
            </div>
          </div>
        </Panel>

        {/* KaTeX Values */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xs p-3 font-mono shadow-sm">
          <div className="text-[9px] text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1 mb-2">
            <span className="text-cyan-400 font-bold">GIÁ TRỊ LƯỢNG GIÁC CHUẨN SÁCH GIÁO KHOA</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center py-1 font-sans">
            <div className="bg-slate-950 p-1.5 rounded-2xs border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-mono">GÓC θ</span>
              <span className="text-amber-300 font-bold">{Math.round(deg)}°</span>
            </div>
            <div className="bg-slate-950 p-1.5 rounded-2xs border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-mono">cos θ</span>
              <span className="text-cyan-300 font-bold">{fmt(cosV, 4)}</span>
            </div>
            <div className="bg-slate-950 p-1.5 rounded-2xs border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-mono">sin θ</span>
              <span className="text-emerald-300 font-bold">{fmt(sinV, 4)}</span>
            </div>
            <div className="bg-slate-950 p-1.5 rounded-2xs border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-mono">tan θ</span>
              <span className="text-rose-300 font-bold">{Number.isFinite(tanV) ? fmt(tanV, 4) : "—"}</span>
            </div>
          </div>
        </div>

        <Note id="circle-hint">
          <strong>Quy ước lượng giác SGK Toán 10:</strong> Chiều <strong>Ngược chiều kim đồng hồ</strong> là <strong>chiều dương (+)</strong> (từ tia Ox hướng lên Oy). Chiều <strong>Cùng chiều kim đồng hồ</strong> là <strong>chiều âm (−)</strong>. Bấm các nút <strong>+{`{15°, 30°...}`}</strong> hoặc <strong>−{`{15°, 30°...}`}</strong> để quay từng bước, kích chuột vào các góc hoặc click trực tiếp lên đường tròn để quay mượt mà.
        </Note>
      </div>

      {/* CỘT PHẢI: HỘP THOẠI "CHẠY GÓC" ĐẶT BÊN PHẢI CỬA SỔ HIỂN THỊ ĐƯỜNG TRÒN LƯỢNG GIÁC */}
      <div className="md:col-span-5 lg:col-span-4 flex flex-col gap-3">
        <Panel id="circle-play-panel" title="HỘP THOẠI // CHẠY GÓC" badge="ROTATION_CTRL">
          {/* Góc lượng giác hiện tại */}
          <div className="bg-slate-950 p-3 rounded-2xs border border-slate-800 flex items-center justify-between mb-3">
            <div>
              <span className="text-[10px] text-slate-400 block font-mono">GÓC HIỆN TẠI (θ)</span>
              <span className="text-xl font-bold font-mono text-amber-300">
                {Math.round(deg)}°{" "}
                <span className="text-xs text-slate-400 font-normal">({fmt((deg * Math.PI) / 180, 3)} rad)</span>
              </span>
            </div>
            <button
              type="button"
              id="btn-circle-reset-0"
              onClick={() => rotateTo(0)}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-2xs text-xs font-mono transition-colors cursor-pointer"
              title="Về góc 0°"
            >
              ↺ Về 0°
            </button>
          </div>

          {/* Nút Chạy / Dừng quay chính */}
          <SectionLabel iconColor="bg-emerald-500">ĐIỀU KHIỂN CHẠY GÓC</SectionLabel>
          <div className="flex flex-col gap-2 mb-3">
            <button
              type="button"
              id="btn-circle-play-toggle"
              onClick={() => setIsPlaying((p) => !p)}
              className={`w-full py-2.5 rounded-2xs text-xs font-mono font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2 ${
                isPlaying
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/60 hover:bg-rose-500/30"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/60 hover:bg-emerald-500/30"
              }`}
            >
              <span className="text-sm">{isPlaying ? "⏸" : "▶"}</span>
              <span>{isPlaying ? "DỪNG QUAY GÓC" : "CHẠY GÓC QUAY θ"}</span>
            </button>

            {/* Chiều quay lượng giác */}
            <button
              type="button"
              id="btn-circle-dir-toggle"
              onClick={() => setPlayDirection((d) => (d === 1 ? -1 : 1))}
              className={`w-full py-2 px-2.5 border rounded-2xs text-xs font-mono font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                playDirection === 1
                  ? "bg-cyan-500/20 border-cyan-500/60 text-cyan-300 hover:bg-cyan-500/30"
                  : "bg-amber-500/20 border-amber-500/60 text-amber-300 hover:bg-amber-500/30"
              }`}
              title="Đổi chiều quay lượng giác (dương / âm)"
            >
              <span>{playDirection === 1 ? "↺ Chiều: Ngược CKĐH (+ Dương)" : "↻ Chiều: Cùng CKĐH (− Âm)"}</span>
            </button>

            {/* Tốc độ quay */}
            <div className="flex items-center justify-between gap-1 bg-slate-950 p-1.5 rounded-2xs border border-slate-800">
              <span className="text-[10px] text-slate-400 font-mono px-1">TỐC ĐỘ:</span>
              <div className="flex items-center gap-1">
                {[0.5, 1, 2, 4].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    id={`btn-speed-${spd}`}
                    onClick={() => setPlaySpeed(spd)}
                    className={`text-[10px] px-2 py-0.5 rounded-3xs font-mono font-bold transition-colors cursor-pointer ${
                      playSpeed === spd
                        ? "bg-amber-500/30 text-amber-300 border border-amber-500/50"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Hộp nhập giá trị góc quay - Độ lớn không giới hạn */}
          <SectionLabel iconColor="bg-amber-500">HỘP NHẬP GIÁ TRỊ GÓC QUAY (KHÔNG GIỚI HẠN)</SectionLabel>
          <div className="bg-slate-950 p-2.5 rounded-2xs border border-slate-800 flex flex-col gap-2 mb-3">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400">QUY ƯỚC DẤU GÓC QUAY:</span>
              <span className="text-[10.5px]">
                <span className="text-cyan-400 font-bold">+</span> Ngược CKĐH ·{" "}
                <span className="text-amber-400 font-bold">−</span> Cùng CKĐH
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  id="input-custom-angle"
                  value={customAngleInput}
                  onChange={(e) => setCustomAngleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleApplyCustomAngle();
                    }
                  }}
                  placeholder="VD: +60, -120, +720, -1080..."
                  className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-2xs px-3 py-2 text-sm font-mono text-amber-300 font-bold outline-none transition-colors"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400 pointer-events-none">
                  độ (°)
                </span>
              </div>
              <button
                type="button"
                id="btn-apply-custom-angle"
                onClick={handleApplyCustomAngle}
                className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/60 hover:border-amber-500 text-amber-300 font-mono text-xs font-bold rounded-2xs cursor-pointer transition-all whitespace-nowrap shadow-xs"
                title="Thực hiện quay theo góc vừa nhập (hoặc bấm phím Enter)"
              >
                QUAY GÓC ↵
              </button>
            </div>

            {/* Trợ giúp trực quan chiều quay theo ký tự đang nhập */}
            <div className="text-[10.5px] font-mono flex items-center justify-between px-1 text-slate-400">
              <span>
                Chiều quay:{" "}
                {customAngleInput.trim().startsWith("-") ? (
                  <span className="text-amber-400 font-bold">↻ Quay CÙNG chiều kim đồng hồ (−)</span>
                ) : (
                  <span className="text-cyan-400 font-bold">↺ Quay NGƯỢC chiều kim đồng hồ (+)</span>
                )}
              </span>
              <span className="text-slate-400 text-[10px]">Nhấn Enter để quay</span>
            </div>

            {/* Các phím mẫu góc không giới hạn thường dùng */}
            <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-slate-800/80">
              <span className="text-[10px] text-slate-400 font-mono">Mẫu:</span>
              {[
                { label: "+60°", val: "+60" },
                { label: "−120°", val: "-120" },
                { label: "+180°", val: "+180" },
                { label: "−180°", val: "-180" },
                { label: "+360°", val: "+360" },
                { label: "−360°", val: "-360" },
                { label: "+720°", val: "+720" },
                { label: "−720°", val: "-720" },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setCustomAngleInput(item.val);
                    const isNeg = item.val.startsWith("-");
                    const num = parseFloat(item.val.replace(/^[+-]/, ""));
                    if (isNeg) rotateBy(-num);
                    else rotateBy(num);
                  }}
                  className="text-[10px] px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-2xs font-mono cursor-pointer transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quay từng bước theo góc - Đã bổ sung đầy đủ +60°, +120°, +180°, +270°, +360° và -60°, -120°, -180°, -270°, -360° */}
          <SectionLabel iconColor="bg-cyan-500">QUAY TỪNG BƯỚC (STEP ROTATION)</SectionLabel>
          <div className="flex flex-col gap-2">
            <div className="bg-slate-950 p-2.5 rounded-2xs border border-slate-800/80">
              <div className="text-[11px] text-cyan-400 font-mono font-bold mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <span>↺</span> Quay ngược CKĐH (+ Chiều dương):
                </span>
                <span className="text-[10px] text-slate-400 font-normal">9 mức góc</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 font-mono">
                {[15, 30, 45, 60, 90, 120, 180, 270, 360].map((stepVal) => (
                  <button
                    key={`plus-${stepVal}`}
                    type="button"
                    id={`btn-step-plus-${stepVal}`}
                    onClick={() => rotateBy(stepVal)}
                    className="py-1.5 px-1 bg-slate-900 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500 text-cyan-300 text-xs font-bold rounded-2xs cursor-pointer transition-colors text-center shadow-xs"
                    title={`Quay ngược chiều kim đồng hồ +${stepVal}°`}
                  >
                    +{stepVal}°
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-2xs border border-slate-800/80">
              <div className="text-[11px] text-amber-400 font-mono font-bold mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <span>↻</span> Quay cùng CKĐH (− Chiều âm):
                </span>
                <span className="text-[10px] text-slate-400 font-normal">9 mức góc</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 font-mono">
                {[15, 30, 45, 60, 90, 120, 180, 270, 360].map((stepVal) => (
                  <button
                    key={`minus-${stepVal}`}
                    type="button"
                    id={`btn-step-minus-${stepVal}`}
                    onClick={() => rotateBy(-stepVal)}
                    className="py-1.5 px-1 bg-slate-900 hover:bg-amber-950/40 border border-slate-800 hover:border-amber-500 text-amber-300 text-xs font-bold rounded-2xs cursor-pointer transition-colors text-center shadow-xs"
                    title={`Quay cùng chiều kim đồng hồ −${stepVal}°`}
                  >
                    −{stepVal}°
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ============================================================
   MODULE 3 — VECTƠ TRONG MẶT PHẲNG (Lớp 10, 2D)
   ============================================================ */
function VectorModule() {
  const [v1x, setV1x] = useState(3);
  const [v1y, setV1y] = useState(1);
  const [v2x, setV2x] = useState(1);
  const [v2y, setV2y] = useState(3);
  const [mode, setMode] = useState<"sum" | "diff" | "dot">("sum");
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
    defaultOriginY: 220,
    defaultScale: 28,
    width: VB_W,
    height: VB_H,
  });

  const mag1 = Math.hypot(v1x, v1y);
  const mag2 = Math.hypot(v2x, v2y);
  const dot = v1x * v2x + v1y * v2y;
  const cosT = mag1 * mag2 > 0 ? Math.max(-1, Math.min(1, dot / (mag1 * mag2))) : 0;
  const angleDeg = (Math.acos(cosT) * 180) / Math.PI;
  const sum = { x: v1x + v2x, y: v1y + v2y };
  const diff = { x: v1x - v2x, y: v1y - v2y };

  const O = { x: nav.toPxX(0), y: nav.toPxY(0) };
  const P1 = { x: nav.toPxX(v1x), y: nav.toPxY(v1y) };
  const P2 = { x: nav.toPxX(v2x), y: nav.toPxY(v2y) };

  let arcPath: string | null = null;
  if (mode === "dot" && mag1 > 0.05 && mag2 > 0.05) {
    const a1 = Math.atan2(-v1y, v1x);
    const a2 = Math.atan2(-v2y, v2x);
    let delta = a2 - a1;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    const R = Math.min(36, Math.max(16, nav.scale * 1.2));
    const pts: string[] = [];
    const N = 24;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const ang = a1 + delta * t;
      pts.push(`${(O.x + R * Math.cos(ang)).toFixed(1)},${(O.y + R * Math.sin(ang)).toFixed(1)}`);
    }
    arcPath = `M${O.x},${O.y} L${pts.join(" L")} Z`;
  }

  return (
    <div id="module-vector" className="grid grid-cols-1 md:grid-cols-12 gap-3">
      <div className="md:col-span-8 flex flex-col gap-3">
        <Panel
          id="vector-canvas-panel"
          title="KHÔNG GIAN VECTƠ 2D // VECTOR_PLANE"
          badge="GEOMETRY"
          isFullScreen={isFullScreen}
          onToggleFullScreen={() => setIsFullScreen((f) => !f)}
          onDownloadImage={() => downloadSvgAsPng(nav.bind.ref.current, `khong-gian-vecto-2d-${Date.now()}`, 2)}
          downloadLabel="TẢI ẢNH (PNG)"
          action={<span className="text-amber-400 font-mono text-[10px]">PARALLELOGRAM_LAW</span>}
        >
          <div className={`relative bg-slate-950 border border-slate-800/80 rounded-2xs overflow-hidden select-none ${isFullScreen ? "w-full flex-1 h-full min-h-0 flex items-center justify-center" : ""}`}>
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
              className={`w-full ${isFullScreen ? "h-full max-h-[calc(100vh-100px)]" : "h-auto"} block touch-none ${nav.isPanning ? "cursor-grabbing" : "cursor-grab"}`}
            >
              <GraphGrid
                originX={nav.origin.x}
                originY={nav.origin.y}
                scale={nav.scale}
                width={VB_W}
                height={VB_H}
                axisColor="#ffffff"
                axisWidth={2}
              />
              {mode === "dot" && arcPath && <path d={arcPath} fill={COLORS.rose} opacity="0.22" stroke={COLORS.rose} strokeWidth="1" />}
              {mode === "sum" && (
                <>
                  <Arrow x1={P1.x} y1={P1.y} x2={nav.toPxX(sum.x)} y2={nav.toPxY(sum.y)} color={COLORS.cyan} dashed width={1.6} />
                  <Arrow x1={P2.x} y1={P2.y} x2={nav.toPxX(sum.x)} y2={nav.toPxY(sum.y)} color={COLORS.amber} dashed width={1.6} />
                  <Arrow x1={O.x} y1={O.y} x2={nav.toPxX(sum.x)} y2={nav.toPxY(sum.y)} color={COLORS.emerald} width={2.8} />
                </>
              )}
              {mode === "diff" && <Arrow x1={P2.x} y1={P2.y} x2={P1.x} y2={P1.y} color={COLORS.rose} width={2.8} />}
              <Arrow x1={O.x} y1={O.y} x2={P1.x} y2={P1.y} color={COLORS.amber} />
              <Arrow x1={O.x} y1={O.y} x2={P2.x} y2={P2.y} color={COLORS.cyan} />
              <VectorSvgLabel x={P1.x + 8} y={P1.y - 8} symbol="a" color={COLORS.amber} />
              <VectorSvgLabel x={P2.x + 8} y={P2.y - 8} symbol="b" color={COLORS.cyan} />
              {mode === "sum" && (
                <VectorSvgLabel
                  x={nav.toPxX(sum.x) + 8}
                  y={nav.toPxY(sum.y) - 8}
                  symbol="a+b"
                  color={COLORS.emerald}
                />
              )}
              {mode === "diff" && (
                <VectorSvgLabel
                  x={(P1.x + P2.x) / 2 + 10}
                  y={(P1.y + P2.y) / 2}
                  symbol="a-b"
                  color={COLORS.rose}
                />
              )}
            </svg>
            <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between font-mono text-[9px] text-slate-400 pointer-events-none">
              <span className="bg-slate-900/90 border border-slate-800 px-1.5 py-0.5 rounded-2xs text-emerald-400">
                Oxy 2D VECTOR SPACE
              </span>
              <span className="bg-slate-950/85 backdrop-blur-xs border border-slate-800/80 px-1.5 py-0.5 rounded-2xs text-slate-400">
                💡 Cuộn chuột để Zoom · Nhấn giữ chuột để Di chuyển gốc O
              </span>
            </div>
          </div>
        </Panel>

        {/* Vector math textbook box */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xs p-3 font-mono shadow-sm">
          <div className="text-[9px] text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1 mb-2">
            <span className="text-emerald-400 font-bold">CÔNG THỨC TOẠ ĐỘ VECTƠ</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center py-1">
            <div className="bg-slate-950 p-2 rounded-2xs border border-slate-800">
              <span className="text-[10px] text-amber-400 block font-bold">
                Vectơ <MathDisplay tex="\vec{a}" inline />
              </span>
              <span className="text-slate-200 font-mono text-xs">
                ({v1x}; {v1y}) · <MathDisplay tex="|\vec{a}|" inline /> = {fmt(mag1, 2)}
              </span>
            </div>
            <div className="bg-slate-950 p-2 rounded-2xs border border-slate-800">
              <span className="text-[10px] text-cyan-400 block font-bold">
                Vectơ <MathDisplay tex="\vec{b}" inline />
              </span>
              <span className="text-slate-200 font-mono text-xs">
                ({v2x}; {v2y}) · <MathDisplay tex="|\vec{b}|" inline /> = {fmt(mag2, 2)}
              </span>
            </div>
            <div className="bg-slate-950 p-2 rounded-2xs border border-slate-800">
              <span className="text-[10px] text-rose-400 block font-bold">
                Tích vô hướng <MathDisplay tex="\vec{a} \cdot \vec{b}" inline />
              </span>
              <span className="text-slate-200 font-mono text-xs">
                {fmt(dot)} · <MathDisplay tex="(\vec{a}, \vec{b})" inline /> = {fmt(angleDeg, 1)}°
              </span>
            </div>
          </div>
        </div>

        <Note id="vector-hint">
          {mode === "sum" && (
            <span>
              Tổng <MathDisplay tex="\vec{a} + \vec{b}" inline /> dựng theo quy tắc hình bình hành xuất phát từ gốc O.
            </span>
          )}
          {mode === "diff" && (
            <span>
              Hiệu <MathDisplay tex="\vec{a} - \vec{b}" inline /> nối từ mút vectơ <MathDisplay tex="\vec{b}" inline /> tới mút vectơ <MathDisplay tex="\vec{a}" inline /> (quy tắc 3 điểm: <MathDisplay tex="\vec{OA} - \vec{OB} = \vec{BA}" inline />).
            </span>
          )}
          {mode === "dot" && (
            <span>
              Góc θ giữa 2 vectơ: <MathDisplay tex="\cos \theta = \frac{\vec{a} \cdot \vec{b}}{|\vec{a}| \cdot |\vec{b}|}" inline />. Vuông góc khi tích vô hướng = 0.
            </span>
          )}
        </Note>
      </div>

      <div className="md:col-span-4">
        <Panel id="vector-controls-panel" title="TOẠ ĐỘ VECTƠ & PHÉP TOÁN" badge="VECTOR_OPS">
          <SectionLabel iconColor="bg-indigo-500">PHÉP TOÁN</SectionLabel>
          <ChipGroup
            id="vector-mode-chips"
            value={mode}
            onChange={setMode}
            options={[
              { value: "sum", label: "Tổng a+b" },
              { value: "diff", label: "Hiệu a−b" },
              { value: "dot", label: "Tích vô hướng" },
            ]}
          />

          <SectionLabel iconColor="bg-amber-500">
            HỘP NHẬP TOẠ ĐỘ VECTƠ <MathDisplay tex="\vec{a}" inline className="ml-1 text-amber-400 font-bold" />
          </SectionLabel>
          <div className="grid grid-cols-2 gap-2 mb-2.5">
            <NumberInput
              id="input-v1x"
              label="Hoành độ A.X"
              value={v1x}
              min={-8}
              max={8}
              step={0.5}
              onChange={setV1x}
              color="amber"
              quickOptions={[-3, -1, 1, 3, 4]}
              className="mb-0"
            />
            <NumberInput
              id="input-v1y"
              label="Tung độ A.Y"
              value={v1y}
              min={-8}
              max={8}
              step={0.5}
              onChange={setV1y}
              color="amber"
              quickOptions={[-3, -1, 1, 2, 3]}
              className="mb-0"
            />
          </div>

          <SectionLabel iconColor="bg-cyan-500">
            HỘP NHẬP TOẠ ĐỘ VECTƠ <MathDisplay tex="\vec{b}" inline className="ml-1 text-cyan-400 font-bold" />
          </SectionLabel>
          <div className="grid grid-cols-2 gap-2 mb-2.5">
            <NumberInput
              id="input-v2x"
              label="Hoành độ B.X"
              value={v2x}
              min={-8}
              max={8}
              step={0.5}
              onChange={setV2x}
              color="cyan"
              quickOptions={[-3, -1, 1, 2, 4]}
              className="mb-0"
            />
            <NumberInput
              id="input-v2y"
              label="Tung độ B.Y"
              value={v2y}
              min={-8}
              max={8}
              step={0.5}
              onChange={setV2y}
              color="cyan"
              quickOptions={[-3, -1, 1, 3, 4]}
              className="mb-0"
            />
          </div>

          <SectionLabel iconColor="bg-emerald-500">KẾT QUẢ ĐẠI SỐ</SectionLabel>
          <Formula id="vector-results" title="KẾT QUẢ ĐẠI SỐ // VECTOR_MATRIX">
            <div className="flex flex-col gap-1.5 font-mono text-[12px]">
              <div className="flex items-center justify-between py-1.5 px-2.5 bg-slate-900/80 border border-slate-800/90 rounded-2xs">
                <span className="text-slate-100 flex items-center">
                  <MathDisplay tex={`\\vec{a} = (${fmt(v1x, 1)};\\; ${fmt(v1y, 1)})`} inline />
                </span>
                <span className="text-amber-400 font-mono text-xs">
                  <MathDisplay tex={`|\\vec{a}| = ${fmt(mag1)}`} inline />
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 px-2.5 bg-slate-900/80 border border-slate-800/90 rounded-2xs">
                <span className="text-slate-100 flex items-center">
                  <MathDisplay tex={`\\vec{b} = (${fmt(v2x, 1)};\\; ${fmt(v2y, 1)})`} inline />
                </span>
                <span className="text-cyan-400 font-mono text-xs">
                  <MathDisplay tex={`|\\vec{b}| = ${fmt(mag2)}`} inline />
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 px-2.5 bg-slate-900/80 border border-slate-800/90 rounded-2xs">
                <span className="text-emerald-300 flex items-center">
                  <MathDisplay tex={`\\vec{a} + \\vec{b} = (${fmt(sum.x, 1)};\\; ${fmt(sum.y, 1)})`} inline />
                </span>
                <span className="text-emerald-400/90 text-[11px]">
                  <MathDisplay tex={`|\\vec{a} + \\vec{b}| = ${fmt(Math.hypot(sum.x, sum.y))}`} inline />
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 px-2.5 bg-slate-900/80 border border-slate-800/90 rounded-2xs">
                <span className="text-rose-300 flex items-center">
                  <MathDisplay tex={`\\vec{a} - \\vec{b} = (${fmt(diff.x, 1)};\\; ${fmt(diff.y, 1)})`} inline />
                </span>
                <span className="text-rose-400/90 text-[11px]">
                  <MathDisplay tex={`|\\vec{a} - \\vec{b}| = ${fmt(Math.hypot(diff.x, diff.y))}`} inline />
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 px-2.5 bg-slate-900/80 border border-slate-800/90 rounded-2xs">
                <span className="text-slate-100 flex items-center">
                  <MathDisplay tex={`\\vec{a} \\cdot \\vec{b} = ${fmt(dot)}`} inline />
                </span>
                <span className="text-amber-300 font-mono text-xs">
                  <MathDisplay tex={`(\\vec{a},\\, \\vec{b}) \\approx ${fmt(angleDeg, 1)}^\\circ`} inline />
                </span>
              </div>
            </div>
          </Formula>
        </Panel>
      </div>
    </div>
  );
}

/* ============================================================
   MODULE 4 — ĐẠO HÀM & TIẾP TUYẾN (Lớp 11, 2D)
   ============================================================ */
function DerivativeModule() {
  const [customLatex, setCustomLatex] = useState("0.4x^2 - x - 1");
  const [x0, setX0] = useState(2);
  const [showSecant, setShowSecant] = useState(false);
  const [dx, setDx] = useState(1.5);
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
    defaultOriginY: 220,
    defaultScale: 28,
    width: VB_W,
    height: VB_H,
  });

  const parsedCustomFn = useMemo(() => parseMathOrLatexToFunction(customLatex), [customLatex]);

  const fn = useMemo(() => {
    return parsedCustomFn || ((x: number) => 0.4 * x * x - x - 1);
  }, [parsedCustomFn]);

  const fprime0 = useMemo(() => {
    const h = 0.0001;
    return (fn(x0 + h) - fn(x0 - h)) / (2 * h);
  }, [fn, x0]);

  const f0 = fn(x0);
  const tangentFn = (x: number) => fprime0 * (x - x0) + f0;
  const curvePath = useMemo(
    () => buildFnPath(fn, nav.xMin, nav.xMax, nav.toPxX, nav.toPxY, Math.max(0.01, 1.2 / nav.scale)),
    [fn, nav.xMin, nav.xMax, nav.toPxX, nav.toPxY, nav.scale]
  );
  const tangentPath = useMemo(
    () => buildFnPath(tangentFn, nav.xMin, nav.xMax, nav.toPxX, nav.toPxY, 0.4),
    [tangentFn, nav.xMin, nav.xMax, nav.toPxX, nav.toPxY]
  );

  const x1 = x0 + dx;
  const f1 = fn(x1);
  const secantSlope = dx !== 0 ? (f1 - f0) / dx : NaN;

  return (
    <div id="module-derivative" className="grid grid-cols-1 md:grid-cols-12 gap-3">
      <div className="md:col-span-8 flex flex-col gap-3">
        <Panel
          id="derivative-canvas-panel"
          title="TIẾP TUYẾN & ĐẠO HÀM // TANGENT_SLOPE"
          badge="CALCULUS"
          isFullScreen={isFullScreen}
          onToggleFullScreen={() => setIsFullScreen((f) => !f)}
          onDownloadImage={() => downloadSvgAsPng(nav.bind.ref.current, `tiep-tuyen-dao-ham-${Date.now()}`, 2)}
          downloadLabel="TẢI ẢNH (PNG)"
          action={<span className="text-cyan-400 font-mono text-[10px]">f'({fmt(x0)}) = {fmt(fprime0, 3)}</span>}
        >
          <div className={`relative bg-slate-950 border border-slate-800/80 rounded-2xs overflow-hidden select-none ${isFullScreen ? "w-full flex-1 h-full min-h-0 flex items-center justify-center" : ""}`}>
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
              className={`w-full ${isFullScreen ? "h-full max-h-[calc(100vh-100px)]" : "h-auto"} block touch-none ${nav.isPanning ? "cursor-grabbing" : "cursor-grab"}`}
            >
              <GraphGrid
                originX={nav.origin.x}
                originY={nav.origin.y}
                scale={nav.scale}
                width={VB_W}
                height={VB_H}
                axisColor="#ffffff"
                axisWidth={2}
              />
              <path d={curvePath} stroke={COLORS.amber} strokeWidth="2" fill="none" strokeLinejoin="round" />
              <path d={tangentPath} stroke={COLORS.cyan} strokeWidth="2" fill="none" />
              {showSecant && <line x1={nav.toPxX(x0)} y1={nav.toPxY(f0)} x2={nav.toPxX(x1)} y2={nav.toPxY(f1)} stroke={COLORS.rose} strokeWidth="2" strokeDasharray="4 3" />}
              {showSecant && <circle cx={nav.toPxX(x1)} cy={nav.toPxY(f1)} r="3" fill={COLORS.rose} />}
              <circle cx={nav.toPxX(x0)} cy={nav.toPxY(f0)} r="3" fill="#ffffff" stroke="#0f172a" strokeWidth="1" />
            </svg>
            <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between font-mono text-[9px] text-slate-400 pointer-events-none">
              <span className="bg-slate-900/90 border border-slate-800 px-1.5 py-0.5 rounded-2xs text-cyan-400">
                TANGENT LINE (d)
              </span>
              <span className="bg-slate-950/85 backdrop-blur-xs border border-slate-800/80 px-1.5 py-0.5 rounded-2xs text-slate-400">
                💡 Cuộn chuột để Zoom · Nhấn giữ chuột để Di chuyển gốc O
              </span>
            </div>
          </div>
        </Panel>

        <Note id="derivative-hint">
          Đường thẳng màu xanh cyan (nét liền) là tiếp tuyến tại tiếp điểm M (điểm màu trắng).
          {showSecant && " Nét đứt màu đỏ là cát tuyến (khi Δx → 0, cát tuyến tiến tới tiếp tuyến theo định nghĩa đạo hàm)."}
        </Note>
      </div>

      <div className="md:col-span-4">
        <Panel id="derivative-controls-panel" title="ĐIỀU KHIỂN TIẾP ĐIỂM" badge="DERIV_CTRL">
          <SectionLabel iconColor="bg-amber-500">GÕ BIỂU THỨC LATEX</SectionLabel>
          <LatexFunctionInput
            id="input-deriv-latex"
            label="BIỂU THỨC HÀM SỐ f(x)"
            value={customLatex}
            onChange={setCustomLatex}
            hideSymbols={true}
            hidePresets={true}
          />

          <SectionLabel iconColor="bg-cyan-500">HỘP NHẬP TIẾP ĐIỂM x₀ & CÁT TUYẾN</SectionLabel>
          <NumberInput id="input-x0" label="Hoành độ tiếp điểm x₀" value={x0} min={-5} max={5} step={0.1} onChange={setX0} color="cyan" quickOptions={[-2, -1, 0, 1, 2, 3]} />
          
          <ToggleRow id="toggle-secant" label="Minh hoạ giới hạn cát tuyến" checked={showSecant} onChange={setShowSecant} />
          {showSecant && (
            <NumberInput id="input-dx" label="Gia số Δx" value={dx} min={0.05} max={4} step={0.05} onChange={setDx} color="rose" quickOptions={[0.1, 0.5, 1.0, 1.5, 2.0]} />
          )}

          {/* Textbook-grade formula presentation */}
          <div className="mt-3 bg-slate-950/90 border border-slate-800 rounded-xs p-3 font-mono shadow-sm">
            <div className="flex items-center justify-between text-[9px] text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1 mb-2">
              <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></span>
                PHƯƠNG TRÌNH TIẾP TUYẾN TẠI M(x₀; y₀)
              </span>
              <span className="text-slate-500">LỚP 11</span>
            </div>
            <div className="space-y-1.5 py-1">
              {/* Dòng 1: Hàm số f(x) */}
              <div className="text-center text-amber-300 text-sm overflow-x-auto py-0.5">
                <MathDisplay tex={`y = f(x) = ${customLatex || "0"}`} />
              </div>
              {/* Dòng 2: Công thức tổng quát tiếp tuyến */}
              <div className="text-center text-cyan-300 text-sm overflow-x-auto py-0.5 font-medium">
                <MathDisplay tex="(d): y = f'(x_0)(x - x_0) + f(x_0)" />
              </div>
              {/* Dòng 3: Dòng suy ra thế số */}
              <div className="text-center text-cyan-400 text-sm font-bold overflow-x-auto py-0.5">
                <MathDisplay tex={`\\implies y = ${fmt(fprime0, 2)}(x ${x0 >= 0 ? `- ${fmt(x0)}` : `+ ${fmt(Math.abs(x0))}`}) ${signStr(f0)} ${fmt(Math.abs(f0), 2)}`} />
              </div>
              {showSecant && (
                <div className="text-center text-rose-300 text-xs border-t border-slate-800/80 pt-1.5 overflow-x-auto">
                  <MathDisplay tex={`k_{\\text{cát tuyến}} = \\frac{f(x_0 + \\Delta x) - f(x_0)}{\\Delta x} = \\frac{${fmt(f1, 2)} - (${fmt(f0, 2)})}{${fmt(dx)}} = ${fmt(secantSlope, 3)}`} />
                </div>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ============================================================
   MODULE 5 — TÍCH PHÂN & DIỆN TÍCH HÌNH PHẲNG (Lớp 12, 2D)
   ============================================================ */
const AREA_COLOR_PALETTE = [
  { name: "Lục bảo", hex: "#10b981" },
  { name: "Hổ phách", hex: "#f59e0b" },
  { name: "Xanh Cyan", hex: "#06b6d4" },
  { name: "Lam biếc", hex: "#3b82f6" },
  { name: "Thạch anh", hex: "#a855f7" },
  { name: "Đỏ hồng", hex: "#f43f5e" },
  { name: "Cam sáng", hex: "#f97316" },
];

function IntegralModule() {
  const [customLatex, setCustomLatex] = useState("-0.35x^2 + 3.2");
  const [lo, setLo] = useState(-2);
  const [hi, setHi] = useState(2);
  const [areaColor, setAreaColor] = useState("#10b981");
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
    defaultOriginY: 220,
    defaultScale: 28,
    width: VB_W,
    height: VB_H,
  });

  const parsedCustomFn = useMemo(() => parseMathOrLatexToFunction(customLatex), [customLatex]);

  const fn = useMemo(() => {
    return parsedCustomFn || ((x: number) => -0.35 * x * x + 3.2);
  }, [parsedCustomFn]);

  const lower = Math.min(lo, hi);
  const upper = Math.max(lo, hi);

  // Numerical integration via Simpson's rule
  const { signedIntegral, area } = useMemo(() => {
    if (upper <= lower) return { signedIntegral: 0, area: 0 };
    const n = 600;
    const h = (upper - lower) / n;
    let sSigned = fn(lower) + fn(upper);
    let sAbs = Math.abs(fn(lower)) + Math.abs(fn(upper));

    for (let i = 1; i < n; i++) {
      const x = lower + i * h;
      const factor = i % 2 === 0 ? 2 : 4;
      const val = fn(x);
      sSigned += factor * val;
      sAbs += factor * Math.abs(val);
    }
    return {
      signedIntegral: (sSigned * h) / 3,
      area: (sAbs * h) / 3,
    };
  }, [fn, lower, upper]);

  const signChanges = Math.abs(Math.abs(signedIntegral) - area) > 0.02;

  const curvePath = useMemo(
    () => buildFnPath(fn, nav.xMin, nav.xMax, nav.toPxX, nav.toPxY, Math.max(0.01, 1.2 / nav.scale)),
    [fn, nav.xMin, nav.xMax, nav.toPxX, nav.toPxY, nav.scale]
  );
  const fillPath = useMemo(() => {
    let d = `M${nav.toPxX(lower).toFixed(2)},${nav.toPxY(0).toFixed(2)} `;
    const step = Math.max(0.02, (upper - lower) / 200);
    for (let x = lower; x <= upper; x += step) {
      d += `L${nav.toPxX(x).toFixed(2)},${nav.toPxY(fn(x)).toFixed(2)} `;
    }
    d += `L${nav.toPxX(upper).toFixed(2)},${nav.toPxY(fn(upper)).toFixed(2)} `;
    d += `L${nav.toPxX(upper).toFixed(2)},${nav.toPxY(0).toFixed(2)} Z`;
    return d;
  }, [fn, lower, upper, nav.toPxX, nav.toPxY]);

  return (
    <div id="module-integral" className="grid grid-cols-1 md:grid-cols-12 gap-3">
      <div className="md:col-span-8 flex flex-col gap-3">
        <Panel
          id="integral-canvas-panel"
          title="TÍCH PHÂN & DIỆN TÍCH MIỀN PHẲNG // RIEMANN_INTEGRAL"
          badge="AREA_INTEGRAL"
          isFullScreen={isFullScreen}
          onToggleFullScreen={() => setIsFullScreen((f) => !f)}
          onDownloadImage={() => downloadSvgAsPng(nav.bind.ref.current, `tich-phan-dien-tich-${Date.now()}`, 2)}
          downloadLabel="TẢI ẢNH (PNG)"
          action={<span className="font-mono text-[10px]" style={{ color: areaColor }}>S = {fmt(area, 3)} đvdt</span>}
        >
          <div className={`relative bg-slate-950 border border-slate-800/80 rounded-2xs overflow-hidden select-none ${isFullScreen ? "w-full flex-1 h-full min-h-0 flex items-center justify-center" : ""}`}>
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
              className={`w-full ${isFullScreen ? "h-full max-h-[calc(100vh-100px)]" : "h-auto"} block touch-none ${nav.isPanning ? "cursor-grabbing" : "cursor-grab"}`}
            >
              <GraphGrid
                originX={nav.origin.x}
                originY={nav.origin.y}
                scale={nav.scale}
                width={VB_W}
                height={VB_H}
                axisColor="#ffffff"
                axisWidth={2}
              />
              <path d={fillPath} fill={areaColor} opacity="0.35" stroke="none" />
              <line
                x1={nav.toPxX(lower)}
                y1={nav.toPxY(0)}
                x2={nav.toPxX(lower)}
                y2={nav.toPxY(fn(lower))}
                stroke={COLORS.cyan}
                strokeWidth="1.4"
                strokeDasharray="3 3"
              />
              <line
                x1={nav.toPxX(upper)}
                y1={nav.toPxY(0)}
                x2={nav.toPxX(upper)}
                y2={nav.toPxY(fn(upper))}
                stroke={COLORS.cyan}
                strokeWidth="1.4"
                strokeDasharray="3 3"
              />
              <path d={curvePath} stroke={COLORS.amber} strokeWidth="2.4" fill="none" strokeLinejoin="round" />
            </svg>
            <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between font-mono text-[9px] text-slate-400 pointer-events-none">
              <span className="bg-slate-900/90 border border-slate-800 px-1.5 py-0.5 rounded-2xs flex items-center gap-1" style={{ color: areaColor }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: areaColor }} />
                INTEGRAL REGION S
              </span>
              <span className="bg-slate-950/85 backdrop-blur-xs border border-slate-800/80 px-1.5 py-0.5 rounded-2xs text-slate-400">
                💡 Cuộn chuột để Zoom · Nhấn giữ chuột để Di chuyển gốc O
              </span>
            </div>
          </div>
        </Panel>

        {/* Tùy chọn màu sắc cho diện tích hình phẳng ở cửa sổ hiển thị bên trái */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xs px-3 py-2 flex flex-wrap items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full border border-white/30 shrink-0" style={{ backgroundColor: areaColor }} />
            <span className="text-[11px] font-mono text-slate-300 font-semibold tracking-wide">
              MÀU SẮC DIỆN TÍCH HÌNH PHẲNG:
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {AREA_COLOR_PALETTE.map((item) => (
              <button
                key={item.hex}
                type="button"
                onClick={() => setAreaColor(item.hex)}
                title={item.name}
                className={`w-5 h-5 rounded-full transition-all border ${
                  areaColor === item.hex
                    ? "ring-2 ring-white scale-110 border-white shadow-sm"
                    : "border-slate-700/80 opacity-75 hover:opacity-100 hover:scale-105"
                }`}
                style={{ backgroundColor: item.hex }}
              />
            ))}
          </div>
        </div>

        <Note id="integral-hint">
          Vùng tô màu là diện tích hình phẳng giới hạn bởi đồ thị hàm số y = f(x), trục hoành Ox và hai đường thẳng x = a, x = b. Tích phân xác định có dấu âm nếu đồ thị nằm phía dưới trục hoành Ox.
        </Note>
      </div>

      <div className="md:col-span-4">
        <Panel id="integral-controls-panel" title="THIẾT LẬP TÍCH PHÂN" badge="INTEGRAL_PARAM">
          <SectionLabel iconColor="bg-amber-500">GÕ BIỂU THỨC LATEX</SectionLabel>
          <LatexFunctionInput
            id="input-int-latex"
            label="BIỂU THỨC HÀM SỐ f(x)"
            value={customLatex}
            onChange={setCustomLatex}
            hideSymbols={true}
            hidePresets={true}
          />

          <SectionLabel iconColor="bg-emerald-500">HỘP NHẬP CẬN TÍCH PHÂN [a; b]</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <NumberInput id="input-lower" label="Cận dưới a" value={lo} min={-6} max={6} step={0.1} onChange={setLo} color="cyan" quickOptions={[-3, -2, -1, 0, 1]} />
            <NumberInput id="input-upper" label="Cận trên b" value={hi} min={-6} max={6} step={0.1} onChange={setHi} color="emerald" quickOptions={[0, 1, 2, 3, 3.14]} />
          </div>

          {/* Textbook-grade formula presentation đưa sang cửa sổ bên phải */}
          <div className="mt-3 bg-slate-950/90 border border-slate-800 rounded-xs p-3 font-mono shadow-sm">
            <div className="flex items-center justify-between text-[9px] text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1 mb-2">
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                CÔNG THỨC TÍCH PHÂN & DIỆN TÍCH (NEWTON-LEIBNIZ)
              </span>
              <span className="text-slate-500">LỚP 12</span>
            </div>
            <div className="space-y-2 py-1">
              <div className="text-center text-amber-300 text-sm overflow-x-auto py-0.5">
                <MathDisplay tex={`y = f(x) = ${customLatex || "0"}`} />
              </div>
              <div className="space-y-2 pt-1 border-t border-slate-800/80">
                <div className="bg-slate-900/90 p-2 rounded-2xs border border-slate-800 text-center overflow-x-auto">
                  <span className="text-[10px] text-cyan-400 block font-bold mb-1">TÍCH PHÂN XÁC ĐỊNH</span>
                  <MathDisplay tex={`\\int_{${fmt(lower)}}^{${fmt(upper)}} f(x)\\,dx \\approx ${fmt(signedIntegral, 3)}`} />
                </div>
                <div className="bg-slate-900/90 p-2 rounded-2xs border border-slate-800 text-center overflow-x-auto">
                  <span className="text-[10px] text-emerald-400 block font-bold mb-1">DIỆN TÍCH MIỀN PHẲNG (S)</span>
                  <MathDisplay tex={`S = \\int_{${fmt(lower)}}^{${fmt(upper)}} |f(x)|\\,dx \\approx ${fmt(area, 3)}`} />
                </div>
              </div>
              {signChanges && (
                <div className="text-[10px] text-amber-400 font-mono text-center pt-1">
                  * Đồ thị cắt trục Ox trên đoạn [{fmt(lower)}; {fmt(upper)}], diện tích S được cộng theo trị tuyệt đối.
                </div>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ============================================================
   SHARED 3D ORBIT SCENE HOOK (THREE.JS HIGH DENSITY VIEWPORT)
   ============================================================ */
type ViewPreset = "iso" | "top" | "bottom" | "front" | "side";

function useOrbitScene(containerRef: React.RefObject<HTMLDivElement | null>) {
  const groupRef = useRef<THREE.Group | null>(null);
  const resetRef = useRef<(() => void) | null>(null);
  const presetRef = useRef<((preset: ViewPreset) => void) | null>(null);
  const autoRotateRef = useRef<boolean>(false);
  const [autoRotate, setAutoRotate] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / Math.max(container.clientHeight, 1), 0.1, 100);
    let dist = 7.5;
    camera.position.set(4.2, 2.8, 5.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dl = new THREE.DirectionalLight(0xffffff, 0.95);
    dl.position.set(5, 8, 6);
    scene.add(dl);
    const dl2 = new THREE.DirectionalLight(0x06b6d4, 0.45);
    dl2.position.set(-6, -2, -4);
    scene.add(dl2);

    const group = new THREE.Group();
    group.quaternion.setFromEuler(new THREE.Euler(-0.35, 0.6, 0));
    group.position.set(0, 0, 0);
    scene.add(group);
    groupRef.current = group;

    let dragging = false;
    let prevX = 0;
    let prevY = 0;

    const resetView = () => {
      group.quaternion.setFromEuler(new THREE.Euler(-0.35, 0.6, 0));
      dist = 7.5;
      const dir = new THREE.Vector3(4.2, 2.8, 5.2).normalize();
      camera.position.copy(dir.multiplyScalar(dist));
      camera.lookAt(0, 0, 0);
    };
    resetRef.current = resetView;

    const setPreset = (preset: ViewPreset) => {
      switch (preset) {
        case "top": // Nhìn từ trên xuống (mặt đỉnh / đáy trên)
          group.quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
          break;
        case "bottom": // Nhìn từ dưới lên (mặt đáy)
          group.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
          break;
        case "front": // Nhìn trực diện
          group.quaternion.setFromEuler(new THREE.Euler(0, 0, 0));
          break;
        case "side": // Nhìn cạnh bên
          group.quaternion.setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
          break;
        case "iso":
        default:
          group.quaternion.setFromEuler(new THREE.Euler(-0.35, 0.6, 0));
          break;
      }
    };
    presetRef.current = setPreset;

    const getXY = (e: MouseEvent | TouchEvent) => {
      const isTouch = "touches" in e;
      return {
        x: isTouch ? e.touches[0].clientX : (e as MouseEvent).clientX,
        y: isTouch ? e.touches[0].clientY : (e as MouseEvent).clientY,
      };
    };

    const onDown = (e: MouseEvent | TouchEvent) => {
      dragging = true;
      const p = getXY(e);
      prevX = p.x;
      prevY = p.y;
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging) return;
      const p = getXY(e);
      const dx = p.x - prevX;
      const dy = p.y - prevY;
      prevX = p.x;
      prevY = p.y;

      // Full 360-degree free 3D rotation in any direction without angle lock or limits
      const rotSpeed = 0.0075;
      const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
      const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();

      const qX = new THREE.Quaternion().setFromAxisAngle(camRight, dy * rotSpeed);
      const qY = new THREE.Quaternion().setFromAxisAngle(camUp, dx * rotSpeed);

      group.quaternion.premultiply(qX);
      group.quaternion.premultiply(qY);
    };

    const onUp = () => {
      dragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      dist = Math.max(3.0, Math.min(14, dist + e.deltaY * 0.01));
      const dir = camera.position.clone().normalize();
      camera.position.copy(dir.multiplyScalar(dist));
      camera.lookAt(0, 0, 0);
    };

    const dom = renderer.domElement;
    dom.addEventListener("mousedown", onDown);
    dom.addEventListener("touchstart", onDown, { passive: true });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    dom.addEventListener("wheel", onWheel, { passive: false });

    let raf: number;
    const animate = () => {
      if (autoRotateRef.current && !dragging) {
        // Tự xoay 360 độ quanh trục thẳng đứng Y của không gian thế giới
        const spinQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.012);
        group.quaternion.premultiply(spinQ);
      }
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      camera.lookAt(0, 0, 0);
      renderer.setSize(w, h);
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      dom.removeEventListener("mousedown", onDown);
      dom.removeEventListener("touchstart", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
      dom.removeEventListener("wheel", onWheel);

      scene.traverse((obj) => {
        if ("geometry" in obj && (obj as THREE.Mesh).geometry) {
          (obj as THREE.Mesh).geometry.dispose();
        }
        if ("material" in obj && (obj as THREE.Mesh).material) {
          const mat = (obj as THREE.Mesh).material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => m.dispose());
          } else {
            mat.dispose();
          }
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [containerRef]);

  const toggleAutoRotate = () => {
    autoRotateRef.current = !autoRotateRef.current;
    setAutoRotate(autoRotateRef.current);
  };

  return {
    groupRef,
    resetView: () => resetRef.current?.(),
    setPreset: (preset: ViewPreset) => presetRef.current?.(preset),
    toggleAutoRotate,
    autoRotate,
  };
}

function clearGroup(group: THREE.Group | null) {
  if (!group) return;
  while (group.children.length) {
    const obj = group.children.pop();
    if (obj && "geometry" in obj && (obj as THREE.Mesh).geometry) {
      (obj as THREE.Mesh).geometry.dispose();
    }
    if (obj && "material" in obj && (obj as THREE.Mesh).material) {
      const mat = (obj as THREE.Mesh).material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => m.dispose());
      } else {
        mat.dispose();
      }
    }
    if (obj) group.remove(obj);
  }
}

/* ============================================================
   3D NET UNFOLDING GEOMETRY BUILDERS (TRẢI PHẲNG HÌNH HỌC)
   ============================================================ */

/** Tạo dải lưới hình trụ trải phẳng dần thành hình chữ nhật và 2 nắp tròn */
function createUnfoldingCylinderGeometry(
  r: number,
  h: number,
  t: number // 0 = 3D Solid, 1 = Flat 2D Net
) {
  const Nu = 48;
  const Nv = 12;
  const positions: number[] = [];
  const indices: number[] = [];

  // Lateral surface mesh
  for (let j = 0; j <= Nv; j++) {
    const v = -h / 2 + (j / Nv) * h;
    for (let i = 0; i <= Nu; i++) {
      const u = -Math.PI + (i / Nu) * Math.PI * 2;
      let x: number, y: number, z: number;

      if (t <= 0.001) {
        x = r * Math.sin(u);
        y = v;
        z = r * Math.cos(u);
      } else if (t >= 0.999) {
        x = r * u;
        y = v;
        z = 0;
      } else {
        const kappa = 1 - 0.999 * t;
        const R_eff = r / kappa;
        const phi = u * kappa;
        x = R_eff * Math.sin(phi);
        y = v;
        z = R_eff * (Math.cos(phi) - 1);
      }
      positions.push(x, y, z);
    }
  }

  for (let j = 0; j < Nv; j++) {
    for (let i = 0; i < Nu; i++) {
      const a = j * (Nu + 1) + i;
      const b = (j + 1) * (Nu + 1) + i;
      const c = (j + 1) * (Nu + 1) + (i + 1);
      const d = j * (Nu + 1) + (i + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/** Tạo nắp tròn trên của hình trụ uốn gập từ 90 độ xuống phẳng */
function createCylinderTopCapGeometry(r: number, h: number, t: number) {
  const N = 48;
  const positions: number[] = [0, 0, 0];
  const indices: number[] = [];

  const psi = (1 - t) * (Math.PI / 2);

  // Center of disc
  const cDy = r;
  positions[0] = 0;
  positions[1] = h / 2 + cDy * Math.cos(psi);
  positions[2] = -cDy * Math.sin(psi);

  for (let i = 0; i <= N; i++) {
    const angle = (i / N) * Math.PI * 2;
    const dx = r * Math.cos(angle);
    const dyFromCenter = r * Math.sin(angle);
    const dyFromHinge = r + dyFromCenter;

    const x = dx;
    const y = h / 2 + dyFromHinge * Math.cos(psi);
    const z = -dyFromHinge * Math.sin(psi);

    positions.push(x, y, z);
    if (i < N) {
      indices.push(0, i + 1, i + 2);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/** Tạo nắp tròn dưới của hình trụ uốn gập từ 90 độ xuống phẳng */
function createCylinderBottomCapGeometry(r: number, h: number, t: number) {
  const N = 48;
  const positions: number[] = [0, 0, 0];
  const indices: number[] = [];

  const psi = (1 - t) * (Math.PI / 2);

  // Center of disc
  const cDy = -r;
  positions[0] = 0;
  positions[1] = -h / 2 + cDy * Math.cos(psi);
  positions[2] = -cDy * Math.sin(psi);

  for (let i = 0; i <= N; i++) {
    const angle = (i / N) * Math.PI * 2;
    const dx = r * Math.cos(angle);
    const dyFromCenter = r * Math.sin(angle);
    const dyFromHinge = -r + dyFromCenter;

    const x = dx;
    const y = -h / 2 + dyFromHinge * Math.cos(psi);
    const z = -dyFromHinge * Math.sin(psi);

    positions.push(x, y, z);
    if (i < N) {
      indices.push(0, i + 2, i + 1);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/** Tạo mặt nón trải phẳng thành hình quạt tròn và nắp đáy */
function createUnfoldingConeGeometry(r: number, h: number, t: number) {
  const Ns = 24;
  const Nu = 48;
  const L = Math.sqrt(r * r + h * h);
  const theta0 = 2 * Math.PI * (r / L);

  const positions: number[] = [];
  const indices: number[] = [];

  for (let j = 0; j <= Ns; j++) {
    const s = j / Ns; // 0 at apex, 1 at base rim
    for (let i = 0; i <= Nu; i++) {
      const u = -1 + (i / Nu) * 2; // -1 to 1

      // 3D Cone coords
      const phi3D = u * Math.PI;
      const x3D = s * r * Math.sin(phi3D);
      const y3D = h / 2 - s * h;
      const z3D = s * r * (Math.cos(phi3D) - 1);

      // 2D Flat Net Sector coords
      const theta2D = u * (theta0 / 2);
      const x2D = s * L * Math.sin(theta2D);
      const y2D = h / 2 + L / 2 - s * L * Math.cos(theta2D);
      const z2D = 0;

      const x = (1 - t) * x3D + t * x2D;
      const y = (1 - t) * y3D + t * y2D;
      const z = (1 - t) * z3D + t * z2D;

      positions.push(x, y, z);
    }
  }

  for (let j = 0; j < Ns; j++) {
    for (let i = 0; i < Nu; i++) {
      const a = j * (Nu + 1) + i;
      const b = (j + 1) * (Nu + 1) + i;
      const c = (j + 1) * (Nu + 1) + (i + 1);
      const d = j * (Nu + 1) + (i + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/** Nắp đáy hình nón uốn gập phẳng */
function createConeBottomCapGeometry(r: number, h: number, t: number) {
  const N = 48;
  const L = Math.sqrt(r * r + h * h);
  const positions: number[] = [0, 0, 0];
  const indices: number[] = [];

  const psi = (1 - t) * (Math.PI / 2);

  // Hinge point on rim
  const hingeY = (1 - t) * (-h / 2) + t * (h / 2 - L / 2);

  const cDy = -r;
  positions[0] = 0;
  positions[1] = hingeY + cDy * Math.cos(psi);
  positions[2] = -cDy * Math.sin(psi);

  for (let i = 0; i <= N; i++) {
    const angle = (i / N) * Math.PI * 2;
    const dx = r * Math.cos(angle);
    const dyFromCenter = r * Math.sin(angle);
    const dyFromHinge = -r + dyFromCenter;

    const x = dx;
    const y = hingeY + dyFromHinge * Math.cos(psi);
    const z = -dyFromHinge * Math.sin(psi);

    positions.push(x, y, z);
    if (i < N) {
      indices.push(0, i + 2, i + 1);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/** Mặt nón cụt trải phẳng thành vành quạt khuyên */
function createUnfoldingFrustumGeometry(rBot: number, rTop: number, h: number, t: number) {
  const Ns = 20;
  const Nu = 48;
  const l = Math.sqrt(h * h + (rBot - rTop) * (rBot - rTop));
  const L2 = (rBot * l) / Math.max(0.01, rBot - rTop);
  const L1 = Math.max(0.01, L2 - l);
  const theta0 = 2 * Math.PI * (rBot / L2);

  const positions: number[] = [];
  const indices: number[] = [];

  for (let j = 0; j <= Ns; j++) {
    const s = j / Ns; // 0 at top, 1 at bottom
    const curR = rTop + s * (rBot - rTop);
    const curL = L1 + s * (L2 - L1);

    for (let i = 0; i <= Nu; i++) {
      const u = -1 + (i / Nu) * 2;

      // 3D
      const phi3D = u * Math.PI;
      const x3D = curR * Math.sin(phi3D);
      const y3D = h / 2 - s * h;
      const z3D = curR * (Math.cos(phi3D) - 1);

      // 2D Flat
      const theta2D = u * (theta0 / 2);
      const x2D = curL * Math.sin(theta2D);
      const y2D = h / 2 + L2 / 2 - curL * Math.cos(theta2D);
      const z2D = 0;

      const x = (1 - t) * x3D + t * x2D;
      const y = (1 - t) * y3D + t * y2D;
      const z = (1 - t) * z3D + t * z2D;

      positions.push(x, y, z);
    }
  }

  for (let j = 0; j < Ns; j++) {
    for (let i = 0; i < Nu; i++) {
      const a = j * (Nu + 1) + i;
      const b = (j + 1) * (Nu + 1) + i;
      const c = (j + 1) * (Nu + 1) + (i + 1);
      const d = j * (Nu + 1) + (i + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/* ============================================================
   MODULE 6 — KHỐI TRÒN XOAY (Lớp 12, 3D)
   ============================================================ */
function RevolutionModule() {
  const [shape, setShape] = useState<"cylinder" | "cone" | "frustum" | "sphere">("cylinder");
  const [r, setR] = useState(1.5);
  const [rTop, setRTop] = useState(0.7);
  const [h, setH] = useState(3);
  const [unfoldMode, setUnfoldMode] = useState<"net" | "explode">("net");
  const [unfold, setUnfold] = useState(0); // 0 = 3D Solid, 1 = Flat Unfolded
  const [isPlaying, setIsPlaying] = useState(false);
  const [showCross, setShowCross] = useState(false);
  const [crossT, setCrossT] = useState(0.5);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Face & Object Color Visibility States
  const [showFaces, setShowFaces] = useState(true);
  const [showLateralColor, setShowLateralColor] = useState(true);
  const [showCapColor, setShowCapColor] = useState(true);
  const [faceOpacity, setFaceOpacity] = useState(0.55);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const { groupRef, resetView, setPreset, toggleAutoRotate, autoRotate } = useOrbitScene(containerRef);

  useEffect(() => {
    if (!isFullScreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullScreen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullScreen]);

  // Auto animation loop for unfolding
  useEffect(() => {
    if (!isPlaying) return;
    let forward = true;
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      setUnfold((prev) => {
        let next = prev + (forward ? 0.35 : -0.35) * dt;
        if (next >= 1) {
          next = 1;
          forward = false;
        } else if (next <= 0) {
          next = 0;
          forward = true;
        }
        return next;
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    clearGroup(group);

    const isSphere = shape === "sphere";
    const radiusTop = shape === "cone" ? 0 : shape === "frustum" ? rTop : r;
    const radiusBottom = r;

    const baseMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(COLORS.amber),
      transparent: true,
      opacity: faceOpacity,
      roughness: 0.45,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const topCapMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(COLORS.cyan),
      transparent: true,
      opacity: Math.min(1, faceOpacity + 0.15),
      roughness: 0.35,
      metalness: 0.15,
      side: THREE.DoubleSide,
    });
    const botCapMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(COLORS.emerald),
      transparent: true,
      opacity: Math.min(1, faceOpacity + 0.15),
      roughness: 0.35,
      metalness: 0.15,
      side: THREE.DoubleSide,
    });

    if (unfold === 0) {
      // 1. LIỀN KHỐI 3D CHUẨN (CLOSED SOLID)
      if (isSphere) {
        if (showFaces && showLateralColor) {
          const mainGeom = new THREE.SphereGeometry(r, 48, 32);
          group.add(new THREE.Mesh(mainGeom, baseMat));
        }

        // Center marker O
        const centerMarker = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.amber) }));
        group.add(centerMarker);

        // Axis line (Trục đường kính thẳng đứng)
        const axisGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -r, 0), new THREE.Vector3(0, r, 0)]);
        const axisMat = new THREE.LineDashedMaterial({ color: new THREE.Color(COLORS.rose), dashSize: 0.15, gapSize: 0.08 });
        const axisLine = new THREE.Line(axisGeom, axisMat);
        axisLine.computeLineDistances();
        group.add(axisLine);
      } else if (shape === "cylinder" || shape === "frustum") {
        // Lateral body
        const bodyGeom = new THREE.CylinderGeometry(radiusTop, radiusBottom, h, 56, 1, true);
        if (showFaces && showLateralColor) {
          group.add(new THREE.Mesh(bodyGeom, baseMat));
        }

        // Top disc
        if (radiusTop > 0) {
          const topDisc = new THREE.Mesh(new THREE.CircleGeometry(radiusTop, 56), topCapMat);
          topDisc.rotation.x = -Math.PI / 2;
          topDisc.position.y = h / 2;
          if (showFaces && showCapColor) {
            group.add(topDisc);
          }

          const topPts: THREE.Vector3[] = [];
          for (let i = 0; i <= 64; i++) {
            const th = (i / 64) * Math.PI * 2;
            topPts.push(new THREE.Vector3(Math.cos(th) * radiusTop, h / 2, Math.sin(th) * radiusTop));
          }
          group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(topPts), new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.cyan), linewidth: 2 })));
        }

        // Bottom disc
        const botDisc = new THREE.Mesh(new THREE.CircleGeometry(radiusBottom, 56), botCapMat);
        botDisc.rotation.x = Math.PI / 2;
        botDisc.position.y = -h / 2;
        if (showFaces && showCapColor) {
          group.add(botDisc);
        }

        const botPts: THREE.Vector3[] = [];
        for (let i = 0; i <= 64; i++) {
          const th = (i / 64) * Math.PI * 2;
          botPts.push(new THREE.Vector3(Math.cos(th) * radiusBottom, -h / 2, Math.sin(th) * radiusBottom));
        }
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(botPts), new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.emerald), linewidth: 2 })));

        // Axis line
        const axisGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -h / 2, 0), new THREE.Vector3(0, h / 2, 0)]);
        const axisMat = new THREE.LineDashedMaterial({ color: new THREE.Color(COLORS.rose), dashSize: 0.15, gapSize: 0.08 });
        const axisLine = new THREE.Line(axisGeom, axisMat);
        axisLine.computeLineDistances();
        group.add(axisLine);

        // Center marker O'
        const topCenter = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.cyan) }));
        topCenter.position.y = h / 2;
        group.add(topCenter);
      } else if (shape === "cone") {
        // Lateral cone body
        const coneGeom = new THREE.CylinderGeometry(0, radiusBottom, h, 56, 1, true);
        if (showFaces && showLateralColor) {
          group.add(new THREE.Mesh(coneGeom, baseMat));
        }

        // Bottom disc
        const botDisc = new THREE.Mesh(new THREE.CircleGeometry(radiusBottom, 56), botCapMat);
        botDisc.rotation.x = Math.PI / 2;
        botDisc.position.y = -h / 2;
        if (showFaces && showCapColor) {
          group.add(botDisc);
        }

        const botPts: THREE.Vector3[] = [];
        for (let i = 0; i <= 64; i++) {
          const th = (i / 64) * Math.PI * 2;
          botPts.push(new THREE.Vector3(Math.cos(th) * radiusBottom, -h / 2, Math.sin(th) * radiusBottom));
        }
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(botPts), new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.emerald), linewidth: 2 })));

        // Axis line
        const apexPt = new THREE.Vector3(0, h / 2, 0);
        const axisGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -h / 2, 0), apexPt]);
        const axisMat = new THREE.LineDashedMaterial({ color: new THREE.Color(COLORS.rose), dashSize: 0.15, gapSize: 0.08 });
        const axisLine = new THREE.Line(axisGeom, axisMat);
        axisLine.computeLineDistances();
        group.add(axisLine);

        // Apex marker S
        const apexMesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.amber) }));
        apexMesh.position.copy(apexPt);
        group.add(apexMesh);
      }
    } else if (unfoldMode === "net") {
      // 2. TRẢI PHẲNG HÌNH HỌC (2D NET UNFOLDING)
      if (shape === "cylinder") {
        // Mặt xung quanh trải thành hình chữ nhật
        const sheetGeom = createUnfoldingCylinderGeometry(r, h, unfold);
        if (showFaces && showLateralColor) {
          const sheetMesh = new THREE.Mesh(sheetGeom, baseMat);
          group.add(sheetMesh);
        }
        group.add(new THREE.LineSegments(new THREE.EdgesGeometry(sheetGeom, 30), new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.amber) })));

        // Đáy trên lật mở
        const topGeom = createCylinderTopCapGeometry(r, h, unfold);
        if (showFaces && showCapColor) {
          group.add(new THREE.Mesh(topGeom, topCapMat));
        }
        group.add(new THREE.LineSegments(new THREE.EdgesGeometry(topGeom, 30), new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.cyan) })));

        // Đáy dưới lật mở
        const botGeom = createCylinderBottomCapGeometry(r, h, unfold);
        if (showFaces && showCapColor) {
          group.add(new THREE.Mesh(botGeom, botCapMat));
        }
        group.add(new THREE.LineSegments(new THREE.EdgesGeometry(botGeom, 30), new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.emerald) })));
      } else if (shape === "cone") {
        // Mặt nón trải thành hình quạt tròn
        const coneGeom = createUnfoldingConeGeometry(r, h, unfold);
        if (showFaces && showLateralColor) {
          group.add(new THREE.Mesh(coneGeom, baseMat));
        }
        group.add(new THREE.LineSegments(new THREE.EdgesGeometry(coneGeom, 25), new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.amber) })));

        // Đáy nón lật mở
        const botGeom = createConeBottomCapGeometry(r, h, unfold);
        if (showFaces && showCapColor) {
          group.add(new THREE.Mesh(botGeom, botCapMat));
        }
        group.add(new THREE.LineSegments(new THREE.EdgesGeometry(botGeom, 30), new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.emerald) })));
      } else if (shape === "frustum") {
        // Nón cụt trải thành vành quạt khuyên
        const frustumGeom = createUnfoldingFrustumGeometry(r, rTop, h, unfold);
        if (showFaces && showLateralColor) {
          group.add(new THREE.Mesh(frustumGeom, baseMat));
        }
        group.add(new THREE.LineSegments(new THREE.EdgesGeometry(frustumGeom, 25), new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.amber) })));

        // Đáy trên & dưới
        const topGeom = createCylinderTopCapGeometry(rTop, h, unfold);
        if (showFaces && showCapColor) {
          group.add(new THREE.Mesh(topGeom, topCapMat));
        }
        group.add(new THREE.LineSegments(new THREE.EdgesGeometry(topGeom, 30), new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.cyan) })));

        const botGeom = createCylinderBottomCapGeometry(r, h, unfold);
        if (showFaces && showCapColor) {
          group.add(new THREE.Mesh(botGeom, botCapMat));
        }
        group.add(new THREE.LineSegments(new THREE.EdgesGeometry(botGeom, 30), new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.emerald) })));
      } else {
        // Hình cầu trải các múi cầu (Sinusoidal Gore Strips)
        const gores = 8;
        const goreAngle = (Math.PI * 2) / gores;
        for (let g = 0; g < gores; g++) {
          const startA = g * goreAngle;
          const goreGeom = new THREE.SphereGeometry(r, 16, 16, startA, goreAngle, 0, Math.PI);
          const goreMesh = new THREE.Mesh(goreGeom, g % 2 === 0 ? topCapMat : botCapMat);

          const midA = startA + goreAngle / 2;
          const dR = unfold * 1.5;
          goreMesh.position.x = Math.sin(midA) * dR;
          goreMesh.position.z = Math.cos(midA) * dR;
          goreMesh.rotation.y = unfold * (g - gores / 2) * 0.15;
          if (showFaces && showLateralColor) {
            group.add(goreMesh);
          }
          group.add(new THREE.LineSegments(new THREE.EdgesGeometry(goreGeom, 30), new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.amber) })));
        }
      }
    } else {
      // 3. BÓC TÁCH DỜI KHÔNG GIAN (EXPLODED VIEW)
      const explodeY = unfold * 1.6;

      if (isSphere) {
        const northGeom = new THREE.SphereGeometry(r, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
        const northMesh = new THREE.Mesh(northGeom, topCapMat);
        northMesh.position.y = explodeY;
        if (showFaces && showLateralColor) group.add(northMesh);
        group.add(new THREE.LineSegments(new THREE.EdgesGeometry(northGeom, 30), new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.cyan) })));

        const southGeom = new THREE.SphereGeometry(r, 48, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
        const southMesh = new THREE.Mesh(southGeom, botCapMat);
        southMesh.position.y = -explodeY;
        if (showFaces && showLateralColor) group.add(southMesh);
        group.add(new THREE.LineSegments(new THREE.EdgesGeometry(southGeom, 30), new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.emerald) })));
      } else if (shape === "cylinder" || shape === "frustum") {
        const bodyGeom = new THREE.CylinderGeometry(radiusTop, radiusBottom, h, 56, 1, true);
        if (showFaces && showLateralColor) group.add(new THREE.Mesh(bodyGeom, baseMat));
        group.add(new THREE.LineSegments(new THREE.EdgesGeometry(bodyGeom, 25), new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.amber) })));

        if (radiusTop > 0) {
          const topDisc = new THREE.Mesh(new THREE.CircleGeometry(radiusTop, 56), topCapMat);
          topDisc.rotation.x = -Math.PI / 2;
          topDisc.position.y = h / 2 + explodeY;
          if (showFaces && showCapColor) group.add(topDisc);

          const topOutline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CircleGeometry(radiusTop, 56), 1), new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.cyan) }));
          topOutline.rotation.x = -Math.PI / 2;
          topOutline.position.y = h / 2 + explodeY;
          group.add(topOutline);
        }

        const botDisc = new THREE.Mesh(new THREE.CircleGeometry(radiusBottom, 56), botCapMat);
        botDisc.rotation.x = Math.PI / 2;
        botDisc.position.y = -h / 2 - explodeY;
        if (showFaces && showCapColor) group.add(botDisc);

        const botOutline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CircleGeometry(radiusBottom, 56), 1), new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.emerald) }));
        botOutline.rotation.x = Math.PI / 2;
        botOutline.position.y = -h / 2 - explodeY;
        group.add(botOutline);
      } else if (shape === "cone") {
        const coneGeom = new THREE.CylinderGeometry(0, radiusBottom, h, 56, 1, true);
        const coneMesh = new THREE.Mesh(coneGeom, baseMat);
        coneMesh.position.y = explodeY * 0.6;
        if (showFaces && showLateralColor) group.add(coneMesh);
        group.add(new THREE.LineSegments(new THREE.EdgesGeometry(coneGeom, 25), new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.amber) })));

        const botDisc = new THREE.Mesh(new THREE.CircleGeometry(radiusBottom, 56), botCapMat);
        botDisc.rotation.x = Math.PI / 2;
        botDisc.position.y = -h / 2 - explodeY;
        if (showFaces && showCapColor) group.add(botDisc);

        const botOutline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CircleGeometry(radiusBottom, 56), 1), new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.emerald) }));
        botOutline.rotation.x = Math.PI / 2;
        botOutline.position.y = -h / 2 - explodeY;
        group.add(botOutline);
      }
    }

    // Center point marker (Gốc toạ độ tâm O)
    const centerPoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 16, 16),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.rose) })
    );
    group.add(centerPoint);

    if (showCross && unfold === 0) {
      let yPos: number;
      let crossR: number;
      if (isSphere) {
        yPos = -r + crossT * 2 * r;
        crossR = Math.sqrt(Math.max(0, r * r - yPos * yPos));
      } else {
        yPos = -h / 2 + crossT * h;
        crossR = radiusBottom + crossT * (radiusTop - radiusBottom);
      }
      if (crossR > 0.01) {
        const discGeom = new THREE.CircleGeometry(crossR, 64);
        if (showFaces) {
          const disc = new THREE.Mesh(
            discGeom,
            new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.rose), transparent: true, opacity: 0.45, side: THREE.DoubleSide })
          );
          disc.rotation.x = -Math.PI / 2;
          disc.position.y = yPos;
          group.add(disc);
        }

        const discOutline = new THREE.LineSegments(
          new THREE.EdgesGeometry(discGeom, 1),
          new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.rose), linewidth: 2 })
        );
        discOutline.rotation.x = -Math.PI / 2;
        discOutline.position.y = yPos;
        group.add(discOutline);
      }
    }
  }, [shape, r, rTop, h, unfold, unfoldMode, showCross, crossT, showFaces, showLateralColor, showCapColor, faceOpacity, groupRef]);

  const l_cone = Math.sqrt(r * r + h * h);
  const l_frustum = Math.sqrt(h * h + (r - rTop) * (r - rTop));
  const coneSectorDeg = fmt((360 * r) / Math.max(0.1, l_cone), 1);
  let formulaLines: string[] = [];

  if (shape === "cylinder") {
    formulaLines = [
      `V = π·R²·h = π×${fmt(r)}²×${fmt(h)} ≈ ${fmt(Math.PI * r * r * h)}`,
      `Sxq (Hình chữ nhật 2πR × h) = 2π·R·h ≈ ${fmt(2 * Math.PI * r * h)}`,
      `Stp = 2π·R·h + 2π·R² ≈ ${fmt(2 * Math.PI * r * h + 2 * Math.PI * r * r)}`,
    ];
  } else if (shape === "cone") {
    formulaLines = [
      `V = (1/3)π·R²·h ≈ ${fmt((1 / 3) * Math.PI * r * r * h)}`,
      `l (đường sinh) = √(R²+h²) ≈ ${fmt(l_cone)}`,
      `Góc quạt khai triển θ = (R/l)·360° = ${coneSectorDeg}°`,
      `Sxq (Hình quạt tròn) = π·R·l ≈ ${fmt(Math.PI * r * l_cone)}`,
      `Stp = π·R·l + π·R² ≈ ${fmt(Math.PI * r * l_cone + Math.PI * r * r)}`,
    ];
  } else if (shape === "frustum") {
    formulaLines = [
      `V = (1/3)π·h·(R²+R·r+r²) ≈ ${fmt((1 / 3) * Math.PI * h * (r * r + r * rTop + rTop * rTop))}`,
      `l = √(h²+(R−r)²) ≈ ${fmt(l_frustum)}`,
      `Sxq (Vành quạt khuyên) = π·(R+r)·l ≈ ${fmt(Math.PI * (r + rTop) * l_frustum)}`,
    ];
  } else {
    formulaLines = [`V = (4/3)π·R³ ≈ ${fmt((4 / 3) * Math.PI * r * r * r)}`, `S mặt cầu = 4π·R² ≈ ${fmt(4 * Math.PI * r * r)}`];
  }

  const unfoldDesc =
    shape === "cylinder"
      ? "Khai triển phẳng: 1 Hình chữ nhật (Kích thước 2πR × h) + 2 Đáy hình tròn bán kính R"
      : shape === "cone"
      ? `Khai triển phẳng: 1 Hình quạt tròn (Bán kính l = ${fmt(l_cone)}, góc ở tâm θ = ${coneSectorDeg}°) + 1 Đáy hình tròn bán kính R`
      : shape === "frustum"
      ? "Khai triển phẳng: 1 Vành quạt khuyên + 2 Đáy tròn bán kính R và r"
      : "Khai triển phẳng: 8 Múi cầu đối xứng qua đường xích đạo";

  return (
    <div id="module-revolution" className="grid grid-cols-1 md:grid-cols-12 gap-3">
      <div className="md:col-span-8 flex flex-col gap-3">
        <Panel
          id="revolution-canvas-panel"
          title="KHÔNG GIAN 3D KHỐI TRÒN XOAY // WEBGL_3D"
          badge="3D_SOLID"
          isFullScreen={isFullScreen}
          onToggleFullScreen={() => setIsFullScreen((f) => !f)}
          onDownloadImage={() => downloadCanvas3D(containerRef.current, `khoi-tron-xoay-${shape}-${Date.now()}`)}
          downloadLabel="TẢI ẢNH 3D (PNG)"
          action={
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                id="btn-rev-autorotate"
                onClick={() => toggleAutoRotate()}
                className={`px-2 py-0.5 border rounded-2xs text-[10px] font-mono transition-colors active:scale-95 ${
                  autoRotate
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                }`}
                title="Bật/Tắt tự động xoay 360 độ"
              >
                {autoRotate ? "⏵ TỰ XOAY: ON" : "⏸ TỰ XOAY"}
              </button>
              <button
                type="button"
                id="btn-revolution-reset-view"
                onClick={() => resetView()}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-2xs text-[10px] font-mono transition-colors active:scale-95"
                title="Căn giữa lại khối 3D"
              >
                CĂN GIỮA // RESET
              </button>
            </div>
          }
        >
          <div className={`relative bg-slate-950 border border-slate-800/80 rounded-2xs overflow-hidden flex items-center justify-center ${isFullScreen ? "w-full flex-1 h-full min-h-0" : ""}`}>
            <div ref={containerRef} className={`w-full ${isFullScreen ? "h-full min-h-[calc(100vh-140px)]" : "h-[380px]"} cursor-grab active:cursor-grabbing`} />
            
            {/* Top HUD info tags */}
            <div className="absolute top-2 left-2 flex gap-1.5 font-mono text-[9px] pointer-events-none flex-wrap">
              <span className="bg-slate-900/90 border border-slate-800 text-cyan-400 px-1.5 py-0.5 rounded-2xs">
                XOAY 360° MỌI HƯỚNG
              </span>
              <span className="bg-amber-950/90 border border-amber-800/80 text-amber-300 px-1.5 py-0.5 rounded-2xs font-mono text-[9px]">
                MÀU MẶT 3D ({fmt(faceOpacity * 100, 0)}%)
              </span>
              <span className="bg-slate-900/90 border border-slate-800 text-slate-300 px-1.5 py-0.5 rounded-2xs">
                CUỘN ĐỂ ZOOM
              </span>
              {unfold > 0 ? (
                <span className="bg-amber-950/90 border border-amber-800 text-amber-300 px-1.5 py-0.5 rounded-2xs">
                  {unfoldMode === "net" ? "TRẢI PHẲNG" : "BÓC TÁCH"}: {fmt(unfold * 100, 0)}%
                </span>
              ) : (
                <span className="bg-slate-900/90 border border-slate-800 text-emerald-400 px-1.5 py-0.5 rounded-2xs">
                  KHỐI 3D LIỀN: O(0,0,0)
                </span>
              )}
            </div>

            {/* Quick Perspective Switcher Bar */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-1.5 bg-slate-900/90 border border-slate-800/90 p-1 rounded-xs backdrop-blur-sm">
              <span className="text-slate-400 text-[9px] font-mono px-1">GÓC NHÌN:</span>
              <button
                type="button"
                id="btn-rev-preset-iso"
                onClick={() => setPreset("iso")}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-2xs text-[9px] font-mono transition-colors active:scale-95"
              >
                3D Phối cảnh
              </button>
              <button
                type="button"
                id="btn-rev-preset-top"
                onClick={() => setPreset("top")}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-2xs text-[9px] font-mono transition-colors active:scale-95"
              >
                Từ trên (Top)
              </button>
              <button
                type="button"
                id="btn-rev-preset-bottom"
                onClick={() => setPreset("bottom")}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-2xs text-[9px] font-mono transition-colors active:scale-95"
              >
                Từ dưới (Bottom)
              </button>
              <button
                type="button"
                id="btn-rev-preset-front"
                onClick={() => setPreset("front")}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-2xs text-[9px] font-mono transition-colors active:scale-95"
              >
                Chính diện
              </button>
              <button
                type="button"
                id="btn-rev-preset-side"
                onClick={() => setPreset("side")}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-2xs text-[9px] font-mono transition-colors active:scale-95"
              >
                Bên hông
              </button>
            </div>
          </div>
        </Panel>
        <Formula id="revolution-formulas" title="CÔNG THỨC THỂ TÍCH & DIỆN TÍCH">
          {formulaLines.join("\n")}
        </Formula>
      </div>
      <div className="md:col-span-4">
        <Panel id="revolution-controls-panel" title="THAM SỐ KHỐI TRÒN XOAY" badge="SOLID_CTRL">
          <SectionLabel iconColor="bg-indigo-500">LOẠI HÌNH TRÒN XOAY</SectionLabel>
          <ChipGroup
            id="rev-shape-chips"
            value={shape}
            onChange={setShape}
            options={[
              { value: "cylinder", label: "Hình trụ" },
              { value: "cone", label: "Hình nón" },
              { value: "frustum", label: "Nón cụt" },
              { value: "sphere", label: "Hình cầu" },
            ]}
          />

          <SectionLabel iconColor="bg-amber-500">MÀU SẮC BỀ MẶT 3D // OBJECT COLOR</SectionLabel>
          <div className="flex flex-col gap-2 p-2.5 bg-slate-900/70 border border-slate-800/90 rounded-2xs mb-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>Độ đậm màu sắc (Opacity):</span>
                <span className="text-amber-400 font-bold">{fmt(faceOpacity * 100, 0)}%</span>
              </div>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { val: 0.2, label: "20% Mờ" },
                    { val: 0.45, label: "45% Nhẹ" },
                    { val: 0.65, label: "65% Vừa" },
                    { val: 0.88, label: "88% Đậm" },
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => setFaceOpacity(item.val)}
                      className={`py-1 rounded-2xs text-[9px] font-mono border transition-colors ${
                        Math.abs(faceOpacity - item.val) < 0.08
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold"
                          : "bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowLateralColor(!showLateralColor)}
                    className={`py-1 px-1.5 rounded-2xs text-[9px] font-mono border text-center flex flex-col items-center justify-center ${
                      showLateralColor
                        ? "bg-amber-500/15 text-amber-300 border-amber-500/40 font-bold"
                        : "bg-slate-900 text-slate-500 border-slate-800"
                    }`}
                    title="Bật/Tắt màu sắc mặt xung quanh"
                  >
                    <span>Mặt xung quanh</span>
                    <span className="text-[10px]">{showLateralColor ? "✓ BẬT" : "✕ TẮT"}</span>
                  </button>
                  {shape !== "sphere" && (
                    <button
                      type="button"
                      onClick={() => setShowCapColor(!showCapColor)}
                      className={`py-1 px-1.5 rounded-2xs text-[9px] font-mono border text-center flex flex-col items-center justify-center ${
                        showCapColor
                          ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/40 font-bold"
                          : "bg-slate-900 text-slate-500 border-slate-800"
                      }`}
                      title="Bật/Tắt màu sắc các mặt đáy"
                    >
                      <span>Mặt đáy</span>
                      <span className="text-[10px]">{showCapColor ? "✓ BẬT" : "✕ TẮT"}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

          <SectionLabel iconColor="bg-amber-500">TRẢI PHẲNG HÌNH HỌC // NET UNFOLDING</SectionLabel>
          <div className="flex flex-col gap-2 p-2.5 bg-slate-900/70 border border-slate-800/90 rounded-2xs mb-2">
            {/* Mode selection tabs */}
            <div className="flex bg-slate-950 p-0.5 rounded-2xs border border-slate-800">
              <button
                type="button"
                id="btn-rev-mode-net"
                onClick={() => setUnfoldMode("net")}
                className={`flex-1 py-1 text-[10px] font-mono rounded-2xs transition-colors ${
                  unfoldMode === "net" ? "bg-amber-500/25 text-amber-300 font-bold border border-amber-500/40" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                1. Trải hình phẳng (2D Net)
              </button>
              <button
                type="button"
                id="btn-rev-mode-explode"
                onClick={() => setUnfoldMode("explode")}
                className={`flex-1 py-1 text-[10px] font-mono rounded-2xs transition-colors ${
                  unfoldMode === "explode" ? "bg-cyan-500/25 text-cyan-300 font-bold border border-cyan-500/40" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                2. Bóc tách dời 3D
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-mono text-slate-300">
                {unfoldMode === "net" ? "Độ trải phẳng (Unfold Progress)" : "Khoảng cách dãn bóc tách"}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono text-amber-400 font-bold">{fmt(unfold * 100, 0)}%</span>
                <button
                  type="button"
                  id="btn-rev-play-anim"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`px-1.5 py-0.5 rounded-2xs text-[9px] font-mono border transition-colors ${
                    isPlaying ? "bg-rose-500/20 text-rose-300 border-rose-500/50" : "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                  }`}
                  title="Tự động mở/gập hình liên tục"
                >
                  {isPlaying ? "⏸ DỪNG" : "▶ TỰ CHẠY"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1 pt-1">
              <button
                type="button"
                id="btn-rev-unfold-0"
                onClick={() => { setIsPlaying(false); setUnfold(0); }}
                className={`py-1 rounded-2xs text-[9px] font-mono border transition-colors ${
                  unfold === 0 ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold" : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                }`}
              >
                0% Khối 3D
              </button>
              <button
                type="button"
                id="btn-rev-unfold-35"
                onClick={() => { setIsPlaying(false); setUnfold(0.35); }}
                className={`py-1 rounded-2xs text-[9px] font-mono border transition-colors ${
                  Math.abs(unfold - 0.35) < 0.05 ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold" : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                }`}
              >
                35% Mở hé
              </button>
              <button
                type="button"
                id="btn-rev-unfold-70"
                onClick={() => { setIsPlaying(false); setUnfold(0.7); }}
                className={`py-1 rounded-2xs text-[9px] font-mono border transition-colors ${
                  Math.abs(unfold - 0.7) < 0.05 ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold" : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                }`}
              >
                70% Mở rộng
              </button>
              <button
                type="button"
                id="btn-rev-unfold-100"
                onClick={() => { setIsPlaying(false); setUnfold(1); }}
                className={`py-1 rounded-2xs text-[9px] font-mono border transition-colors ${
                  unfold === 1 ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold" : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                }`}
              >
                100% Trải 2D
              </button>
            </div>

            <div className="text-[10px] font-mono text-slate-300 mt-1 leading-relaxed bg-slate-950/80 p-2 rounded-2xs border border-slate-800/80">
              <span className="text-amber-400 font-semibold">Hình học khai triển: </span>
              {unfoldDesc}
            </div>
          </div>

          <SectionLabel iconColor="bg-cyan-500">HỘP NHẬP KÍCH THƯỚC</SectionLabel>
          <NumberInput
            id="input-rev-r"
            label={shape === "frustum" ? "Bán kính đáy lớn R" : shape === "sphere" ? "Bán kính R" : "Bán kính đáy R"}
            value={r}
            min={0.5}
            max={5}
            step={0.1}
            onChange={setR}
            color="cyan"
            quickOptions={[1, 1.5, 2, 2.5, 3]}
          />
          {shape === "frustum" && (
            <NumberInput
              id="input-rev-rtop"
              label="Bán kính đáy nhỏ r"
              value={rTop}
              min={0.2}
              max={r - 0.1 > 0.2 ? r - 0.1 : 0.2}
              step={0.1}
              onChange={setRTop}
              color="emerald"
              quickOptions={[0.5, 0.8, 1, 1.2]}
            />
          )}
          {shape !== "sphere" && (
            <NumberInput
              id="input-rev-h"
              label="Chiều cao h"
              value={h}
              min={0.5}
              max={8}
              step={0.1}
              onChange={setH}
              color="amber"
              quickOptions={[2, 2.5, 3, 3.5, 4]}
            />
          )}
          
          <SectionLabel iconColor="bg-rose-500">THIẾT DIỆN VUÔNG GÓC TRỤC</SectionLabel>
          <ToggleRow id="toggle-rev-cross" label="Hiện mặt cắt vuông góc trục" checked={showCross} onChange={setShowCross} />
          {showCross && (
            <NumberInput
              id="input-rev-crosst"
              label="Vị trí mặt cắt (0→1)"
              value={crossT}
              min={0}
              max={1}
              step={0.05}
              onChange={setCrossT}
              color="rose"
              quickOptions={[0.2, 0.5, 0.8]}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ============================================================
   MODULE 7 — KHỐI ĐA DIỆN (Lớp 11–12, 3D)
   ============================================================ */
// Note: PolyhedraModule is modularized in src/components/PolyhedraModule.tsx


/* ============================================================
   MODULE REGISTRY + HIGH DENSITY APP SHELL
   ============================================================ */
const MODULES = [
  {
    id: "function",
    name: "Đồ thị hàm số",
    grade: "Lớp 10–12",
    tag: "2D",
    status: "ACTIVE",
    icon: Icon.Curve,
    Component: FunctionModule,
    desc: "Khảo sát và vẽ đồ thị hàm số: Bậc hai, Bậc ba, Trùng phương bậc bốn, Phân thức bậc nhất/nhất, Phân thức bậc hai/nhất, lượng giác. Tự động xuất Đạo hàm, Bảng biến thiên (BBT), Tọa độ đỉnh, Cực trị, Trục đối xứng, Tiệm cận và Khoảng đồng biến/nghịch biến.",
    theory:
      "Khảo sát hàm số y = f(x) theo chương trình GDPT 2018: Xét tập xác định, tính đạo hàm y' = f'(x), tìm nghiệm đạo hàm và các điểm không xác định, lập Bảng biến thiên (BBT) thể hiện chiều biến thiên (đồng biến/nghịch biến), xác định tọa độ các điểm cực trị (CĐ, CT), đỉnh parabol, tâm/trục đối xứng và các đường tiệm cận (đứng, ngang, xiên).",
  },
  {
    id: "circle",
    name: "Đường tròn lượng giác",
    grade: "Lớp 10–11",
    tag: "2D",
    status: "OK",
    icon: Icon.Circle,
    Component: CircleModule,
    desc: "Kéo điểm trên đường tròn đơn vị để quan sát mối liên hệ giữa góc và các giá trị sin, cos, tan.",
    theory:
      "Trên đường tròn lượng giác tâm O(0;0), bán kính R = 1, điểm M ứng với góc lượng giác θ có toạ độ M(cos θ; sin θ). Do đó, trục Ox là trục cosin, Oy là trục sin, và tan θ = sin θ / cos θ (với cos θ ≠ 0).",
  },
  {
    id: "vector",
    name: "Vectơ trong mặt phẳng",
    grade: "Lớp 10",
    tag: "2D",
    status: "OK",
    icon: Icon.Vector,
    Component: VectorModule,
    desc: "Cộng, trừ hai vectơ theo quy tắc hình bình hành, tính tích vô hướng và góc giữa hai vectơ.",
    theory:
      "Tổng a+b dựng theo quy tắc hình bình hành; hiệu a−b nối từ ngọn của b sang ngọn của a (quy tắc 3 điểm: OA − OB = BA). Tích vô hướng a·b = |a|·|b|·cos θ; hai vectơ vuông góc nhau khi và chỉ khi a·b = 0.",
  },
  {
    id: "derivative",
    name: "Đạo hàm & tiếp tuyến",
    grade: "Lớp 11",
    tag: "2D",
    status: "OK",
    icon: Icon.Tangent,
    Component: DerivativeModule,
    desc: "Chọn điểm x₀ trên đồ thị, quan sát hệ số góc tiếp tuyến và minh hoạ định nghĩa đạo hàm qua giới hạn cát tuyến.",
    theory:
      "Đạo hàm f'(x₀) = lim(Δx→0) [f(x₀+Δx) − f(x₀)] / Δx là hệ số góc của tiếp tuyến tại tiếp điểm M(x₀; f(x₀)). Phương trình tiếp tuyến: y = f'(x₀)(x − x₀) + f(x₀).",
  },
  {
    id: "integral",
    name: "Tích phân & diện tích",
    grade: "Lớp 12",
    tag: "2D",
    status: "OK",
    icon: Icon.Integral,
    Component: IntegralModule,
    desc: "Thay đổi cận tích phân a, b để quan sát mối liên hệ giữa tích phân xác định và diện tích miền phẳng S = ∫|f(x)|dx.",
    theory:
      "Công thức Newton–Leibniz: ∫ₐᵇ f(x)dx = F(b) − F(a), với F(x) là một nguyên hàm của f(x). Diện tích hình phẳng giới hạn bởi y = f(x), y = 0, x = a, x = b được tính bởi S = ∫ₐᵇ |f(x)|dx.",
  },
  {
    id: "revolution",
    name: "Khối tròn xoay (3D)",
    grade: "Lớp 12",
    tag: "3D",
    status: "OK",
    icon: Icon.Cone,
    Component: RevolutionModule,
    desc: "Dựng hình trụ, nón, nón cụt và hình cầu trong không gian 3D; quan sát mặt cắt và công thức thể tích/diện tích.",
    theory:
      "Khối tròn xoay hình thành khi quay một hình phẳng quanh một trục cố định. Hình trụ: V = πR²h; Hình nón: V = (1/3)πR²h, đường sinh l = √(R²+h²); Khối cầu: V = (4/3)πR³, S = 4πR².",
  },
  {
    id: "polyhedra",
    name: "Khối đa diện (3D)",
    grade: "Lớp 11–12",
    tag: "3D",
    status: "OK",
    icon: Icon.Cube,
    Component: PolyhedraModule,
    desc: "Dựng hình chóp và lăng trụ đều với số cạnh đáy tuỳ chọn, xoay 3D và xem thiết diện song song với đáy.",
    theory:
      "Thể tích khối chóp: V = (1/3)·Sđáy·h; Thể tích khối lăng trụ: V = Sđáy·h. Thiết diện song song đáy của hình chóp là đa giác đồng dạng với đáy theo tỉ số khoảng cách từ đỉnh.",
  },
];

export default function App() {
  const { theme, isDark, colors, toggleTheme, setTheme } = useTheme();
  setGlobalThemeColors(colors);

  const [activeId, setActiveId] = useState("function");
  const [currentTime, setCurrentTime] = useState("");
  const active = MODULES.find((m) => m.id === activeId) || MODULES[0];
  const ActiveComponent = active.Component;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      setCurrentTime(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      id="app-root"
      className={`min-h-screen ${isDark ? "bg-[#020617] text-slate-300" : "bg-[#f8fafc] text-slate-800"} font-sans flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200 transition-colors duration-150`}
    >
      {/* ============================================================
          TOP TELEMETRY HEADER BAR (HIGH DENSITY HUD)
          ============================================================ */}
      <header className="h-11 border-b border-slate-800 bg-slate-900/70 backdrop-blur flex items-center justify-between px-3 sm:px-4 shrink-0 font-mono select-none sticky top-0 z-40 transition-colors duration-150">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse"></div>
            <span className="font-bold text-slate-100 text-xs sm:text-sm tracking-tight font-mono">
              CONG CU TOAN HVT
            </span>
          </div>
          <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block"></div>
          <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-400">
            <span className="bg-slate-800/90 border border-slate-700/60 px-1.5 py-0.5 rounded text-emerald-400">
              UPLINK: ACTIVE
            </span>
            <span className="bg-slate-800/90 border border-slate-700/60 px-1.5 py-0.5 rounded text-slate-300">
              ENGINE: WEBGL/SVG
            </span>
            <span className="hidden md:inline bg-slate-800/90 border border-slate-700/60 px-1.5 py-0.5 rounded text-amber-400">
              MODULES: 7/7 READY
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-5 text-[10px] font-mono">
          {/* THEME TOGGLE / TÙY CHỈNH GIAO DIỆN SÁNG - TỐI */}
          <div
            id="theme-toggle-container"
            className={`flex items-center rounded-xs p-0.5 border ${
              isDark ? "bg-slate-950/80 border-slate-700/80" : "bg-white border-slate-300 shadow-xs"
            }`}
          >
            <button
              type="button"
              id="theme-toggle-btn-dark"
              onClick={() => setTheme("dark")}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-3xs transition-all cursor-pointer select-none text-[10.5px] ${
                isDark
                  ? "bg-slate-800 text-amber-300 font-bold border border-amber-500/50 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Chuyển sang Giao diện Tối (Dark mode)"
            >
              <Moon className="w-3 h-3" />
              <span>TỐI</span>
            </button>
            <button
              type="button"
              id="theme-toggle-btn-light"
              onClick={() => setTheme("light")}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-3xs transition-all cursor-pointer select-none text-[10.5px] ${
                !isDark
                  ? "bg-amber-50 text-amber-700 font-bold border border-amber-400 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Chuyển sang Giao diện Sáng (Light mode)"
            >
              <Sun className="w-3 h-3" />
              <span>SÁNG</span>
            </button>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-slate-500 uppercase leading-none text-[8px] tracking-wider">SYS TIME</span>
            <span className="text-slate-200 font-bold tracking-tight">{currentTime || "LIVE"}</span>
          </div>
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-slate-500 uppercase leading-none text-[8px] tracking-wider">KERNEL</span>
            <span className="text-emerald-400 font-bold">v4.2.0-MATH</span>
          </div>
        </div>
      </header>

      {/* ============================================================
          TOP HORIZONTAL MODULE NAVIGATION BAR (7 CHUYÊN ĐỀ GDPT 2018)
          ============================================================ */}
      <div id="top-module-nav" className="bg-slate-900/80 border-b border-slate-800 px-3 py-2 shrink-0 z-30 sticky top-11 backdrop-blur-md">
        <div className="max-w-[1700px] mx-auto">
          {/* Module tabs horizontal row */}
          <nav className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar font-mono">
            {MODULES.map((m) => {
              const IconC = m.icon;
              const isActive = m.id === activeId;
              return (
                <button
                  key={m.id}
                  id={`nav-tab-${m.id}`}
                  type="button"
                  onClick={() => setActiveId(m.id)}
                  className={`flex-1 min-w-[140px] max-w-[240px] flex items-center justify-between px-3 py-2 rounded-xs border transition-all cursor-pointer select-none text-left ${
                    isActive
                      ? "bg-slate-800/95 border-emerald-500/70 text-slate-100 shadow-[0_0_12px_rgba(16,185,129,0.18)] ring-1 ring-emerald-500/30"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className={`shrink-0 ${isActive ? "text-emerald-400" : "text-slate-500"}`}>
                      <IconC />
                    </span>
                    <span className={`text-xs truncate ${isActive ? "font-bold text-slate-100" : "font-medium"}`}>
                      {m.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-1.5">
                    <span
                      className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded font-mono ${
                        isActive
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-slate-800/80 text-slate-400 border border-slate-700/50"
                      }`}
                    >
                      {m.tag}
                    </span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ============================================================
          MAIN WORKSPACE LAYOUT (FULL-WIDTH EXPANDED VIEW)
          ============================================================ */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main Work Area */}
        <main id="main-content" className="flex-1 p-3 sm:p-4 overflow-y-auto max-w-[1700px] mx-auto w-full">
          {/* Breadcrumb & Module Header */}
          <div className="mb-3 bg-slate-900/40 border border-slate-800 p-3 rounded-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-slate-100 font-sans tracking-tight m-0">
                  {active.name}
                </h1>
                <span className="font-mono text-[10px] text-emerald-400 border border-emerald-500/40 bg-emerald-500/10 rounded px-1.5 py-0.2">
                  {active.grade}
                </span>
                <span className="font-mono text-[10px] text-cyan-400 border border-cyan-500/40 bg-cyan-500/10 rounded px-1.5 py-0.2">
                  MODE: {active.tag}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-sans leading-relaxed">{active.desc}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 font-mono text-[10px]">
              <span className="text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                CHƯƠNG TRÌNH CHUẨN GDPT 2018
              </span>
            </div>
          </div>

          {/* Active Interactive Module */}
          <ActiveComponent key={active.id} />
        </main>
      </div>
    </div>
  );
}
