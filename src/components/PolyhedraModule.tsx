import React, { useState, useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import katex from "katex";
import { Maximize2, Minimize2, Download } from "lucide-react";
import { downloadCanvas3D } from "../utils/exportImage";
import { useTheme, ThemeColors } from "../context/ThemeContext";

/* ============================================================
   DESIGN TOKENS & UTILITIES (ADAPTIVE THEME)
   ============================================================ */
let polyThemeColors: ThemeColors | null = null;
export function setPolyThemeColors(c: ThemeColors) {
  polyThemeColors = c;
}

const COLORS = {
  get bg() { return polyThemeColors ? polyThemeColors.bg : "#020617"; },
  get panel() { return polyThemeColors ? polyThemeColors.panel : "rgba(15, 23, 42, 0.65)"; },
  get panelSolid() { return polyThemeColors ? polyThemeColors.panelSolid : "#0f172a"; },
  get border() { return polyThemeColors ? polyThemeColors.border : "#1e293b"; },
  get borderLight() { return polyThemeColors ? polyThemeColors.borderLight : "#334155"; },
  get text() { return polyThemeColors ? polyThemeColors.text : "#f8fafc"; },
  get textSecondary() { return polyThemeColors ? polyThemeColors.textSecondary : "#cbd5e1"; },
  get textMuted() { return polyThemeColors ? polyThemeColors.textMuted : "#94a3b8"; },
  get emerald() { return polyThemeColors ? polyThemeColors.emerald : "#10b981"; },
  get amber() { return polyThemeColors ? polyThemeColors.amber : "#f59e0b"; },
  get cyan() { return polyThemeColors ? polyThemeColors.cyan : "#06b6d4"; },
  get indigo() { return polyThemeColors ? polyThemeColors.indigo : "#6366f1"; },
  get rose() { return polyThemeColors ? polyThemeColors.rose : "#f43f5e"; },
  get purple() { return polyThemeColors ? polyThemeColors.purple : "#a855f7"; },
};

function fmt(n: number, d = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(d);
}

function MathDisplay({ tex, inline = false, className = "" }: { tex: string; inline?: boolean; className?: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, { displayMode: !inline, throwOnError: false });
    } catch {
      return tex;
    }
  }, [tex, inline]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function Panel({
  children,
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
                title="Tải xuống hình ảnh 3D định dạng PNG độ phân giải cao"
              >
                <Download className="w-3 h-3 text-emerald-400" />
                <span>{downloadLabel || "TẢI ẢNH 3D (PNG)"}</span>
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

function NumberInput({
  label,
  value,
  min,
  max,
  step = 0.1,
  onChange,
  id,
  color = "emerald",
  quickOptions,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  id?: string;
  color?: "emerald" | "amber" | "cyan" | "rose" | "purple";
  quickOptions?: number[];
}) {
  const colorMap = {
    emerald: "text-emerald-400 border-emerald-500/30 focus:border-emerald-500",
    amber: "text-amber-400 border-amber-500/30 focus:border-amber-500",
    cyan: "text-cyan-400 border-cyan-500/30 focus:border-cyan-500",
    rose: "text-rose-400 border-rose-500/30 focus:border-rose-500",
    purple: "text-purple-400 border-purple-500/30 focus:border-purple-500",
  };

  return (
    <div id={id} className="mb-2.5 bg-slate-950/40 p-2 rounded-xs border border-slate-800/60 font-mono">
      <div className="flex items-center justify-between mb-1 text-[11px]">
        <span className="text-slate-300 font-medium">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={value}
            step={step}
            min={min}
            max={max}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) onChange(Math.max(min, Math.min(max, val)));
            }}
            className={`w-16 bg-slate-900 border px-1.5 py-0.5 rounded-2xs text-right font-bold text-[11px] ${colorMap[color]}`}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
        />
      </div>
      {quickOptions && (
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {quickOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`text-[9px] px-1.5 py-0.5 rounded-2xs border transition-colors ${
                Math.abs(value - opt) < 0.01
                  ? "bg-slate-800 text-emerald-300 border-emerald-500/60 font-bold"
                  : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
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

function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  id,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (val: T) => void;
  id?: string;
}) {
  return (
    <div id={id} className="flex gap-1.5 flex-wrap mb-2.5">
      {options.map((o) => {
        const isSel = value === o.value;
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            className={`font-mono text-[10px] px-2 py-1 rounded-2xs border transition-all cursor-pointer ${
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
      className="flex items-center justify-between p-2 bg-slate-950/50 border border-slate-800/60 rounded-xs cursor-pointer mb-2.5 text-xs text-slate-200 select-none hover:bg-slate-900/60 transition-colors font-mono"
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

function Formula({ children, id, title = "CALC_MATRIX // OUTPUT" }: { children: React.ReactNode; id?: string; title?: string }) {
  return (
    <div
      id={id}
      className="font-mono text-[11px] bg-slate-950/90 border border-slate-800 rounded-xs p-2.5 text-slate-300 leading-relaxed shadow-inner"
    >
      <div className="flex items-center justify-between text-[9px] text-slate-500 uppercase tracking-widest border-b border-slate-900 pb-1 mb-1.5">
        <span className="text-emerald-400 font-bold">{title}</span>
        <span>STATUS: LIVE</span>
      </div>
      <pre className="whitespace-pre-wrap font-mono text-emerald-400/90 selection:bg-emerald-500/30">{children}</pre>
    </div>
  );
}

/* ============================================================
   3D LABEL SPRITE GENERATOR (BILLBOARD TEXT - CLEAN, NO BOX)
   ============================================================ */
function createTextSprite(text: string, color = "#f8fafc") {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Clear transparent background (No enclosing box or border)
    ctx.clearRect(0, 0, 128, 64);

    ctx.font = "bold 34px 'JetBrains Mono', 'IBM Plex Mono', monospace, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // High contrast dark stroke outline for crystal-clear readability without boxes
    ctx.strokeStyle = "rgba(2, 6, 23, 0.95)";
    ctx.lineWidth = 5;
    ctx.lineJoin = "round";
    ctx.strokeText(text, 64, 32);

    ctx.fillStyle = color;
    ctx.fillText(text, 64, 32);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(0.6, 0.3, 1);
  return sprite;
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
   TYPES FOR GEOMETRIC ELEMENTS & POLYHEDRA
   ============================================================ */
export type PolyCategory = "regular" | "custom_pyramid" | "custom_prism";
export type BaseShapeType =
  | "triangle_right"
  | "triangle_equilateral"
  | "triangle_general"
  | "quad_rect"
  | "quad_square"
  | "quad_parallelogram"
  | "quad_trapezoid";

export type ApexType = "sa_perp" | "face_perp" | "regular" | "custom_offset";
export type PrismType = "right" | "oblique" | "cuboid";

export interface GeoPoint {
  id: string;
  name: string;
  type: "midpoint" | "ratio" | "line_point" | "plane_point" | "centroid" | "parallel_point" | "perp_proj" | "custom_xyz";
  p1?: string;
  p2?: string;
  ratio?: number;
  lineP1?: string;
  lineP2?: string;
  lineT?: number;
  triangle?: [string, string, string];
  barycentric?: [number, number, number];
  parallelRef?: { throughPoint: string; parallelToP1: string; parallelToP2: string; scale?: number };
  perpProjRef?: { fromPoint: string; toLineP1: string; toLineP2: string };
  customPos?: { x: number; y: number; z: number };
  color: string;
}

export type PointConstraint =
  | {
      type: "segment";
      p1Name: string;
      p2Name: string;
      label: string;
      priority: 1;
    }
  | {
      type: "line";
      p1Name?: string;
      p2Name?: string;
      origin?: THREE.Vector3;
      direction?: THREE.Vector3;
      label: string;
      priority: 2;
    }
  | {
      type: "plane";
      p0Pos?: THREE.Vector3;
      p0Name?: string;
      normal?: THREE.Vector3;
      planePts?: [string, string, string];
      label: string;
      priority: 3;
    };

export interface InteractivePointMeta {
  id: string;
  name: string;
  pos: THREE.Vector3;
  color: string;
  constraint: PointConstraint;
  isCustom: boolean;
  baseVertexName?: string;
  isApex?: boolean;
}

export interface GeoLine {
  id: string;
  p1: string;
  p2: string;
  style: "solid" | "dashed";
  color: string;
  width: number;
}

export interface GeoPlane {
  id: string;
  name: string;
  points: string[];
  color: string;
  opacity: number;
}

const SIDE_NAMES: Record<number, string> = { 3: "tam giác", 4: "tứ giác", 5: "ngũ giác", 6: "lục giác" };

/* ============================================================
   MAIN COMPONENT: POLYHEDRA MODULE
   ============================================================ */
export function PolyhedraModule() {
  const { colors, isDark } = useTheme();
  setPolyThemeColors(colors);

  // Main Category & Sub-modes
  const [category, setCategory] = useState<PolyCategory>("custom_pyramid");
  const [activeTab, setActiveTab] = useState<"shape" | "draw" | "unfold">("shape");
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    if (!isFullScreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullScreen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullScreen]);

  // 1. Regular Solid States
  const [regType, setRegType] = useState<"pyramid" | "prism">("pyramid");
  const [regN, setRegN] = useState<number>(4);
  const [regR, setRegR] = useState(1.8);
  const [regH, setRegH] = useState(3.0);

  // 2. Custom Pyramid States
  const [pyrApexType, setPyrApexType] = useState<ApexType>("sa_perp");
  const [pyrBaseShape, setPyrBaseShape] = useState<BaseShapeType>("triangle_right");
  const [pyrA, setPyrA] = useState(2.8);
  const [pyrB, setPyrB] = useState(2.2);
  const [pyrAngle, setPyrAngle] = useState(60);
  const [pyrH, setPyrH] = useState(3.2);
  const [pyrApexDx, setPyrApexDx] = useState(0);
  const [pyrApexDz, setPyrApexDz] = useState(0);

  // 3. Custom Prism States
  const [prismKind, setPrismKind] = useState<PrismType>("right");
  const [prismBaseShape, setPrismBaseShape] = useState<BaseShapeType>("triangle_right");
  const [prismA, setPrismA] = useState(2.6);
  const [prismB, setPrismB] = useState(2.2);
  const [prismAngle, setPrismAngle] = useState(60);
  const [prismH, setPrismH] = useState(3.0);
  const [prismSlantDx, setPrismSlantDx] = useState(1.0);
  const [prismSlantDz, setPrismSlantDz] = useState(0.4);

  // 4. Drawing Geometric Elements (Points, Lines, Planes)
  const [customPoints, setCustomPoints] = useState<GeoPoint[]>([
    { id: "pt_m", name: "M", type: "ratio", p1: "S", p2: "A", ratio: 0.5, color: COLORS.cyan },
    { id: "pt_n", name: "N", type: "ratio", p1: "S", p2: "B", ratio: 0.5, color: COLORS.cyan },
    { id: "pt_p", name: "P", type: "ratio", p1: "S", p2: "C", ratio: 0.5, color: COLORS.cyan },
  ]);

  const [customLines, setCustomLines] = useState<GeoLine[]>([
    { id: "ln_mn", p1: "M", p2: "N", style: "dashed", color: COLORS.cyan, width: 2 },
    { id: "ln_np", p1: "N", p2: "P", style: "dashed", color: COLORS.cyan, width: 2 },
    { id: "ln_pm", p1: "P", p2: "M", style: "dashed", color: COLORS.cyan, width: 2 },
  ]);

  const [customPlanes, setCustomPlanes] = useState<GeoPlane[]>([
    { id: "pl_mnp", name: "(MNP)", points: ["M", "N", "P"], color: COLORS.cyan, opacity: 0.4 },
  ]);

  // Offsets for draggable base vertices (constrained to base plane Priority 3)
  const [baseOffsets, setBaseOffsets] = useState<Record<string, { x: number; z: number }>>({});
  const [hoveredPoint, setHoveredPoint] = useState<InteractivePointMeta | null>(null);
  const [activeDragInfo, setActiveDragInfo] = useState<{
    name: string;
    label: string;
    priority: 1 | 2 | 3;
    details: string;
  } | null>(null);

  // Form states for creating new elements
  const [newPtName, setNewPtName] = useState("K");
  const [newPtType, setNewPtType] = useState<"segment" | "line" | "plane" | "centroid" | "parallel_point" | "perp_proj" | "custom_xyz">("segment");
  const [newPtP1, setNewPtP1] = useState("S");
  const [newPtP2, setNewPtP2] = useState("C");
  const [newPtRatio, setNewPtRatio] = useState(0.5);
  const [newPtLineP1, setNewPtLineP1] = useState("S");
  const [newPtLineP2, setNewPtLineP2] = useState("A");
  const [newPtPlaneTri, setNewPtPlaneTri] = useState<[string, string, string]>(["A", "B", "C"]);
  const [newPtTri, setNewPtTri] = useState<[string, string, string]>(["A", "B", "C"]);
  const [newPtParThrough, setNewPtParThrough] = useState("M");
  const [newPtParP1, setNewPtParP1] = useState("A");
  const [newPtParP2, setNewPtParP2] = useState("B");
  const [newPtParScale, setNewPtParScale] = useState(1.0);
  const [newPtPerpFrom, setNewPtPerpFrom] = useState("S");
  const [newPtPerpTo1, setNewPtPerpTo1] = useState("A");
  const [newPtPerpTo2, setNewPtPerpTo2] = useState("B");
  const [newPtX, setNewPtX] = useState(0);
  const [newPtY, setNewPtY] = useState(0);
  const [newPtZ, setNewPtZ] = useState(0);

  const [newLineP1, setNewLineP1] = useState("A");
  const [newLineP2, setNewLineP2] = useState("C");
  const [newLineStyle, setNewLineStyle] = useState<"solid" | "dashed">("dashed");
  const [newLineColor, setNewLineColor] = useState(COLORS.amber);

  const [newPlanePts, setNewPlanePts] = useState<string>("M,N,P");
  const [newPlaneColor, setNewPlaneColor] = useState(COLORS.rose);

  // Unfolding / Cross Section States
  const [unfoldMode, setUnfoldMode] = useState<"net" | "explode">("net");
  const [unfold, setUnfold] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showCross, setShowCross] = useState(false);
  const [crossT, setCrossT] = useState(0.5);

  // Face Shading & Color Visibility State
  const [showFaces, setShowFaces] = useState<boolean>(true);
  const [faceOpacity, setFaceOpacity] = useState<number>(0.5);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const resetRef = useRef<(() => void) | null>(null);
  const presetRef = useRef<((preset: "iso" | "top" | "bottom" | "front" | "side") => void) | null>(null);
  const autoRotateRef = useRef<boolean>(false);
  const [autoRotate, setAutoRotate] = useState(false);

  // Interactive Dragging References to avoid stale closures in event listeners
  const hitMeshesRef = useRef<THREE.Mesh[]>([]);
  const hitMeshToMetaRef = useRef<Map<THREE.Object3D, InteractivePointMeta>>(new Map());
  const interactiveMetasRef = useRef<InteractivePointMeta[]>([]);
  const draggedMetaRef = useRef<InteractivePointMeta | null>(null);
  const isDraggingPointRef = useRef<boolean>(false);

  // Sync latest state to refs for real-time drag calculation
  const customPointsRef = useRef(customPoints);
  customPointsRef.current = customPoints;
  const baseOffsetsRef = useRef(baseOffsets);
  baseOffsetsRef.current = baseOffsets;
  const unoffsetBasePosMapRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const pyrApexDxRef = useRef(pyrApexDx);
  pyrApexDxRef.current = pyrApexDx;
  const pyrApexDzRef = useRef(pyrApexDz);
  pyrApexDzRef.current = pyrApexDz;
  const pyrHRef = useRef(pyrH);
  pyrHRef.current = pyrH;
  const regHRef = useRef(regH);
  regHRef.current = regH;
  const categoryRef = useRef(category);
  categoryRef.current = category;
  const pyrApexTypeRef = useRef(pyrApexType);
  pyrApexTypeRef.current = pyrApexType;
  const pointMapRef = useRef<Map<string, THREE.Vector3>>(new Map());

  // 3D Scene Initialization
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / Math.max(container.clientHeight, 1), 0.1, 100);
    let dist = 8.5;
    camera.position.set(4.5, 3.2, 5.8);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

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
    scene.add(group);
    groupRef.current = group;

    let draggingScene = false;
    let prevX = 0;
    let prevY = 0;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const resetView = () => {
      group.quaternion.setFromEuler(new THREE.Euler(-0.35, 0.6, 0));
      dist = 8.5;
      const dir = new THREE.Vector3(4.5, 3.2, 5.8).normalize();
      camera.position.copy(dir.multiplyScalar(dist));
      camera.lookAt(0, 0, 0);
    };
    resetRef.current = resetView;

    const setPreset = (preset: "iso" | "top" | "bottom" | "front" | "side") => {
      switch (preset) {
        case "top":
          group.quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
          break;
        case "bottom":
          group.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
          break;
        case "front":
          group.quaternion.setFromEuler(new THREE.Euler(0, 0, 0));
          break;
        case "side":
          group.quaternion.setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
          break;
        case "iso":
        default:
          group.quaternion.setFromEuler(new THREE.Euler(-0.35, 0.6, 0));
          break;
      }
    };
    presetRef.current = setPreset;

    const updatePointerCoords = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const getXY = (e: MouseEvent | TouchEvent) => {
      const isTouch = "touches" in e;
      return {
        x: isTouch ? e.touches[0].clientX : (e as MouseEvent).clientX,
        y: isTouch ? e.touches[0].clientY : (e as MouseEvent).clientY,
      };
    };

    // CONSTRAINT SOLVER FUNCTION (Segment > Line > Plane)
    const solveConstraint = (meta: InteractivePointMeta, worldRay: THREE.Ray) => {
      // Transform world ray into local space of group
      group.updateMatrixWorld(true);
      const invMat = group.matrixWorld.clone().invert();
      const localRayOrigin = worldRay.origin.clone().applyMatrix4(invMat);
      const localRayDir = worldRay.direction.clone().transformDirection(invMat).normalize();
      const localRay = new THREE.Ray(localRayOrigin, localRayDir);

      const pMap = pointMapRef.current;
      const constraint = meta.constraint;

      // ==========================================
      // PRIORITY 1: SEGMENT CONSTRAINT
      // ==========================================
      if (constraint.type === "segment") {
        const v1 = pMap.get(constraint.p1Name);
        const v2 = pMap.get(constraint.p2Name);
        if (!v1 || !v2) return;

        const u = new THREE.Vector3().subVectors(v2, v1);
        const uLenSq = u.lengthSq();
        if (uLenSq < 1e-6) return;

        // Find closest point between 3D ray and 3D line segment
        const O = localRay.origin;
        const D = localRay.direction;
        const w0 = new THREE.Vector3().subVectors(O, v1);
        const a = D.dot(D);
        const b = D.dot(u);
        const c = uLenSq;
        const d = D.dot(w0);
        const e = u.dot(w0);
        const denom = a * c - b * b;

        let t = 0.5;
        if (Math.abs(denom) > 1e-6) {
          t = (a * e - b * d) / denom;
        } else {
          t = e / c;
        }

        // Clamp parameter strictly to [0, 1] on the segment
        t = Math.max(0, Math.min(1, t));

        if (meta.isCustom) {
          setCustomPoints((prev) =>
            prev.map((cp) => (cp.id === meta.id ? { ...cp, ratio: t, type: "ratio" } : cp))
          );
        }
        return;
      }

      // ==========================================
      // PRIORITY 2: LINE CONSTRAINT
      // ==========================================
      if (constraint.type === "line") {
        let pOrigin: THREE.Vector3 | null = constraint.origin || null;
        let uDir: THREE.Vector3 | null = constraint.direction ? constraint.direction.clone().normalize() : null;

        if (!pOrigin && constraint.p1Name) {
          pOrigin = pMap.get(constraint.p1Name) || null;
        }

        if (!uDir && constraint.p1Name && constraint.p2Name) {
          const v1 = pMap.get(constraint.p1Name);
          const v2 = pMap.get(constraint.p2Name);
          if (v1 && v2) {
            pOrigin = v1;
            uDir = new THREE.Vector3().subVectors(v2, v1).normalize();
          }
        }

        if (!pOrigin || !uDir) return;

        const O = localRay.origin;
        const D = localRay.direction;
        const w0 = new THREE.Vector3().subVectors(O, pOrigin);
        const a = D.dot(D);
        const b = D.dot(uDir);
        const c = 1;
        const d = D.dot(w0);
        const e = uDir.dot(w0);
        const denom = a * c - b * b;

        let sLine = 0;
        if (Math.abs(denom) > 1e-6) {
          sLine = (a * e - b * d) / denom;
        } else {
          sLine = e;
        }

        const newPos = new THREE.Vector3().copy(pOrigin).addScaledVector(uDir, sLine);

        // If dragging Apex S vertically
        if (meta.isApex) {
          const cat = categoryRef.current;
          const newH = Math.max(1.0, Math.min(8.0, 2 * Math.abs(newPos.y)));
          if (cat === "regular") {
            setRegH(newH);
          } else {
            setPyrH(newH);
          }
          return;
        }

        if (meta.isCustom) {
          setCustomPoints((prev) =>
            prev.map((cp) => {
              if (cp.id !== meta.id) return cp;
              if (cp.type === "line_point" && cp.lineP1 && cp.lineP2) {
                const v1 = pMap.get(cp.lineP1);
                const v2 = pMap.get(cp.lineP2);
                if (v1 && v2) {
                  const u = new THREE.Vector3().subVectors(v2, v1);
                  const uLenSq = u.lengthSq();
                  if (uLenSq > 1e-6) {
                    const t = new THREE.Vector3().subVectors(newPos, v1).dot(u) / uLenSq;
                    return { ...cp, lineT: t };
                  }
                }
              } else if (cp.type === "parallel_point" && cp.parallelRef) {
                const p = pMap.get(cp.parallelRef.throughPoint);
                const p1 = pMap.get(cp.parallelRef.parallelToP1);
                const p2 = pMap.get(cp.parallelRef.parallelToP2);
                if (p && p1 && p2) {
                  const u = new THREE.Vector3().subVectors(p2, p1);
                  const uLenSq = u.lengthSq();
                  if (uLenSq > 1e-6) {
                    const s = new THREE.Vector3().subVectors(newPos, p).dot(u) / uLenSq;
                    return { ...cp, parallelRef: { ...cp.parallelRef, scale: s } };
                  }
                }
              }
              return {
                ...cp,
                customPos: { x: newPos.x, y: newPos.y, z: newPos.z },
              };
            })
          );
        }
        return;
      }

      // ==========================================
      // PRIORITY 3: PLANE CONSTRAINT
      // ==========================================
      if (constraint.type === "plane") {
        let normal = constraint.normal ? constraint.normal.clone().normalize() : new THREE.Vector3(0, 1, 0);
        let p0 = constraint.p0Pos?.clone() || (constraint.p0Name ? pMap.get(constraint.p0Name)?.clone() : null);

        if (constraint.planePts) {
          const [pt1, pt2, pt3] = constraint.planePts;
          const v1 = pMap.get(pt1);
          const v2 = pMap.get(pt2);
          const v3 = pMap.get(pt3);
          if (v1 && v2 && v3) {
            p0 = v1.clone();
            const edge1 = new THREE.Vector3().subVectors(v2, v1);
            const edge2 = new THREE.Vector3().subVectors(v3, v1);
            normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
          }
        }

        if (!p0) p0 = new THREE.Vector3(0, -1.5, 0);

        const denom = normal.dot(localRay.direction);
        if (Math.abs(denom) > 1e-5) {
          const s = normal.dot(new THREE.Vector3().subVectors(p0, localRay.origin)) / denom;
          if (s > 0) {
            const hitPoint = new THREE.Vector3().copy(localRay.origin).addScaledVector(localRay.direction, s);
            hitPoint.x = Math.max(-5, Math.min(5, hitPoint.x));
            hitPoint.z = Math.max(-5, Math.min(5, hitPoint.z));

            // If base vertex: accurate non-accumulating offset from unoffset coordinate
            if (meta.baseVertexName) {
              const bName = meta.baseVertexName;
              const origPos = unoffsetBasePosMapRef.current.get(bName);
              if (origPos) {
                setBaseOffsets((prev) => ({
                  ...prev,
                  [bName]: {
                    x: hitPoint.x - origPos.x,
                    z: hitPoint.z - origPos.z,
                  },
                }));
              }
              return;
            }

            // If Apex in custom offset mode
            if (meta.isApex) {
              setPyrApexDx(hitPoint.x);
              setPyrApexDz(hitPoint.z);
              return;
            }

            // If top vertex in prism
            if (meta.name.includes("'")) {
              const baseName = meta.name.replace("'", "");
              const basePos = pMap.get(baseName);
              if (basePos) {
                setPrismSlantDx(hitPoint.x - basePos.x);
                setPrismSlantDz(hitPoint.z - basePos.z);
              }
              return;
            }

            // If custom point on plane
            if (meta.isCustom) {
              setCustomPoints((prev) =>
                prev.map((cp) => {
                  if (cp.id !== meta.id) return cp;
                  if (cp.type === "plane_point" && cp.triangle) {
                    const [t1, t2, t3] = cp.triangle;
                    const v1 = pMap.get(t1);
                    const v2 = pMap.get(t2);
                    const v3 = pMap.get(t3);
                    if (v1 && v2 && v3) {
                      const v0 = new THREE.Vector3().subVectors(v2, v1);
                      const v1Edge = new THREE.Vector3().subVectors(v3, v1);
                      const v2Hit = new THREE.Vector3().subVectors(hitPoint, v1);

                      const d00 = v0.dot(v0);
                      const d01 = v0.dot(v1Edge);
                      const d11 = v1Edge.dot(v1Edge);
                      const d20 = v2Hit.dot(v0);
                      const d21 = v2Hit.dot(v1Edge);

                      const denomTri = d00 * d11 - d01 * d01;
                      if (Math.abs(denomTri) > 1e-6) {
                        const vBary = (d11 * d20 - d01 * d21) / denomTri;
                        const wBary = (d00 * d21 - d01 * d20) / denomTri;
                        const uBary = 1.0 - vBary - wBary;
                        return {
                          ...cp,
                          barycentric: [uBary, vBary, wBary],
                          customPos: { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z },
                        };
                      }
                    }
                  }
                  return {
                    ...cp,
                    customPos: { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z },
                  };
                })
              );
            }
          }
        }
      }
    };

    const onDown = (e: MouseEvent | TouchEvent) => {
      const p = getXY(e);
      prevX = p.x;
      prevY = p.y;
      updatePointerCoords(p.x, p.y);

      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(hitMeshesRef.current, false);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        const meta = hitMeshToMetaRef.current.get(hitMesh);
        if (meta) {
          draggedMetaRef.current = meta;
          isDraggingPointRef.current = true;
          draggingScene = false;
          renderer.domElement.style.cursor = "grabbing";
          setActiveDragInfo({
            name: meta.name,
            label: meta.constraint.label,
            priority: meta.constraint.priority,
            details: `Đang kéo điểm ${meta.name} trên ${meta.constraint.label}`,
          });
          return;
        }
      }

      // No point hit -> Start scene rotation
      draggingScene = true;
      draggedMetaRef.current = null;
      isDraggingPointRef.current = false;
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      const p = getXY(e);
      updatePointerCoords(p.x, p.y);

      // 1. POINT DRAGGING WITH STRICT CONSTRAINTS
      if (isDraggingPointRef.current && draggedMetaRef.current) {
        raycaster.setFromCamera(pointer, camera);
        solveConstraint(draggedMetaRef.current, raycaster.ray);
        return;
      }

      // 2. SCENE ROTATION
      if (draggingScene) {
        const dx = p.x - prevX;
        const dy = p.y - prevY;
        prevX = p.x;
        prevY = p.y;

        const rotSpeed = 0.0075;
        const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
        const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();

        const qX = new THREE.Quaternion().setFromAxisAngle(camRight, dy * rotSpeed);
        const qY = new THREE.Quaternion().setFromAxisAngle(camUp, dx * rotSpeed);
        group.quaternion.premultiply(qX);
        group.quaternion.premultiply(qY);
        return;
      }

      // 3. HOVER DETECTION OVER INTERACTIVE POINTS
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(hitMeshesRef.current, false);
      if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        const meta = hitMeshToMetaRef.current.get(hitMesh);
        if (meta) {
          renderer.domElement.style.cursor = "grab";
          setHoveredPoint(meta);
          return;
        }
      } else {
        renderer.domElement.style.cursor = "default";
        setHoveredPoint(null);
      }
    };

    const onUp = () => {
      draggingScene = false;
      isDraggingPointRef.current = false;
      draggedMetaRef.current = null;
      setActiveDragInfo(null);
      renderer.domElement.style.cursor = "default";
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      dist = Math.max(3.0, Math.min(16, dist + e.deltaY * 0.01));
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
      if (autoRotateRef.current && !draggingScene && !isDraggingPointRef.current) {
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
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const toggleAutoRotate = () => {
    autoRotateRef.current = !autoRotateRef.current;
    setAutoRotate(autoRotateRef.current);
  };

  // Auto unfolding animation loop
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

  // ==========================================================
  // MATHEMATICAL & GEOMETRIC COMPUTATION ENGINE
  // ==========================================================
  const geometryData = useMemo(() => {
    const basePts: { name: string; pos: THREE.Vector3 }[] = [];
    const topPts: { name: string; pos: THREE.Vector3 }[] = [];
    let apex: { name: string; pos: THREE.Vector3 } | null = null;
    let baseArea = 1;
    let totalHeight = 3;
    let volume = 1;
    let basePerimeter = 1;
    let shapeDesc = "";

    if (category === "regular") {
      totalHeight = regH;
      const n = regN;
      const r = regR;
      baseArea = (n / 2) * r * r * Math.sin((2 * Math.PI) / n);
      basePerimeter = 2 * n * r * Math.sin(Math.PI / n);
      const labels = ["A", "B", "C", "D", "E", "F"];

      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const px = r * Math.sin(a);
        const pz = r * Math.cos(a);
        basePts.push({ name: labels[i] || `A${i + 1}`, pos: new THREE.Vector3(px, -regH / 2, pz) });
      }

      if (regType === "pyramid") {
        apex = { name: "S", pos: new THREE.Vector3(0, regH / 2, 0) };
        volume = (1 / 3) * baseArea * regH;
        shapeDesc = `Hình chóp đều S.${basePts.map((p) => p.name).join("")}`;
      } else {
        const topLabels = ["A'", "B'", "C'", "D'", "E'", "F'"];
        for (let i = 0; i < n; i++) {
          const bp = basePts[i].pos;
          topPts.push({ name: topLabels[i] || `A'${i + 1}`, pos: new THREE.Vector3(bp.x, regH / 2, bp.z) });
        }
        volume = baseArea * regH;
        shapeDesc = `Lăng trụ đứng đều ${basePts.map((p) => p.name).join("")}.${topPts.map((p) => p.name).join("")}`;
      }
    } else if (category === "custom_pyramid") {
      totalHeight = pyrH;
      const a = pyrA;
      const b = pyrB;
      const rad = (pyrAngle * Math.PI) / 180;

      if (pyrBaseShape === "triangle_right") {
        // Tam giác ABC vuông tại A
        const cx = a / 3;
        const cz = b / 3;
        basePts.push({ name: "A", pos: new THREE.Vector3(0 - cx, -pyrH / 2, 0 - cz) });
        basePts.push({ name: "B", pos: new THREE.Vector3(a - cx, -pyrH / 2, 0 - cz) });
        basePts.push({ name: "C", pos: new THREE.Vector3(0 - cx, -pyrH / 2, b - cz) });
        baseArea = 0.5 * a * b;
        basePerimeter = a + b + Math.hypot(a, b);
      } else if (pyrBaseShape === "triangle_equilateral") {
        const hTri = (a * Math.sqrt(3)) / 2;
        const rIn = hTri / 3;
        basePts.push({ name: "A", pos: new THREE.Vector3(0, -pyrH / 2, -2 * rIn) });
        basePts.push({ name: "B", pos: new THREE.Vector3(a / 2, -pyrH / 2, rIn) });
        basePts.push({ name: "C", pos: new THREE.Vector3(-a / 2, -pyrH / 2, rIn) });
        baseArea = (Math.sqrt(3) / 4) * a * a;
        basePerimeter = 3 * a;
      } else if (pyrBaseShape === "triangle_general") {
        const cx = (a + b * Math.cos(rad)) / 3;
        const cz = (b * Math.sin(rad)) / 3;
        basePts.push({ name: "A", pos: new THREE.Vector3(0 - cx, -pyrH / 2, 0 - cz) });
        basePts.push({ name: "B", pos: new THREE.Vector3(a - cx, -pyrH / 2, 0 - cz) });
        basePts.push({ name: "C", pos: new THREE.Vector3(b * Math.cos(rad) - cx, -pyrH / 2, b * Math.sin(rad) - cz) });
        baseArea = 0.5 * a * b * Math.sin(rad);
        const cSide = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(rad));
        basePerimeter = a + b + cSide;
      } else if (pyrBaseShape === "quad_rect" || pyrBaseShape === "quad_square") {
        const w = a;
        const d = pyrBaseShape === "quad_square" ? a : b;
        basePts.push({ name: "A", pos: new THREE.Vector3(-w / 2, -pyrH / 2, -d / 2) });
        basePts.push({ name: "B", pos: new THREE.Vector3(w / 2, -pyrH / 2, -d / 2) });
        basePts.push({ name: "C", pos: new THREE.Vector3(w / 2, -pyrH / 2, d / 2) });
        basePts.push({ name: "D", pos: new THREE.Vector3(-w / 2, -pyrH / 2, d / 2) });
        baseArea = w * d;
        basePerimeter = 2 * (w + d);
      } else if (pyrBaseShape === "quad_parallelogram") {
        const offX = b * Math.cos(rad);
        const offZ = b * Math.sin(rad);
        const cx = (a + offX) / 2;
        const cz = offZ / 2;
        basePts.push({ name: "A", pos: new THREE.Vector3(0 - cx, -pyrH / 2, 0 - cz) });
        basePts.push({ name: "B", pos: new THREE.Vector3(a - cx, -pyrH / 2, 0 - cz) });
        basePts.push({ name: "C", pos: new THREE.Vector3(a + offX - cx, -pyrH / 2, offZ - cz) });
        basePts.push({ name: "D", pos: new THREE.Vector3(offX - cx, -pyrH / 2, offZ - cz) });
        baseArea = a * b * Math.sin(rad);
        basePerimeter = 2 * (a + b);
      } else {
        // quad_trapezoid (Hình thang vuông tại A, B)
        const topW = b;
        const botW = a;
        const hTrap = 2.0;
        const cx = Math.max(botW, topW) / 2;
        const cz = hTrap / 2;
        basePts.push({ name: "A", pos: new THREE.Vector3(0 - cx, -pyrH / 2, 0 - cz) });
        basePts.push({ name: "B", pos: new THREE.Vector3(botW - cx, -pyrH / 2, 0 - cz) });
        basePts.push({ name: "C", pos: new THREE.Vector3(topW - cx, -pyrH / 2, hTrap - cz) });
        basePts.push({ name: "D", pos: new THREE.Vector3(0 - cx, -pyrH / 2, hTrap - cz) });
        baseArea = 0.5 * (botW + topW) * hTrap;
        basePerimeter = botW + topW + hTrap + Math.hypot(botW - topW, hTrap);
      }

      // Apex position calculation
      if (pyrApexType === "sa_perp") {
        const ptA = basePts.find((p) => p.name === "A") || basePts[0];
        apex = { name: "S", pos: new THREE.Vector3(ptA.pos.x, pyrH / 2, ptA.pos.z) };
        shapeDesc = `Hình chóp S.${basePts.map((p) => p.name).join("")} có SA ⊥ (Đáy)`;
      } else if (pyrApexType === "face_perp") {
        const ptA = basePts[0].pos;
        const ptB = basePts[1].pos;
        const mx = (ptA.x + ptB.x) / 2;
        const mz = (ptA.z + ptB.z) / 2;
        apex = { name: "S", pos: new THREE.Vector3(mx, pyrH / 2, mz) };
        shapeDesc = `Hình chóp S.${basePts.map((p) => p.name).join("")} có (SAB) ⊥ (Đáy)`;
      } else if (pyrApexType === "regular") {
        apex = { name: "S", pos: new THREE.Vector3(0, pyrH / 2, 0) };
        shapeDesc = `Hình chóp đều S.${basePts.map((p) => p.name).join("")}`;
      } else {
        apex = { name: "S", pos: new THREE.Vector3(pyrApexDx, pyrH / 2, pyrApexDz) };
        shapeDesc = `Hình chóp S.${basePts.map((p) => p.name).join("")} với đỉnh S(x,h,z) tự do`;
      }
      volume = (1 / 3) * baseArea * pyrH;
    } else {
      // CUSTOM PRISM
      totalHeight = prismH;
      const a = prismA;
      const b = prismB;
      const rad = (prismAngle * Math.PI) / 180;

      if (prismBaseShape === "triangle_right") {
        const cx = a / 3;
        const cz = b / 3;
        basePts.push({ name: "A", pos: new THREE.Vector3(0 - cx, -prismH / 2, 0 - cz) });
        basePts.push({ name: "B", pos: new THREE.Vector3(a - cx, -prismH / 2, 0 - cz) });
        basePts.push({ name: "C", pos: new THREE.Vector3(0 - cx, -prismH / 2, b - cz) });
        baseArea = 0.5 * a * b;
        basePerimeter = a + b + Math.hypot(a, b);
      } else if (prismBaseShape === "triangle_equilateral") {
        const hTri = (a * Math.sqrt(3)) / 2;
        const rIn = hTri / 3;
        basePts.push({ name: "A", pos: new THREE.Vector3(0, -prismH / 2, -2 * rIn) });
        basePts.push({ name: "B", pos: new THREE.Vector3(a / 2, -prismH / 2, rIn) });
        basePts.push({ name: "C", pos: new THREE.Vector3(-a / 2, -prismH / 2, rIn) });
        baseArea = (Math.sqrt(3) / 4) * a * a;
        basePerimeter = 3 * a;
      } else if (prismBaseShape === "triangle_general") {
        const cx = (a + b * Math.cos(rad)) / 3;
        const cz = (b * Math.sin(rad)) / 3;
        basePts.push({ name: "A", pos: new THREE.Vector3(0 - cx, -prismH / 2, 0 - cz) });
        basePts.push({ name: "B", pos: new THREE.Vector3(a - cx, -prismH / 2, 0 - cz) });
        basePts.push({ name: "C", pos: new THREE.Vector3(b * Math.cos(rad) - cx, -prismH / 2, b * Math.sin(rad) - cz) });
        baseArea = 0.5 * a * b * Math.sin(rad);
        const cSide = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(rad));
        basePerimeter = a + b + cSide;
      } else if (prismBaseShape === "quad_rect" || prismBaseShape === "quad_square") {
        const w = a;
        const d = prismBaseShape === "quad_square" ? a : b;
        basePts.push({ name: "A", pos: new THREE.Vector3(-w / 2, -prismH / 2, -d / 2) });
        basePts.push({ name: "B", pos: new THREE.Vector3(w / 2, -prismH / 2, -d / 2) });
        basePts.push({ name: "C", pos: new THREE.Vector3(w / 2, -prismH / 2, d / 2) });
        basePts.push({ name: "D", pos: new THREE.Vector3(-w / 2, -prismH / 2, d / 2) });
        baseArea = w * d;
        basePerimeter = 2 * (w + d);
      } else {
        const offX = b * Math.cos(rad);
        const offZ = b * Math.sin(rad);
        const cx = (a + offX) / 2;
        const cz = offZ / 2;
        basePts.push({ name: "A", pos: new THREE.Vector3(0 - cx, -prismH / 2, 0 - cz) });
        basePts.push({ name: "B", pos: new THREE.Vector3(a - cx, -prismH / 2, 0 - cz) });
        basePts.push({ name: "C", pos: new THREE.Vector3(a + offX - cx, -prismH / 2, offZ - cz) });
        basePts.push({ name: "D", pos: new THREE.Vector3(offX - cx, -prismH / 2, offZ - cz) });
        baseArea = a * b * Math.sin(rad);
        basePerimeter = 2 * (a + b);
      }

      const shiftX = prismKind === "oblique" ? prismSlantDx : 0;
      const shiftZ = prismKind === "oblique" ? prismSlantDz : 0;

      for (let i = 0; i < basePts.length; i++) {
        const bp = basePts[i];
        topPts.push({
          name: `${bp.name}'`,
          pos: new THREE.Vector3(bp.pos.x + shiftX, prismH / 2, bp.pos.z + shiftZ),
        });
      }

      volume = baseArea * prismH;
      shapeDesc = `${prismKind === "oblique" ? "Lăng trụ xiên" : "Lăng trụ đứng"} ${basePts.map((p) => p.name).join("")}`;
    }

    // Cache un-offset base vertex positions for smooth non-accumulative dragging
    const unoffsetBasePositions = new Map<string, THREE.Vector3>();
    basePts.forEach((p) => {
      unoffsetBasePositions.set(p.name, p.pos.clone());
    });
    unoffsetBasePosMapRef.current = unoffsetBasePositions;

    // Apply baseOffsets to base vertices (Priority 3: moving on base plane)
    basePts.forEach((p) => {
      if (baseOffsets[p.name]) {
        p.pos.x += baseOffsets[p.name].x;
        p.pos.z += baseOffsets[p.name].z;
      }
    });

    // =========================================================================
    // ENFORCE GEOMETRIC INVARIANTS ON BASE POLYGONS (Parallelism & Perpendicularity)
    // =========================================================================
    const shapeType = category === "custom_pyramid" ? pyrBaseShape : (category === "custom_prism" ? prismBaseShape : "regular");

    if (shapeType === "quad_parallelogram" && basePts.length === 4) {
      // Rule: In Parallelogram ABCD, AB // CD and AD // BC => D = A + C - B
      const ptA = basePts[0].pos;
      const ptB = basePts[1].pos;
      const ptC = basePts[2].pos;
      basePts[3].pos.set(ptA.x + ptC.x - ptB.x, ptA.y, ptA.z + ptC.z - ptB.z);
    } else if (shapeType === "quad_rect" && basePts.length === 4) {
      // Rule: In Rectangle ABCD, AB // CD, AD // BC, and all angles 90 deg
      const ptA = basePts[0].pos;
      const ptB = basePts[1].pos;
      const edgeAB = new THREE.Vector3(ptB.x - ptA.x, 0, ptB.z - ptA.z);
      const lenAB = edgeAB.length();
      if (lenAB > 1e-4) {
        const uAB = edgeAB.clone().normalize();
        const uPerp = new THREE.Vector3(-uAB.z, 0, uAB.x);
        const depth = Math.max(0.8, (basePts[2].pos.x - ptB.x) * uPerp.x + (basePts[2].pos.z - ptB.z) * uPerp.z);
        basePts[2].pos.set(ptB.x + depth * uPerp.x, ptB.y, ptB.z + depth * uPerp.z);
        basePts[3].pos.set(ptA.x + depth * uPerp.x, ptA.y, ptA.z + depth * uPerp.z);
      }
    } else if (shapeType === "quad_square" && basePts.length === 4) {
      // Rule: In Square ABCD, AB = BC = CD = DA, AB // CD, AD // BC, all angles 90 deg
      const ptA = basePts[0].pos;
      const ptB = basePts[1].pos;
      const edgeAB = new THREE.Vector3(ptB.x - ptA.x, 0, ptB.z - ptA.z);
      const lenAB = edgeAB.length();
      if (lenAB > 1e-4) {
        const uAB = edgeAB.clone().normalize();
        const uPerp = new THREE.Vector3(-uAB.z, 0, uAB.x);
        basePts[2].pos.set(ptB.x + lenAB * uPerp.x, ptB.y, ptB.z + lenAB * uPerp.z);
        basePts[3].pos.set(ptA.x + lenAB * uPerp.x, ptA.y, ptA.z + lenAB * uPerp.z);
      }
    } else if (shapeType === "quad_trapezoid" && basePts.length === 4) {
      // Rule: In Right Trapezoid ABCD (AD ⊥ AB, AD ⊥ CD, AB // CD)
      const ptA = basePts[0].pos;
      const ptB = basePts[1].pos;
      const edgeAB = new THREE.Vector3(ptB.x - ptA.x, 0, ptB.z - ptA.z);
      const lenAB = edgeAB.length();
      if (lenAB > 1e-4) {
        const uAB = edgeAB.clone().normalize();
        const uPerp = new THREE.Vector3(-uAB.z, 0, uAB.x);
        const hTrap = 2.0;
        const topW = Math.max(0.6, (basePts[2].pos.x - ptA.x) * uAB.x + (basePts[2].pos.z - ptA.z) * uAB.z);
        basePts[3].pos.set(ptA.x + hTrap * uPerp.x, ptA.y, ptA.z + hTrap * uPerp.z);
        basePts[2].pos.set(basePts[3].pos.x + topW * uAB.x, basePts[3].pos.y, basePts[3].pos.z + topW * uAB.z);
      }
    } else if (shapeType === "triangle_right" && basePts.length === 3) {
      // Rule: Right Triangle ABC at A (AB ⊥ AC)
      const ptA = basePts[0].pos;
      const ptB = basePts[1].pos;
      const edgeAB = new THREE.Vector3(ptB.x - ptA.x, 0, ptB.z - ptA.z);
      const lenAB = edgeAB.length();
      if (lenAB > 1e-4) {
        const uAB = edgeAB.clone().normalize();
        const uPerp = new THREE.Vector3(-uAB.z, 0, uAB.x);
        const lenAC = Math.max(0.8, (basePts[2].pos.x - ptA.x) * uPerp.x + (basePts[2].pos.z - ptA.z) * uPerp.z);
        basePts[2].pos.set(ptA.x + lenAC * uPerp.x, ptA.y, ptA.z + lenAC * uPerp.z);
      }
    }

    // Prism Top Vertices Generation: AA' // BB' // CC' // DD' and (A'B'C'D') // (ABCD)
    if (category === "custom_prism" || (category === "regular" && regType === "prism")) {
      topPts.length = 0;
      const shiftX = (category === "custom_prism" && prismKind === "oblique") ? prismSlantDx : 0;
      const shiftZ = (category === "custom_prism" && prismKind === "oblique") ? prismSlantDz : 0;
      const hPrism = category === "regular" ? regH : prismH;

      for (let i = 0; i < basePts.length; i++) {
        const bp = basePts[i];
        topPts.push({
          name: `${bp.name}'`,
          pos: new THREE.Vector3(bp.pos.x + shiftX, hPrism / 2, bp.pos.z + shiftZ),
        });
      }
      shapeDesc = `${category === "custom_prism" && prismKind === "oblique" ? "Lăng trụ xiên" : "Lăng trụ đứng"} ${basePts.map((p) => p.name).join("")}.${topPts.map((p) => p.name).join("")}`;
    }

    // Pyramid Apex Generation (Enforcing SA ⊥ (Đáy), (SAB) ⊥ (Đáy), SO ⊥ (Đáy))
    if (category === "custom_pyramid") {
      if (pyrApexType === "sa_perp" && basePts.length > 0) {
        const ptA = basePts[0].pos;
        apex = { name: "S", pos: new THREE.Vector3(ptA.x, pyrH / 2, ptA.z) };
        shapeDesc = `Hình chóp S.${basePts.map((p) => p.name).join("")} có SA ⊥ (Đáy)`;
      } else if (pyrApexType === "face_perp" && basePts.length >= 2) {
        const ptA = basePts[0].pos;
        const ptB = basePts[1].pos;
        apex = { name: "S", pos: new THREE.Vector3((ptA.x + ptB.x) / 2, pyrH / 2, (ptA.z + ptB.z) / 2) };
        shapeDesc = `Hình chóp S.${basePts.map((p) => p.name).join("")} có (SAB) ⊥ (Đáy)`;
      } else if (pyrApexType === "regular" && basePts.length >= 3) {
        let sumX = 0, sumZ = 0;
        basePts.forEach((p) => { sumX += p.pos.x; sumZ += p.pos.z; });
        apex = { name: "S", pos: new THREE.Vector3(sumX / basePts.length, pyrH / 2, sumZ / basePts.length) };
        shapeDesc = `Hình chóp đều S.${basePts.map((p) => p.name).join("")}`;
      } else {
        apex = { name: "S", pos: new THREE.Vector3(pyrApexDx, pyrH / 2, pyrApexDz) };
        shapeDesc = `Hình chóp S.${basePts.map((p) => p.name).join("")} đỉnh tự do S(x,h,z)`;
      }
    } else if (category === "regular" && regType === "pyramid" && basePts.length >= 3) {
      let sumX = 0, sumZ = 0;
      basePts.forEach((p) => { sumX += p.pos.x; sumZ += p.pos.z; });
      apex = { name: "S", pos: new THREE.Vector3(sumX / basePts.length, regH / 2, sumZ / basePts.length) };
      shapeDesc = `Hình chóp đều S.${basePts.map((p) => p.name).join("")}`;
    }

    // Build complete dictionary of all available points
    const pointMap = new Map<string, THREE.Vector3>();
    basePts.forEach((p) => pointMap.set(p.name, p.pos));
    topPts.forEach((p) => pointMap.set(p.name, p.pos));
    if (apex) pointMap.set(apex.name, apex.pos);

    // Add Base Center O and Apex Projection H
    if (basePts.length >= 3) {
      let sumX = 0, sumY = 0, sumZ = 0;
      basePts.forEach((p) => {
        sumX += p.pos.x;
        sumY += p.pos.y;
        sumZ += p.pos.z;
      });
      const ptO = new THREE.Vector3(sumX / basePts.length, sumY / basePts.length, sumZ / basePts.length);
      pointMap.set("O", ptO);

      if (apex) {
        const ptH = new THREE.Vector3(apex.pos.x, ptO.y, apex.pos.z);
        pointMap.set("H", ptH);
      }
    }

    // Compute and register custom points (Segment, Line, Plane, Centroid, Parallel, Perpendicular)
    const resolvedCustomPoints: { name: string; pos: THREE.Vector3; color: string; raw: GeoPoint }[] = [];
    customPoints.forEach((cp) => {
      let resolvedPos: THREE.Vector3 | null = null;
      if ((cp.type === "midpoint" || cp.type === "ratio") && cp.p1 && cp.p2 && pointMap.has(cp.p1) && pointMap.has(cp.p2)) {
        const v1 = pointMap.get(cp.p1)!;
        const v2 = pointMap.get(cp.p2)!;
        const r = cp.type === "midpoint" ? 0.5 : (cp.ratio ?? 0.5);
        resolvedPos = new THREE.Vector3().lerpVectors(v1, v2, r);
      } else if (cp.type === "line_point" && cp.lineP1 && cp.lineP2 && pointMap.has(cp.lineP1) && pointMap.has(cp.lineP2)) {
        const v1 = pointMap.get(cp.lineP1)!;
        const v2 = pointMap.get(cp.lineP2)!;
        const t = cp.lineT ?? 0.5;
        resolvedPos = new THREE.Vector3().lerpVectors(v1, v2, t);
      } else if (cp.type === "plane_point" && cp.triangle) {
        const [t1, t2, t3] = cp.triangle;
        if (pointMap.has(t1) && pointMap.has(t2) && pointMap.has(t3)) {
          const v1 = pointMap.get(t1)!;
          const v2 = pointMap.get(t2)!;
          const v3 = pointMap.get(t3)!;
          if (cp.barycentric) {
            const [w1, w2, w3] = cp.barycentric;
            resolvedPos = new THREE.Vector3(
              w1 * v1.x + w2 * v2.x + w3 * v3.x,
              w1 * v1.y + w2 * v2.y + w3 * v3.y,
              w1 * v1.z + w2 * v2.z + w3 * v3.z
            );
          } else if (cp.customPos) {
            resolvedPos = new THREE.Vector3(cp.customPos.x, cp.customPos.y, cp.customPos.z);
          } else {
            resolvedPos = new THREE.Vector3((v1.x + v2.x + v3.x) / 3, (v1.y + v2.y + v3.y) / 3, (v1.z + v2.z + v3.z) / 3);
          }
        }
      } else if (cp.type === "centroid" && cp.triangle) {
        const [t1, t2, t3] = cp.triangle;
        if (pointMap.has(t1) && pointMap.has(t2) && pointMap.has(t3)) {
          const v1 = pointMap.get(t1)!;
          const v2 = pointMap.get(t2)!;
          const v3 = pointMap.get(t3)!;
          resolvedPos = new THREE.Vector3((v1.x + v2.x + v3.x) / 3, (v1.y + v2.y + v3.y) / 3, (v1.z + v2.z + v3.z) / 3);
        }
      } else if (cp.type === "parallel_point" && cp.parallelRef) {
        const { throughPoint, parallelToP1, parallelToP2, scale = 1.0 } = cp.parallelRef;
        if (pointMap.has(throughPoint) && pointMap.has(parallelToP1) && pointMap.has(parallelToP2)) {
          const p = pointMap.get(throughPoint)!;
          const p1 = pointMap.get(parallelToP1)!;
          const p2 = pointMap.get(parallelToP2)!;
          const dir = new THREE.Vector3().subVectors(p2, p1).multiplyScalar(scale);
          resolvedPos = new THREE.Vector3().addVectors(p, dir);
        }
      } else if (cp.type === "perp_proj" && cp.perpProjRef) {
        const { fromPoint, toLineP1, toLineP2 } = cp.perpProjRef;
        if (pointMap.has(fromPoint) && pointMap.has(toLineP1) && pointMap.has(toLineP2)) {
          const p = pointMap.get(fromPoint)!;
          const p1 = pointMap.get(toLineP1)!;
          const p2 = pointMap.get(toLineP2)!;
          const u = new THREE.Vector3().subVectors(p2, p1);
          const uLenSq = u.lengthSq();
          if (uLenSq > 1e-6) {
            const t = new THREE.Vector3().subVectors(p, p1).dot(u) / uLenSq;
            resolvedPos = new THREE.Vector3().copy(p1).addScaledVector(u, t);
          }
        }
      } else if (cp.type === "custom_xyz" && cp.customPos) {
        resolvedPos = new THREE.Vector3(cp.customPos.x, cp.customPos.y, cp.customPos.z);
      }

      if (resolvedPos) {
        pointMap.set(cp.name, resolvedPos);
        resolvedCustomPoints.push({ name: cp.name, pos: resolvedPos, color: cp.color, raw: cp });
      }
    });

    // Update global map ref for immediate raycasting
    pointMapRef.current = pointMap;

    // BUILD INTERACTIVE POINT METADATA LIST (Segment > Line > Plane)
    const interactiveMetas: InteractivePointMeta[] = [];

    // 1. Base Vertices (Priority 3: Plane constraint on base plane)
    basePts.forEach((p) => {
      interactiveMetas.push({
        id: `base_${p.name}`,
        name: p.name,
        pos: p.pos.clone(),
        color: COLORS.emerald,
        constraint: {
          type: "plane",
          normal: new THREE.Vector3(0, 1, 0),
          p0Pos: new THREE.Vector3(0, -totalHeight / 2, 0),
          label: "Mặt phẳng đáy (Oxy)",
          priority: 3,
        },
        isCustom: false,
        baseVertexName: p.name,
      });
    });

    // 2. Top Vertices for Prism (Priority 3: Plane constraint on top plane)
    topPts.forEach((p) => {
      interactiveMetas.push({
        id: `top_${p.name}`,
        name: p.name,
        pos: p.pos.clone(),
        color: COLORS.cyan,
        constraint: {
          type: "plane",
          normal: new THREE.Vector3(0, 1, 0),
          p0Pos: new THREE.Vector3(0, totalHeight / 2, 0),
          label: "Mặt phẳng nắp trên",
          priority: 3,
        },
        isCustom: false,
      });
    });

    // 3. Apex S (Line or Plane constraint)
    if (apex) {
      let constraint: PointConstraint = {
        type: "line",
        direction: new THREE.Vector3(0, 1, 0),
        label: "Đường cao hình chóp ⊥ (Đáy)",
        priority: 2,
      };

      if (category === "custom_pyramid") {
        if (pyrApexType === "sa_perp") {
          constraint = {
            type: "line",
            p1Name: "A",
            direction: new THREE.Vector3(0, 1, 0),
            label: "Đường cao SA ⊥ (Đáy)",
            priority: 2,
          };
        } else if (pyrApexType === "face_perp") {
          constraint = {
            type: "line",
            p1Name: "H",
            direction: new THREE.Vector3(0, 1, 0),
            label: "Đường cao SH ⊥ (Đáy)",
            priority: 2,
          };
        } else if (pyrApexType === "regular") {
          constraint = {
            type: "line",
            p1Name: "O",
            direction: new THREE.Vector3(0, 1, 0),
            label: "Trục hình chóp SO ⊥ (Đáy)",
            priority: 2,
          };
        } else {
          constraint = {
            type: "plane",
            normal: new THREE.Vector3(0, 1, 0),
            p0Pos: new THREE.Vector3(0, pyrH / 2, 0),
            label: `Mặt phẳng đỉnh y = ${fmt(pyrH / 2, 2)}`,
            priority: 3,
          };
        }
      }

      interactiveMetas.push({
        id: `apex_${apex.name}`,
        name: apex.name,
        pos: apex.pos.clone(),
        color: COLORS.amber,
        constraint,
        isCustom: false,
        isApex: true,
      });
    }

    // 4. Custom Points (Segment > Line > Plane)
    resolvedCustomPoints.forEach((cp) => {
      let constraint: PointConstraint;

      if ((cp.raw.type === "ratio" || cp.raw.type === "midpoint") && cp.raw.p1 && cp.raw.p2) {
        // PRIORITY 1: SEGMENT
        constraint = {
          type: "segment",
          p1Name: cp.raw.p1,
          p2Name: cp.raw.p2,
          label: `Đoạn thẳng [${cp.raw.p1}, ${cp.raw.p2}]`,
          priority: 1,
        };
      } else if (cp.raw.type === "line_point" && cp.raw.lineP1 && cp.raw.lineP2) {
        // PRIORITY 2: LINE
        constraint = {
          type: "line",
          p1Name: cp.raw.lineP1,
          p2Name: cp.raw.lineP2,
          label: `Đường thẳng (${cp.raw.lineP1}${cp.raw.lineP2})`,
          priority: 2,
        };
      } else if (cp.raw.type === "parallel_point" && cp.raw.parallelRef) {
        // PRIORITY 2: LINE (passing through point, parallel to reference)
        constraint = {
          type: "line",
          p1Name: cp.raw.parallelRef.throughPoint,
          label: `Đường thẳng qua ${cp.raw.parallelRef.throughPoint} // ${cp.raw.parallelRef.parallelToP1}${cp.raw.parallelRef.parallelToP2}`,
          priority: 2,
        };
      } else if (cp.raw.type === "perp_proj" && cp.raw.perpProjRef) {
        // PRIORITY 2: LINE (on target line)
        constraint = {
          type: "line",
          p1Name: cp.raw.perpProjRef.toLineP1,
          p2Name: cp.raw.perpProjRef.toLineP2,
          label: `Đường thẳng chứa chân đường vuông góc (${cp.raw.perpProjRef.toLineP1}${cp.raw.perpProjRef.toLineP2})`,
          priority: 2,
        };
      } else if (cp.raw.type === "plane_point" && cp.raw.triangle) {
        // PRIORITY 3: PLANE
        constraint = {
          type: "plane",
          planePts: cp.raw.triangle,
          label: `Mặt phẳng (${cp.raw.triangle.join(", ")})`,
          priority: 3,
        };
      } else if (cp.raw.type === "centroid" && cp.raw.triangle) {
        // PRIORITY 3: PLANE
        constraint = {
          type: "plane",
          planePts: cp.raw.triangle,
          label: `Mặt phẳng tam giác (${cp.raw.triangle.join(", ")})`,
          priority: 3,
        };
      } else {
        // PRIORITY 3: Default plane
        constraint = {
          type: "plane",
          normal: new THREE.Vector3(0, 1, 0),
          p0Pos: cp.pos.clone(),
          label: "Mặt phẳng tọa độ",
          priority: 3,
        };
      }

      interactiveMetas.push({
        id: cp.raw.id,
        name: cp.name,
        pos: cp.pos.clone(),
        color: cp.color,
        constraint,
        isCustom: true,
      });
    });

    interactiveMetasRef.current = interactiveMetas;

    return {
      basePts,
      topPts,
      apex,
      pointMap,
      resolvedCustomPoints,
      interactiveMetas,
      baseArea,
      totalHeight,
      volume,
      basePerimeter,
      shapeDesc,
    };
  }, [
    category,
    regType,
    regN,
    regR,
    regH,
    pyrApexType,
    pyrBaseShape,
    pyrA,
    pyrB,
    pyrAngle,
    pyrH,
    pyrApexDx,
    pyrApexDz,
    prismKind,
    prismBaseShape,
    prismA,
    prismB,
    prismAngle,
    prismH,
    prismSlantDx,
    prismSlantDz,
    customPoints,
    baseOffsets,
  ]);

  // ==========================================================
  // 3D RENDERING EFFECT (MESHES, WIREFRAMES, LABELS, CUSTOM ELEMENTS)
  // ==========================================================
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    clearGroup(group);

    const { basePts, topPts, apex, pointMap, resolvedCustomPoints, interactiveMetas, totalHeight } = geometryData;

    // Reset hit meshes
    hitMeshesRef.current = [];
    hitMeshToMetaRef.current.clear();

    const baseFaceMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(COLORS.amber),
      transparent: true,
      opacity: faceOpacity,
      flatShading: true,
      roughness: 0.5,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    const capMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(COLORS.emerald),
      transparent: true,
      opacity: Math.min(0.9, faceOpacity * 1.2),
      roughness: 0.4,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    const topCapMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(COLORS.cyan),
      transparent: true,
      opacity: Math.min(0.9, faceOpacity * 1.2),
      roughness: 0.4,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    // ========================================================
    // UNFOLDING / NET / EXPLODE LOGIC (WHEN UNFOLD > 0)
    // ========================================================
    if (unfold > 0) {
      if (unfoldMode === "net") {
        const centerBase = new THREE.Vector3(0, 0, 0);
        basePts.forEach((p) => centerBase.add(p.pos));
        if (basePts.length > 0) centerBase.divideScalar(basePts.length);

        // 1. RENDER BASE POLYGON
        if (basePts.length >= 3) {
          if (showFaces) {
            const baseShape = new THREE.Shape();
            basePts.forEach((p, idx) => {
              if (idx === 0) baseShape.moveTo(p.pos.x, p.pos.z);
              else baseShape.lineTo(p.pos.x, p.pos.z);
            });
            baseShape.closePath();
            const baseGeom = new THREE.ShapeGeometry(baseShape);
            const baseMesh = new THREE.Mesh(baseGeom, capMat);
            baseMesh.rotation.x = Math.PI / 2;
            baseMesh.position.y = basePts[0].pos.y;
            group.add(baseMesh);
          }
        }

        // 2. UNFOLD LATERAL FACES (PYRAMID OR PRISM)
        if (apex) {
          // PYRAMID NET UNFOLDING: Each lateral triangle unfolds along its base edge
          for (let i = 0; i < basePts.length; i++) {
            const p1 = basePts[i].pos;
            const p2 = basePts[(i + 1) % basePts.length].pos;
            const edgeVec = p2.clone().sub(p1);
            const edgeLen = edgeVec.length();
            if (edgeLen < 1e-4) continue;
            const uEdge = edgeVec.clone().divideScalar(edgeLen);
            const midEdge = p1.clone().add(p2).multiplyScalar(0.5);

            // Outward normal in horizontal XZ plane
            let nOut = new THREE.Vector3(-uEdge.z, 0, uEdge.x);
            if (nOut.dot(midEdge.clone().sub(centerBase)) < 0) {
              nOut.negate();
            }

            // Projection of apex onto line p1 -> p2
            const tProj = apex.pos.clone().sub(p1).dot(uEdge);
            const pProj = p1.clone().addScaledVector(uEdge, tProj);
            const w0 = apex.pos.clone().sub(pProj);
            const faceH = w0.length();
            const w1 = nOut.clone().multiplyScalar(faceH);

            const crossW = w0.clone().cross(w1);
            const crossLen = crossW.length();
            const rotAxis = crossLen > 1e-5 ? crossW.clone().normalize() : uEdge;
            const cosAng = Math.max(-1, Math.min(1, w0.dot(w1) / (faceH * faceH || 1)));
            const totalAngle = Math.acos(cosAng);

            const wCurrent = w0.clone().applyAxisAngle(rotAxis, unfold * totalAngle);
            const sCurrent = pProj.clone().add(wCurrent);

            // Triangle Face Mesh
            if (showFaces) {
              const triGeom = new THREE.BufferGeometry();
              const verts = new Float32Array([
                sCurrent.x, sCurrent.y, sCurrent.z,
                p1.x, p1.y, p1.z,
                p2.x, p2.y, p2.z,
              ]);
              triGeom.setAttribute("position", new THREE.BufferAttribute(verts, 3));
              triGeom.computeVertexNormals();
              group.add(new THREE.Mesh(triGeom, baseFaceMat));
            }

            // Crease Hinge Line (Dashed on base edge)
            const creaseGeom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
            const creaseMat = new THREE.LineDashedMaterial({
              color: new THREE.Color(COLORS.emerald),
              dashSize: 0.15,
              gapSize: 0.08,
            });
            const creaseLine = new THREE.Line(creaseGeom, creaseMat);
            creaseLine.computeLineDistances();
            group.add(creaseLine);

            // Outer Lateral Edges
            const edgeLine = new THREE.Line(
              new THREE.BufferGeometry().setFromPoints([p1, sCurrent, p2]),
              new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.amber), linewidth: 2 })
            );
            group.add(edgeLine);

            // Apex Vertex Marker & Label
            const apexMarker = new THREE.Mesh(
              new THREE.SphereGeometry(0.045, 16, 16),
              new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.amber) })
            );
            apexMarker.position.copy(sCurrent);
            group.add(apexMarker);

            const sName = basePts.length <= 4 ? `S${i + 1}` : "S";
            const sLabel = createTextSprite(sName, COLORS.amber);
            sLabel.position.set(sCurrent.x, sCurrent.y + 0.25, sCurrent.z);
            group.add(sLabel);
          }
        } else if (topPts.length >= 3) {
          // PRISM NET UNFOLDING: Lateral quad faces unfold along base edges
          let topFace0_T1: THREE.Vector3 | null = null;
          let topFace0_T2: THREE.Vector3 | null = null;
          let topFace0_nOut: THREE.Vector3 | null = null;

          for (let i = 0; i < basePts.length; i++) {
            const p1 = basePts[i].pos;
            const p2 = basePts[(i + 1) % basePts.length].pos;
            const t1 = topPts[i].pos;
            const t2 = topPts[(i + 1) % topPts.length].pos;

            const edgeVec = p2.clone().sub(p1);
            const edgeLen = edgeVec.length();
            if (edgeLen < 1e-4) continue;
            const uEdge = edgeVec.clone().divideScalar(edgeLen);
            const midEdge = p1.clone().add(p2).multiplyScalar(0.5);

            let nOut = new THREE.Vector3(-uEdge.z, 0, uEdge.x);
            if (nOut.dot(midEdge.clone().sub(centerBase)) < 0) {
              nOut.negate();
            }

            // T1 rotation
            const t1ProjDist = t1.clone().sub(p1).dot(uEdge);
            const p1Proj = p1.clone().addScaledVector(uEdge, t1ProjDist);
            const w1_0 = t1.clone().sub(p1Proj);
            const h1 = w1_0.length();
            const w1_1 = nOut.clone().multiplyScalar(h1);
            const cross1 = w1_0.clone().cross(w1_1);
            const rotAxis1 = cross1.length() > 1e-5 ? cross1.clone().normalize() : uEdge;
            const ang1 = Math.acos(Math.max(-1, Math.min(1, w1_0.dot(w1_1) / (h1 * h1 || 1))));
            const t1Current = p1Proj.clone().add(w1_0.clone().applyAxisAngle(rotAxis1, unfold * ang1));

            // T2 rotation
            const t2ProjDist = t2.clone().sub(p2).dot(uEdge);
            const p2Proj = p2.clone().addScaledVector(uEdge, t2ProjDist);
            const w2_0 = t2.clone().sub(p2Proj);
            const h2 = w2_0.length();
            const w2_1 = nOut.clone().multiplyScalar(h2);
            const cross2 = w2_0.clone().cross(w2_1);
            const rotAxis2 = cross2.length() > 1e-5 ? cross2.clone().normalize() : uEdge;
            const ang2 = Math.acos(Math.max(-1, Math.min(1, w2_0.dot(w2_1) / (h2 * h2 || 1))));
            const t2Current = p2Proj.clone().add(w2_0.clone().applyAxisAngle(rotAxis2, unfold * ang2));

            if (i === 0) {
              topFace0_T1 = t1Current;
              topFace0_T2 = t2Current;
              topFace0_nOut = nOut;
            }

            // Quad mesh
            if (showFaces) {
              const quadGeom = new THREE.BufferGeometry();
              const verts = new Float32Array([
                p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, t2Current.x, t2Current.y, t2Current.z,
                p1.x, p1.y, p1.z, t2Current.x, t2Current.y, t2Current.z, t1Current.x, t1Current.y, t1Current.z,
              ]);
              quadGeom.setAttribute("position", new THREE.BufferAttribute(verts, 3));
              quadGeom.computeVertexNormals();
              group.add(new THREE.Mesh(quadGeom, baseFaceMat));
            }

            // Crease line (hinge on base)
            const creaseGeom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
            const creaseMat = new THREE.LineDashedMaterial({ color: new THREE.Color(COLORS.emerald), dashSize: 0.15, gapSize: 0.08 });
            const creaseLine = new THREE.Line(creaseGeom, creaseMat);
            creaseLine.computeLineDistances();
            group.add(creaseLine);

            // Outer outlines
            const outlineGeom = new THREE.BufferGeometry().setFromPoints([p1, t1Current, t2Current, p2]);
            group.add(new THREE.Line(outlineGeom, new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.amber), linewidth: 2 })));

            // Top vertices markers & labels
            [
              { pos: t1Current, name: topPts[i].name },
              { pos: t2Current, name: topPts[(i + 1) % topPts.length].name },
            ].forEach((pt) => {
              const s = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.cyan) }));
              s.position.copy(pt.pos);
              group.add(s);
              const lbl = createTextSprite(pt.name, COLORS.cyan);
              lbl.position.set(pt.pos.x, pt.pos.y + 0.25, pt.pos.z);
              group.add(lbl);
            });
          }

          // Top Cap Unfolding (Attached to top of Face 0)
          if (topFace0_T1 && topFace0_T2 && topFace0_nOut) {
            const t0 = topPts[0].pos;
            const t1 = topPts[1].pos;
            const uTopEdge = t1.clone().sub(t0).normalize();
            const centerTop = new THREE.Vector3(0, 0, 0);
            topPts.forEach((p) => centerTop.add(p.pos));
            centerTop.divideScalar(topPts.length);
            const midTopEdge = t0.clone().add(t1).multiplyScalar(0.5);

            let nInTop = new THREE.Vector3(-uTopEdge.z, 0, uTopEdge.x);
            if (nInTop.dot(centerTop.clone().sub(midTopEdge)) < 0) {
              nInTop.negate();
            }

            const uEdge0Unfolded = topFace0_T2.clone().sub(topFace0_T1).normalize();

            const topCapUnfoldedPts: THREE.Vector3[] = [];
            for (let k = 0; k < topPts.length; k++) {
              const origPt = topPts[k].pos;
              const vRel = origPt.clone().sub(t0);
              const cu = vRel.dot(uTopEdge);
              const cPerp = vRel.dot(nInTop);

              const flatPt = topFace0_T1.clone()
                .addScaledVector(uEdge0Unfolded, cu)
                .addScaledVector(topFace0_nOut, cPerp);

              const curPt = origPt.clone().lerp(flatPt, unfold);
              topCapUnfoldedPts.push(curPt);
            }

            if (showFaces && topCapUnfoldedPts.length >= 3) {
              const verts: number[] = [];
              for (let k = 1; k < topCapUnfoldedPts.length - 1; k++) {
                verts.push(
                  topCapUnfoldedPts[0].x, topCapUnfoldedPts[0].y, topCapUnfoldedPts[0].z,
                  topCapUnfoldedPts[k].x, topCapUnfoldedPts[k].y, topCapUnfoldedPts[k].z,
                  topCapUnfoldedPts[k + 1].x, topCapUnfoldedPts[k + 1].y, topCapUnfoldedPts[k + 1].z
                );
              }
              const topGeom = new THREE.BufferGeometry();
              topGeom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
              topGeom.computeVertexNormals();
              group.add(new THREE.Mesh(topGeom, topCapMat));
            }

            const topOutlinePts = [...topCapUnfoldedPts, topCapUnfoldedPts[0]];
            group.add(new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(topOutlinePts),
              new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.cyan), linewidth: 2 })
            ));
          }
        }

        // 3. RENDER BASE VERTICES & LABELS
        basePts.forEach((p) => {
          const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.042, 16, 16),
            new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.emerald) })
          );
          mesh.position.copy(p.pos);
          group.add(mesh);

          const label = createTextSprite(p.name, COLORS.emerald);
          label.position.set(p.pos.x, p.pos.y + 0.25, p.pos.z);
          group.add(label);
        });
      } else {
        // ====================================================
        // EXPLODE MODE (BÓC TÁCH KHÔNG GIAN)
        // ====================================================
        const explodeDist = unfold * 1.5;
        const centerBase = new THREE.Vector3(0, 0, 0);
        basePts.forEach((p) => centerBase.add(p.pos));
        if (basePts.length > 0) centerBase.divideScalar(basePts.length);

        // Displaced Base
        const baseDisp = new THREE.Vector3(0, -unfold * 1.1, 0);
        const dispBasePts = basePts.map((p) => p.pos.clone().add(baseDisp));

        if (showFaces && dispBasePts.length >= 3) {
          const verts: number[] = [];
          for (let k = 1; k < dispBasePts.length - 1; k++) {
            verts.push(
              dispBasePts[0].x, dispBasePts[0].y, dispBasePts[0].z,
              dispBasePts[k].x, dispBasePts[k].y, dispBasePts[k].z,
              dispBasePts[k + 1].x, dispBasePts[k + 1].y, dispBasePts[k + 1].z
            );
          }
          const bGeom = new THREE.BufferGeometry();
          bGeom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
          bGeom.computeVertexNormals();
          group.add(new THREE.Mesh(bGeom, capMat));
        }
        group.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([...dispBasePts, dispBasePts[0]]),
          new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.emerald), linewidth: 2 })
        ));

        dispBasePts.forEach((pos, idx) => {
          const s = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.emerald) }));
          s.position.copy(pos);
          group.add(s);
          const lbl = createTextSprite(basePts[idx].name, COLORS.emerald);
          lbl.position.set(pos.x, pos.y + 0.25, pos.z);
          group.add(lbl);
        });

        if (apex) {
          for (let i = 0; i < basePts.length; i++) {
            const p1 = basePts[i].pos;
            const p2 = basePts[(i + 1) % basePts.length].pos;
            const cFace = p1.clone().add(p2).add(apex.pos).divideScalar(3);
            let nFace = p2.clone().sub(p1).cross(apex.pos.clone().sub(p1)).normalize();
            if (nFace.dot(cFace.clone().sub(centerBase)) < 0) nFace.negate();
            const faceDisp = nFace.clone().multiplyScalar(explodeDist);

            const dp1 = p1.clone().add(faceDisp);
            const dp2 = p2.clone().add(faceDisp);
            const da = apex.pos.clone().add(faceDisp);

            if (showFaces) {
              const triGeom = new THREE.BufferGeometry();
              const verts = new Float32Array([da.x, da.y, da.z, dp1.x, dp1.y, dp1.z, dp2.x, dp2.y, dp2.z]);
              triGeom.setAttribute("position", new THREE.BufferAttribute(verts, 3));
              triGeom.computeVertexNormals();
              group.add(new THREE.Mesh(triGeom, baseFaceMat));
            }

            group.add(new THREE.Line(
              new THREE.BufferGeometry().setFromPoints([dp1, dp2, da, dp1]),
              new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.amber), linewidth: 2 })
            ));
          }
        } else if (topPts.length >= 3) {
          for (let i = 0; i < basePts.length; i++) {
            const p1 = basePts[i].pos;
            const p2 = basePts[(i + 1) % basePts.length].pos;
            const t1 = topPts[i].pos;
            const t2 = topPts[(i + 1) % topPts.length].pos;

            const cFace = p1.clone().add(p2).add(t1).add(t2).divideScalar(4);
            let nFace = p2.clone().sub(p1).cross(t1.clone().sub(p1)).normalize();
            if (nFace.dot(cFace.clone().sub(centerBase)) < 0) nFace.negate();
            const faceDisp = nFace.clone().multiplyScalar(explodeDist);

            const dp1 = p1.clone().add(faceDisp);
            const dp2 = p2.clone().add(faceDisp);
            const dt1 = t1.clone().add(faceDisp);
            const dt2 = t2.clone().add(faceDisp);

            if (showFaces) {
              const quadGeom = new THREE.BufferGeometry();
              const verts = new Float32Array([
                dp1.x, dp1.y, dp1.z, dp2.x, dp2.y, dp2.z, dt2.x, dt2.y, dt2.z,
                dp1.x, dp1.y, dp1.z, dt2.x, dt2.y, dt2.z, dt1.x, dt1.y, dt1.z,
              ]);
              quadGeom.setAttribute("position", new THREE.BufferAttribute(verts, 3));
              quadGeom.computeVertexNormals();
              group.add(new THREE.Mesh(quadGeom, baseFaceMat));
            }

            group.add(new THREE.Line(
              new THREE.BufferGeometry().setFromPoints([dp1, dp2, dt2, dt1, dp1]),
              new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.amber), linewidth: 2 })
            ));
          }

          const topDisp = new THREE.Vector3(0, unfold * 1.1, 0);
          const dispTopPts = topPts.map((p) => p.pos.clone().add(topDisp));
          if (showFaces && dispTopPts.length >= 3) {
            const verts: number[] = [];
            for (let k = 1; k < dispTopPts.length - 1; k++) {
              verts.push(
                dispTopPts[0].x, dispTopPts[0].y, dispTopPts[0].z,
                dispTopPts[k].x, dispTopPts[k].y, dispTopPts[k].z,
                dispTopPts[k + 1].x, dispTopPts[k + 1].y, dispTopPts[k + 1].z
              );
            }
            const tGeom = new THREE.BufferGeometry();
            tGeom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
            tGeom.computeVertexNormals();
            group.add(new THREE.Mesh(tGeom, topCapMat));
          }
          group.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([...dispTopPts, dispTopPts[0]]),
            new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.cyan), linewidth: 2 })
          ));

          dispTopPts.forEach((pos, idx) => {
            const s = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.cyan) }));
            s.position.copy(pos);
            group.add(s);
            const lbl = createTextSprite(topPts[idx].name, COLORS.cyan);
            lbl.position.set(pos.x, pos.y + 0.25, pos.z);
            group.add(lbl);
          });
        }
      }
      return;
    }

    // 1. RENDER BASE POLYGON MESH & OUTLINE
    if (basePts.length >= 3) {
      if (showFaces) {
        const baseShape = new THREE.Shape();
        basePts.forEach((p, idx) => {
          if (idx === 0) baseShape.moveTo(p.pos.x, p.pos.z);
          else baseShape.lineTo(p.pos.x, p.pos.z);
        });
        baseShape.closePath();

        const baseGeom = new THREE.ShapeGeometry(baseShape);
        const baseMesh = new THREE.Mesh(baseGeom, capMat);
        baseMesh.rotation.x = Math.PI / 2;
        baseMesh.position.y = basePts[0].pos.y;
        group.add(baseMesh);
      }

      const baseEdgePts = [...basePts.map((p) => p.pos), basePts[0].pos];
      group.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(baseEdgePts),
          new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.emerald), linewidth: 2 })
        )
      );
    }

    // 2. RENDER PYRAMID FACES OR PRISM LATERAL FACES
    if (apex) {
      // Pyramid lateral faces
      for (let i = 0; i < basePts.length; i++) {
        const p1 = basePts[i].pos;
        const p2 = basePts[(i + 1) % basePts.length].pos;

        if (showFaces) {
          const triGeom = new THREE.BufferGeometry();
          const verts = new Float32Array([apex.pos.x, apex.pos.y, apex.pos.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z]);
          triGeom.setAttribute("position", new THREE.BufferAttribute(verts, 3));
          triGeom.computeVertexNormals();
          group.add(new THREE.Mesh(triGeom, baseFaceMat));
        }

        // Lateral edges
        const edgeGeom = new THREE.BufferGeometry().setFromPoints([apex.pos, p1]);
        group.add(new THREE.Line(edgeGeom, new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.amber), linewidth: 1.5 })));
      }
    } else if (topPts.length >= 3) {
      // Prism lateral faces & Top face
      for (let i = 0; i < basePts.length; i++) {
        const p1 = basePts[i].pos;
        const p2 = basePts[(i + 1) % basePts.length].pos;
        const p3 = topPts[(i + 1) % topPts.length].pos;
        const p4 = topPts[i].pos;

        if (showFaces) {
          const quadGeom = new THREE.BufferGeometry();
          const verts = new Float32Array([
            p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z,
            p1.x, p1.y, p1.z, p3.x, p3.y, p3.z, p4.x, p4.y, p4.z,
          ]);
          quadGeom.setAttribute("position", new THREE.BufferAttribute(verts, 3));
          quadGeom.computeVertexNormals();
          group.add(new THREE.Mesh(quadGeom, baseFaceMat));
        }

        // Lateral edges
        const edgeGeom = new THREE.BufferGeometry().setFromPoints([p1, p4]);
        group.add(new THREE.Line(edgeGeom, new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.amber), linewidth: 1.5 })));
      }

      // Top Cap
      if (showFaces) {
        const topShape = new THREE.Shape();
        topPts.forEach((p, idx) => {
          if (idx === 0) topShape.moveTo(p.pos.x, p.pos.z);
          else topShape.lineTo(p.pos.x, p.pos.z);
        });
        topShape.closePath();

        const topGeom = new THREE.ShapeGeometry(topShape);
        const topMesh = new THREE.Mesh(topGeom, topCapMat);
        topMesh.rotation.x = Math.PI / 2;
        topMesh.position.y = topPts[0].pos.y;
        group.add(topMesh);
      }

      const topEdgePts = [...topPts.map((p) => p.pos), topPts[0].pos];
      group.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(topEdgePts),
          new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.cyan), linewidth: 2 })
        )
      );
    }

    // 3. RENDER ALL VERTICES & INTERACTIVE HIT TARGETS & CRISP LABELS
    const sphereGeom = new THREE.SphereGeometry(0.038, 16, 16);
    const customSphereGeom = new THREE.SphereGeometry(0.045, 16, 16);
    const hitTargetGeom = new THREE.SphereGeometry(0.22, 8, 8);
    const invisibleHitMat = new THREE.MeshBasicMaterial({ visible: false });

    interactiveMetas.forEach((meta) => {
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(meta.color),
      });

      const mesh = new THREE.Mesh(meta.isCustom ? customSphereGeom : sphereGeom, mat);
      mesh.position.copy(meta.pos);
      group.add(mesh);

      // Invisible Hit Sphere for Easy Raycasting Click & Drag
      const hitMesh = new THREE.Mesh(hitTargetGeom, invisibleHitMat);
      hitMesh.position.copy(meta.pos);
      group.add(hitMesh);
      hitMeshesRef.current.push(hitMesh);
      hitMeshToMetaRef.current.set(hitMesh, meta);

      // Label sprite offset slightly above/outside
      const label = createTextSprite(meta.name, meta.color);
      label.position.set(meta.pos.x, meta.pos.y + 0.28, meta.pos.z);
      group.add(label);
    });

    // 4. RENDER CUSTOM GEOMETRIC LINES / SEGMENTS
    customLines.forEach((ln) => {
      if (pointMap.has(ln.p1) && pointMap.has(ln.p2)) {
        const v1 = pointMap.get(ln.p1)!;
        const v2 = pointMap.get(ln.p2)!;
        const lineGeom = new THREE.BufferGeometry().setFromPoints([v1, v2]);

        if (ln.style === "dashed") {
          const mat = new THREE.LineDashedMaterial({
            color: new THREE.Color(ln.color),
            dashSize: 0.16,
            gapSize: 0.1,
            linewidth: ln.width || 2,
          });
          const line = new THREE.Line(lineGeom, mat);
          line.computeLineDistances();
          group.add(line);
        } else {
          const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(ln.color), linewidth: ln.width || 2 });
          group.add(new THREE.Line(lineGeom, mat));
        }
      }
    });

    // 6. RENDER CUSTOM GEOMETRIC PLANES / SECTIONS
    customPlanes.forEach((pl) => {
      const validPts: THREE.Vector3[] = [];
      pl.points.forEach((ptName) => {
        if (pointMap.has(ptName.trim())) {
          validPts.push(pointMap.get(ptName.trim())!);
        }
      });

      if (validPts.length >= 3) {
        const planeMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(pl.color),
          transparent: true,
          opacity: pl.opacity || 0.45,
          side: THREE.DoubleSide,
          depthWrite: false,
        });

        // Fan triangulation for convex polygon
        const verts: number[] = [];
        for (let i = 1; i < validPts.length - 1; i++) {
          verts.push(
            validPts[0].x, validPts[0].y, validPts[0].z,
            validPts[i].x, validPts[i].y, validPts[i].z,
            validPts[i + 1].x, validPts[i + 1].y, validPts[i + 1].z
          );
        }

        const pGeom = new THREE.BufferGeometry();
        pGeom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
        pGeom.computeVertexNormals();
        group.add(new THREE.Mesh(pGeom, planeMat));

        // Outline of the plane
        const outlinePts = [...validPts, validPts[0]];
        const outGeom = new THREE.BufferGeometry().setFromPoints(outlinePts);
        group.add(new THREE.Line(outGeom, new THREE.LineBasicMaterial({ color: new THREE.Color(pl.color), linewidth: 2.2 })));
      }
    });

    // 7. PARALLEL CROSS-SECTION IF ENABLED
    if (showCross && unfold === 0) {
      const yPos = -totalHeight / 2 + crossT * totalHeight;
      const discR = 1.6 * (1 - (apex ? crossT * 0.7 : 0));
      const discGeom = new THREE.CircleGeometry(discR, basePts.length >= 3 ? basePts.length : 32);
      const discMesh = new THREE.Mesh(
        discGeom,
        new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.rose), transparent: true, opacity: 0.45, side: THREE.DoubleSide })
      );
      discMesh.rotation.x = -Math.PI / 2;
      discMesh.position.y = yPos;
      group.add(discMesh);

      const discOutline = new THREE.LineSegments(
        new THREE.EdgesGeometry(discGeom, 1),
        new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.rose) })
      );
      discOutline.rotation.x = -Math.PI / 2;
      discOutline.position.y = yPos;
      group.add(discOutline);
    }
  }, [geometryData, customLines, customPlanes, showCross, crossT, unfold, unfoldMode, showFaces, faceOpacity]);

  // ==========================================================
  // PRESET SCENARIO APPLIER (BÀI TOÁN MẪU KINH ĐIỂN)
  // ==========================================================
  const loadPreset = (presetId: string) => {
    if (presetId === "sa_perp_triangle") {
      setCategory("custom_pyramid");
      setPyrApexType("sa_perp");
      setPyrBaseShape("triangle_right");
      setPyrA(3.0);
      setPyrB(2.2);
      setPyrH(3.4);
      setCustomPoints([
        { id: "pt_m", name: "M", type: "midpoint", p1: "S", p2: "A", ratio: 0.5, color: COLORS.cyan },
        { id: "pt_n", name: "N", type: "midpoint", p1: "S", p2: "B", ratio: 0.5, color: COLORS.cyan },
        { id: "pt_p", name: "P", type: "midpoint", p1: "S", p2: "C", ratio: 0.5, color: COLORS.cyan },
      ]);
      setCustomLines([
        { id: "ln_mn", p1: "M", p2: "N", style: "dashed", color: COLORS.cyan, width: 2 },
        { id: "ln_np", p1: "N", p2: "P", style: "dashed", color: COLORS.cyan, width: 2 },
        { id: "ln_pm", p1: "P", p2: "M", style: "dashed", color: COLORS.cyan, width: 2 },
      ]);
      setCustomPlanes([{ id: "pl_mnp", name: "(MNP)", points: ["M", "N", "P"], color: COLORS.cyan, opacity: 0.45 }]);
    } else if (presetId === "rect_pyramid_sbd") {
      setCategory("custom_pyramid");
      setPyrApexType("sa_perp");
      setPyrBaseShape("quad_rect");
      setPyrA(3.2);
      setPyrB(2.2);
      setPyrH(3.5);
      setCustomPoints([
        { id: "pt_o", name: "O", type: "midpoint", p1: "A", p2: "C", ratio: 0.5, color: COLORS.emerald },
        { id: "pt_k", name: "K", type: "midpoint", p1: "S", p2: "C", ratio: 0.5, color: COLORS.rose },
      ]);
      setCustomLines([
        { id: "ln_ac", p1: "A", p2: "C", style: "dashed", color: COLORS.emerald, width: 1.5 },
        { id: "ln_bd", p1: "B", p2: "D", style: "dashed", color: COLORS.emerald, width: 1.5 },
        { id: "ln_so", p1: "S", p2: "O", style: "dashed", color: COLORS.amber, width: 2 },
        { id: "ln_ok", p1: "O", p2: "K", style: "solid", color: COLORS.rose, width: 2 },
      ]);
      setCustomPlanes([{ id: "pl_sbd", name: "(SBD)", points: ["S", "B", "D"], color: COLORS.amber, opacity: 0.4 }]);
    } else if (presetId === "prism_section") {
      setCategory("custom_prism");
      setPrismKind("right");
      setPrismBaseShape("triangle_equilateral");
      setPrismA(2.8);
      setPrismH(3.4);
      setCustomPoints([
        { id: "pt_m", name: "M", type: "midpoint", p1: "B'", p2: "C'", ratio: 0.5, color: COLORS.rose },
        { id: "pt_g", name: "G", type: "centroid", triangle: ["A", "B", "C"], color: COLORS.emerald },
      ]);
      setCustomLines([
        { id: "ln_am", p1: "A", p2: "M", style: "dashed", color: COLORS.rose, width: 2 },
        { id: "ln_abp", p1: "A", p2: "B'", style: "dashed", color: COLORS.cyan, width: 1.5 },
        { id: "ln_acp", p1: "A", p2: "C'", style: "dashed", color: COLORS.cyan, width: 1.5 },
      ]);
      setCustomPlanes([{ id: "pl_abpcp", name: "(AB'C')", points: ["A", "B'", "C'"], color: COLORS.cyan, opacity: 0.42 }]);
    } else if (presetId === "oblique_prism") {
      setCategory("custom_prism");
      setPrismKind("oblique");
      setPrismBaseShape("triangle_equilateral");
      setPrismA(2.6);
      setPrismH(3.2);
      setPrismSlantDx(1.2);
      setPrismSlantDz(0.5);
      setCustomPoints([]);
      setCustomLines([]);
      setCustomPlanes([]);
    }
  };

  // Add Point Handler
  const handleAddPoint = () => {
    if (!newPtName.trim()) return;
    const name = newPtName.trim().toUpperCase();
    let pointType: GeoPoint["type"] = "ratio";

    if (newPtType === "segment") {
      pointType = "ratio";
    } else if (newPtType === "line") {
      pointType = "line_point";
    } else if (newPtType === "plane") {
      pointType = "plane_point";
    } else if (newPtType === "centroid") {
      pointType = "centroid";
    } else if (newPtType === "parallel_point") {
      pointType = "parallel_point";
    } else if (newPtType === "perp_proj") {
      pointType = "perp_proj";
    } else {
      pointType = "custom_xyz";
    }

    const newPt: GeoPoint = {
      id: `pt_${Date.now()}`,
      name,
      type: pointType,
      p1: newPtP1,
      p2: newPtP2,
      ratio: newPtRatio,
      lineP1: newPtLineP1,
      lineP2: newPtLineP2,
      lineT: 0.5,
      triangle: newPtType === "plane" ? newPtPlaneTri : newPtTri,
      parallelRef:
        newPtType === "parallel_point"
          ? {
              throughPoint: newPtParThrough,
              parallelToP1: newPtParP1,
              parallelToP2: newPtParP2,
              scale: newPtParScale,
            }
          : undefined,
      perpProjRef:
        newPtType === "perp_proj"
          ? {
              fromPoint: newPtPerpFrom,
              toLineP1: newPtPerpTo1,
              toLineP2: newPtPerpTo2,
            }
          : undefined,
      customPos: { x: newPtX, y: newPtY, z: newPtZ },
      color: COLORS.cyan,
    };
    setCustomPoints([...customPoints.filter((p) => p.name !== name), newPt]);
    setNewPtName(String.fromCharCode(name.charCodeAt(0) + 1));
  };

  const handleResetVertices = () => {
    setBaseOffsets({});
    setPyrApexDx(0);
    setPyrApexDz(0);
    setPrismSlantDx(0);
    setPrismSlantDz(0);
  };

  // Add Line Handler
  const handleAddLine = () => {
    if (newLineP1 === newLineP2) return;
    const newLn: GeoLine = {
      id: `ln_${Date.now()}`,
      p1: newLineP1,
      p2: newLineP2,
      style: newLineStyle,
      color: newLineColor,
      width: 2,
    };
    setCustomLines([...customLines, newLn]);
  };

  // Add Plane Handler
  const handleAddPlane = () => {
    const pts = newPlanePts.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (pts.length < 3) return;
    const newPl: GeoPlane = {
      id: `pl_${Date.now()}`,
      name: `(${pts.join("")})`,
      points: pts,
      color: newPlaneColor,
      opacity: 0.42,
    };
    setCustomPlanes([...customPlanes, newPl]);
  };

  const allAvailablePointNames = Array.from(geometryData.pointMap.keys());
  const hasMovedVertices = Object.keys(baseOffsets).length > 0 || pyrApexDx !== 0 || pyrApexDz !== 0;

  return (
    <div id="module-polyhedra" className="grid grid-cols-1 md:grid-cols-12 gap-3">
      {/* LEFT 3D VIEWPORT & TELEMETRY */}
      <div className="md:col-span-8 flex flex-col gap-3">
        <Panel
          id="polyhedra-canvas-panel"
          title="KHÔNG GIAN HÌNH HỌC 3D // POLYHEDRA_VIEWPORT"
          badge="3D_SOLID"
          isFullScreen={isFullScreen}
          onToggleFullScreen={() => setIsFullScreen((f) => !f)}
          onDownloadImage={() => downloadCanvas3D(containerRef.current, `hinh-khong-gian-3d-${category}-${Date.now()}`)}
          downloadLabel="TẢI ẢNH 3D (PNG)"
          action={
            <div className="flex items-center gap-1.5 flex-wrap">
              {hasMovedVertices && (
                <button
                  type="button"
                  id="btn-poly-reset-vertices"
                  onClick={handleResetVertices}
                  className="px-2 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/50 rounded-2xs text-[10px] font-mono transition-colors active:scale-95"
                  title="Khôi phục các đỉnh về vị trí chuẩn"
                >
                  ↺ KHÔI PHỤC VỊ TRÍ ĐỈNH
                </button>
              )}
              <button
                type="button"
                id="btn-poly-toggle-faces"
                onClick={() => setShowFaces(!showFaces)}
                className={`px-2 py-0.5 border rounded-2xs text-[10px] font-mono transition-colors active:scale-95 ${
                  showFaces
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700"
                }`}
                title="Ẩn hoặc hiện màu sắc các mặt của khối đa diện (Wireframe / Tô màu 3D)"
              >
                {showFaces ? "🎨 MÀU MẶT: BẬT" : "▢ MÀU MẶT: TẮT (KHUNG DÂY)"}
              </button>
              <button
                type="button"
                id="btn-poly-autorotate"
                onClick={toggleAutoRotate}
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
                id="btn-polyhedra-reset-view"
                onClick={() => resetRef.current?.()}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-2xs text-[10px] font-mono transition-colors active:scale-95"
                title="Căn giữa lại khối 3D"
              >
                CĂN GIỮA // RESET
              </button>
            </div>
          }
        >
          <div className={`relative bg-slate-950 border border-slate-800/80 rounded-2xs overflow-hidden flex items-center justify-center select-none ${isFullScreen ? "w-full flex-1 h-full min-h-0" : ""}`}>
            <div ref={containerRef} className={`w-full ${isFullScreen ? "h-full min-h-[calc(100vh-140px)]" : "h-[400px]"} cursor-grab active:cursor-grabbing`} />

            {/* Top HUD info tags */}
            <div className="absolute top-2 left-2 flex gap-1.5 font-mono text-[9px] pointer-events-none flex-wrap max-w-[85%]">
              <span className="bg-slate-900/90 border border-slate-800 text-cyan-400 px-1.5 py-0.5 rounded-2xs">
                XOAY 360° // KÉO THẢ ĐIỂM
              </span>
              <span className="bg-slate-900/90 border border-slate-800 text-slate-300 px-1.5 py-0.5 rounded-2xs">
                CUỘN CHUỘT: ZOOM
              </span>
              <span className={`border px-1.5 py-0.5 rounded-2xs font-mono text-[9px] ${
                showFaces
                  ? "bg-amber-950/90 border-amber-800/80 text-amber-300"
                  : "bg-slate-900/90 border-slate-700 text-slate-400"
              }`}>
                {showFaces ? `MẶT: TÔ MÀU (${fmt(faceOpacity * 100, 0)}%)` : "MẶT: KHUNG DÂY"}
              </span>
              <span className="bg-slate-900/90 border border-slate-800 text-emerald-400 px-1.5 py-0.5 rounded-2xs">
                {geometryData.shapeDesc}
              </span>
              {unfold > 0 && (
                <span className="bg-amber-950/90 border border-amber-500/80 text-amber-300 px-1.5 py-0.5 rounded-2xs font-bold animate-pulse">
                  {unfoldMode === "net" ? "📐 TRẢI PHẲNG (NET)" : "💥 BÓC TÁCH (EXPLODE)"}: {fmt(unfold * 100, 0)}%
                </span>
              )}
            </div>

            {/* Quick Perspective Switcher Bar */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-1.5 bg-slate-900/90 border border-slate-800/90 p-1 rounded-xs backdrop-blur-sm">
              <span className="text-slate-400 text-[9px] font-mono px-1">GÓC NHÌN:</span>
              <button
                type="button"
                onClick={() => presetRef.current?.("iso")}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-2xs text-[9px] font-mono transition-colors active:scale-95"
              >
                3D Phối cảnh
              </button>
              <button
                type="button"
                onClick={() => presetRef.current?.("top")}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-2xs text-[9px] font-mono transition-colors active:scale-95"
              >
                Từ trên (Top)
              </button>
              <button
                type="button"
                onClick={() => presetRef.current?.("bottom")}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-2xs text-[9px] font-mono transition-colors active:scale-95"
              >
                Từ dưới (Bottom)
              </button>
              <button
                type="button"
                onClick={() => presetRef.current?.("front")}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-2xs text-[9px] font-mono transition-colors active:scale-95"
              >
                Chính diện
              </button>
              <button
                type="button"
                onClick={() => presetRef.current?.("side")}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-2xs text-[9px] font-mono transition-colors active:scale-95"
              >
                Bên hông
              </button>
            </div>
          </div>
        </Panel>

        {/* METRIC & FORMULA MATRIX */}
        <Formula id="polyhedra-formulas" title="THÔNG SỐ HÌNH HỌC & THỂ TÍCH (GDPT 2018)">
          {`// THÔNG TIN KHỐI: ${geometryData.shapeDesc}\n` +
            `S_đáy = ${fmt(geometryData.baseArea, 3)} (đvdt) | Chu vi đáy P = ${fmt(geometryData.basePerimeter, 3)}\n` +
            `Chiều cao h = ${fmt(geometryData.totalHeight, 2)} (đvđd)\n` +
            `Thể tích V = ${
              geometryData.apex ? "(1/3) × S_đáy × h" : "S_đáy × h"
            } = ${fmt(geometryData.volume, 3)} (đvtt)\n` +
            `Số đỉnh: ${geometryData.pointMap.size} | Số đoạn nối vẽ thêm: ${customLines.length} | Mặt phẳng: ${customPlanes.length}`}
        </Formula>
      </div>

      {/* RIGHT CONTROL DASHBOARD (3 TABS) */}
      <div className="md:col-span-4">
        <Panel id="polyhedra-controls-panel" title="THAM SỐ & YẾU TỐ HÌNH HỌC" badge="POLY_CONTROLS">
          {/* TOP TAB SWITCHER */}
          <div className="flex bg-slate-950 p-0.5 rounded-2xs border border-slate-800 mb-3">
            <button
              type="button"
              id="tab-poly-shape"
              onClick={() => setActiveTab("shape")}
              className={`flex-1 py-1 text-[10px] font-mono rounded-2xs transition-colors ${
                activeTab === "shape"
                  ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              1. Khối & Tham số
            </button>
            <button
              type="button"
              id="tab-poly-draw"
              onClick={() => setActiveTab("draw")}
              className={`flex-1 py-1 text-[10px] font-mono rounded-2xs transition-colors ${
                activeTab === "draw"
                  ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              2. Vẽ Điểm/Đường/Mặt
            </button>
            <button
              type="button"
              id="tab-poly-unfold"
              onClick={() => setActiveTab("unfold")}
              className={`flex-1 py-1 text-[10px] font-mono rounded-2xs transition-colors ${
                activeTab === "unfold"
                  ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              3. Thiết diện & Cắt
            </button>
          </div>

          {/* TAB 1: SHAPE & PARAMETERS */}
          {activeTab === "shape" && (
            <div>
              <SectionLabel iconColor="bg-indigo-500">CHỌN LOẠI HÌNH ĐA DIỆN</SectionLabel>
              <ChipGroup
                id="poly-category-chips"
                value={category}
                onChange={setCategory}
                options={[
                  { value: "custom_pyramid", label: "Hình chóp tùy biến" },
                  { value: "custom_prism", label: "Hình lăng trụ tùy biến" },
                  { value: "regular", label: "Khối đều / Chuẩn" },
                ]}
              />

              {/* PRESET TEMPLATES */}
              <div className="mb-3 p-2 bg-slate-950/60 border border-slate-800/80 rounded-2xs">
                <span className="text-[10px] font-mono text-slate-400 block mb-1 font-semibold">
                  📌 BÀI TOÁN MẪU KINH ĐIỂN 11-12:
                </span>
                <div className="grid grid-cols-2 gap-1 font-mono text-[9px]">
                  <button
                    type="button"
                    onClick={() => loadPreset("sa_perp_triangle")}
                    className="p-1 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-cyan-300 rounded-2xs text-left"
                  >
                    1. Chóp S.ABC: SA ⊥ Đáy
                  </button>
                  <button
                    type="button"
                    onClick={() => loadPreset("rect_pyramid_sbd")}
                    className="p-1 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-amber-300 rounded-2xs text-left"
                  >
                    2. Chóp S.ABCD đáy HCN
                  </button>
                  <button
                    type="button"
                    onClick={() => loadPreset("prism_section")}
                    className="p-1 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-emerald-300 rounded-2xs text-left"
                  >
                    3. Lăng trụ ABC.A'B'C'
                  </button>
                  <button
                    type="button"
                    onClick={() => loadPreset("oblique_prism")}
                    className="p-1 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-purple-300 rounded-2xs text-left"
                  >
                    4. Lăng trụ xiên
                  </button>
                </div>
              </div>

              {/* CATEGORY: CUSTOM PYRAMID */}
              {category === "custom_pyramid" && (
                <>
                  <SectionLabel iconColor="bg-amber-500">VỊ TRÍ ĐỈNH S // ĐƯỜNG CAO</SectionLabel>
                  <ChipGroup
                    id="pyr-apex-chips"
                    value={pyrApexType}
                    onChange={setPyrApexType}
                    options={[
                      { value: "sa_perp", label: "Cạnh SA ⊥ Đáy" },
                      { value: "face_perp", label: "Mặt (SAB) ⊥ Đáy" },
                      { value: "regular", label: "Chóp đều (SO ⊥ Đáy)" },
                      { value: "custom_offset", label: "Đỉnh S tùy ý (dx, dz)" },
                    ]}
                  />

                  <SectionLabel iconColor="bg-cyan-500">DẠNG MẶT ĐÁY</SectionLabel>
                  <ChipGroup
                    id="pyr-base-chips"
                    value={pyrBaseShape}
                    onChange={setPyrBaseShape}
                    options={[
                      { value: "triangle_right", label: "Tam giác vuông tại A" },
                      { value: "triangle_equilateral", label: "Tam giác đều" },
                      { value: "triangle_general", label: "Tam giác thường" },
                      { value: "quad_rect", label: "Hình chữ nhật" },
                      { value: "quad_square", label: "Hình vuông" },
                      { value: "quad_parallelogram", label: "Hình bình hành" },
                      { value: "quad_trapezoid", label: "Hình thang vuông" },
                    ]}
                  />

                  <SectionLabel iconColor="bg-emerald-500">HỘP NHẬP KÍCH THƯỚC ĐÁY & CHIỀU CAO</SectionLabel>
                  <NumberInput
                    id="input-pyr-a"
                    label={pyrBaseShape.startsWith("triangle") ? "Cạnh đáy AB (a)" : "Chiều dài đáy (a)"}
                    value={pyrA}
                    min={0.8}
                    max={6.0}
                    step={0.1}
                    onChange={setPyrA}
                    color="cyan"
                    quickOptions={[2, 2.5, 3, 3.5, 4]}
                  />

                  {pyrBaseShape !== "triangle_equilateral" && pyrBaseShape !== "quad_square" && (
                    <NumberInput
                      id="input-pyr-b"
                      label={pyrBaseShape.startsWith("triangle") ? "Cạnh đáy AC (b)" : "Chiều rộng đáy (b)"}
                      value={pyrB}
                      min={0.8}
                      max={6.0}
                      step={0.1}
                      onChange={setPyrB}
                      color="emerald"
                      quickOptions={[1.5, 2, 2.2, 2.5, 3]}
                    />
                  )}

                  {(pyrBaseShape === "triangle_general" || pyrBaseShape === "quad_parallelogram") && (
                    <NumberInput
                      id="input-pyr-angle"
                      label="Góc đáy α (độ)"
                      value={pyrAngle}
                      min={20}
                      max={150}
                      step={5}
                      onChange={setPyrAngle}
                      color="amber"
                      quickOptions={[30, 45, 60, 90, 120]}
                    />
                  )}

                  <NumberInput
                    id="input-pyr-h"
                    label="Chiều cao h"
                    value={pyrH}
                    min={1.0}
                    max={7.0}
                    step={0.1}
                    onChange={setPyrH}
                    color="amber"
                    quickOptions={[2.5, 3, 3.2, 3.5, 4]}
                  />

                  {pyrApexType === "custom_offset" && (
                    <div className="grid grid-cols-2 gap-2">
                      <NumberInput
                        id="input-pyr-dx"
                        label="Độ lệch đỉnh Δx"
                        value={pyrApexDx}
                        min={-3}
                        max={3}
                        step={0.1}
                        onChange={setPyrApexDx}
                        color="rose"
                      />
                      <NumberInput
                        id="input-pyr-dz"
                        label="Độ lệch đỉnh Δz"
                        value={pyrApexDz}
                        min={-3}
                        max={3}
                        step={0.1}
                        onChange={setPyrApexDz}
                        color="rose"
                      />
                    </div>
                  )}
                </>
              )}

              {/* CATEGORY: CUSTOM PRISM */}
              {category === "custom_prism" && (
                <>
                  <SectionLabel iconColor="bg-amber-500">KIỂU LĂNG TRỤ</SectionLabel>
                  <ChipGroup
                    id="prism-kind-chips"
                    value={prismKind}
                    onChange={setPrismKind}
                    options={[
                      { value: "right", label: "Lăng trụ đứng" },
                      { value: "oblique", label: "Lăng trụ xiên" },
                    ]}
                  />

                  <SectionLabel iconColor="bg-cyan-500">DẠNG MẶT ĐÁY</SectionLabel>
                  <ChipGroup
                    id="prism-base-chips"
                    value={prismBaseShape}
                    onChange={setPrismBaseShape}
                    options={[
                      { value: "triangle_right", label: "Tam giác vuông" },
                      { value: "triangle_equilateral", label: "Tam giác đều" },
                      { value: "triangle_general", label: "Tam giác thường" },
                      { value: "quad_rect", label: "Hình chữ nhật" },
                      { value: "quad_square", label: "Hình vuông" },
                      { value: "quad_parallelogram", label: "Hình bình hành" },
                    ]}
                  />

                  <SectionLabel iconColor="bg-emerald-500">HỘP NHẬP KÍCH THƯỚC</SectionLabel>
                  <NumberInput
                    id="input-prism-a"
                    label="Cạnh đáy a"
                    value={prismA}
                    min={0.8}
                    max={6.0}
                    step={0.1}
                    onChange={setPrismA}
                    color="cyan"
                    quickOptions={[2, 2.5, 2.8, 3, 3.5]}
                  />

                  {prismBaseShape !== "triangle_equilateral" && prismBaseShape !== "quad_square" && (
                    <NumberInput
                      id="input-prism-b"
                      label="Cạnh đáy b"
                      value={prismB}
                      min={0.8}
                      max={6.0}
                      step={0.1}
                      onChange={setPrismB}
                      color="emerald"
                      quickOptions={[1.5, 2, 2.2, 2.5, 3]}
                    />
                  )}

                  <NumberInput
                    id="input-prism-h"
                    label="Chiều cao lăng trụ h"
                    value={prismH}
                    min={1.0}
                    max={7.0}
                    step={0.1}
                    onChange={setPrismH}
                    color="amber"
                    quickOptions={[2.5, 3, 3.4, 4]}
                  />

                  {prismKind === "oblique" && (
                    <div className="grid grid-cols-2 gap-2">
                      <NumberInput
                        id="input-prism-slantx"
                        label="Độ nghiêng Δx"
                        value={prismSlantDx}
                        min={-3}
                        max={3}
                        step={0.1}
                        onChange={setPrismSlantDx}
                        color="purple"
                      />
                      <NumberInput
                        id="input-prism-slantz"
                        label="Độ nghiêng Δz"
                        value={prismSlantDz}
                        min={-3}
                        max={3}
                        step={0.1}
                        onChange={setPrismSlantDz}
                        color="purple"
                      />
                    </div>
                  )}
                </>
              )}

              {/* CATEGORY: REGULAR POLYHEDRA */}
              {category === "regular" && (
                <>
                  <SectionLabel iconColor="bg-indigo-500">LOẠI KHỐI ĐỀU</SectionLabel>
                  <ChipGroup
                    id="poly-type-chips"
                    value={regType}
                    onChange={setRegType}
                    options={[
                      { value: "pyramid", label: "Hình chóp đều" },
                      { value: "prism", label: "Lăng trụ đứng đều" },
                    ]}
                  />
                  <SectionLabel iconColor="bg-cyan-500">SỐ CẠNH ĐÁY ĐỀU</SectionLabel>
                  <ChipGroup
                    id="poly-n-chips"
                    value={regN}
                    onChange={setRegN}
                    options={[3, 4, 5, 6].map((v) => ({ value: v, label: `n = ${v} (${SIDE_NAMES[v]})` }))}
                  />
                  <SectionLabel iconColor="bg-emerald-500">KÍCH THƯỚC</SectionLabel>
                  <NumberInput
                    id="input-poly-r"
                    label="Bán kính ngoại tiếp đáy R"
                    value={regR}
                    min={0.5}
                    max={5}
                    step={0.1}
                    onChange={setRegR}
                    color="cyan"
                    quickOptions={[1, 1.5, 1.8, 2, 2.5]}
                  />
                  <NumberInput
                    id="input-poly-h"
                    label="Chiều cao h"
                    value={regH}
                    min={0.5}
                    max={8}
                    step={0.1}
                    onChange={setRegH}
                    color="amber"
                    quickOptions={[2, 2.5, 3, 3.5, 4]}
                  />
                </>
              )}

              {/* FACE SHADING & WIREFRAME TOGGLE */}
              <SectionLabel iconColor="bg-amber-500">HIỂN THỊ MÀU SẮC CÁC MẶT // FACE SHADING</SectionLabel>
              <ToggleRow
                id="toggle-poly-show-faces-tab"
                label="Hiển thị màu sắc các mặt khối đa diện"
                checked={showFaces}
                onChange={setShowFaces}
              />
              {showFaces && (
                <div className="mb-3 p-2 bg-slate-950/60 border border-slate-800/80 rounded-2xs">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5 font-mono">
                    <span>Độ đậm màu sắc mặt:</span>
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
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DRAW GEOMETRIC ELEMENTS */}
          {activeTab === "draw" && (
            <div className="space-y-3 font-mono text-[11px]">
              {/* 1. ADD POINT */}
              <div className="bg-slate-950/70 p-2.5 rounded-2xs border border-slate-800">
                <div className="flex items-center justify-between text-cyan-400 font-bold mb-2">
                  <span>➕ 1. VẼ ĐIỂM HÌNH HỌC (3D POINT)</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Tên điểm:</label>
                    <input
                      type="text"
                      value={newPtName}
                      onChange={(e) => setNewPtName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 px-2 py-1 rounded-2xs text-cyan-300 font-bold"
                      placeholder="M, N, P, G, K..."
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Ràng buộc di chuyển:</label>
                    <select
                      value={newPtType}
                      onChange={(e) => setNewPtType(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 px-1 py-1 rounded-2xs text-slate-200 text-[10px]"
                    >
                      <option value="segment">① Trên đoạn thẳng [P1, P2] (Ưu tiên 1: Đoạn)</option>
                      <option value="line">② Trên đường thẳng (P1P2) (Ưu tiên 2: Đường)</option>
                      <option value="parallel_point">② Điểm song song (Ưu tiên 2: Qua P // P1P2)</option>
                      <option value="perp_proj">② Hình chiếu vuông góc (Ưu tiên 2: Từ P ⊥ P1P2)</option>
                      <option value="plane">③ Trên mặt phẳng (P1, P2, P3) (Ưu tiên 3: Mặt phẳng)</option>
                      <option value="centroid">③ Trọng tâm tam giác (Ưu tiên 3: Trọng tâm)</option>
                      <option value="custom_xyz">Tọa độ tự do (x, y, z)</option>
                    </select>
                  </div>
                </div>

                {/* PRIORITY 1: SEGMENT */}
                {newPtType === "segment" && (
                  <>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="text-[9px] text-slate-400 block">Đoạn thẳng từ P1:</label>
                        <select
                          value={newPtP1}
                          onChange={(e) => setNewPtP1(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 px-1 py-1 rounded-2xs text-slate-200 text-[10px]"
                        >
                          {allAvailablePointNames.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-400 block">Đến điểm P2:</label>
                        <select
                          value={newPtP2}
                          onChange={(e) => setNewPtP2(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 px-1 py-1 rounded-2xs text-slate-200 text-[10px]"
                        >
                          {allAvailablePointNames.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="mb-2">
                      <div className="flex justify-between text-[10px] text-slate-300 mb-1">
                        <span>Vị trí ban đầu trên đoạn (tỉ lệ k):</span>
                        <span className="text-cyan-400 font-bold">{fmt(newPtRatio, 2)}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={newPtRatio}
                        onChange={(e) => setNewPtRatio(parseFloat(e.target.value))}
                        className="w-full accent-cyan-400 h-1 bg-slate-800 rounded cursor-pointer"
                      />
                      <div className="flex justify-between text-[8px] text-slate-500 mt-0.5 font-mono">
                        <span>0 (tại {newPtP1})</span>
                        <span>0.5 (Trung điểm)</span>
                        <span>1 (tại {newPtP2})</span>
                      </div>
                    </div>
                  </>
                )}

                {/* PRIORITY 2: LINE */}
                {newPtType === "line" && (
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="text-[9px] text-slate-400 block">Đường thẳng qua P1:</label>
                      <select
                        value={newPtLineP1}
                        onChange={(e) => setNewPtLineP1(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 px-1 py-1 rounded-2xs text-slate-200 text-[10px]"
                      >
                        {allAvailablePointNames.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-400 block">Và điểm P2:</label>
                      <select
                        value={newPtLineP2}
                        onChange={(e) => setNewPtLineP2(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 px-1 py-1 rounded-2xs text-slate-200 text-[10px]"
                      >
                        {allAvailablePointNames.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* PRIORITY 2: PARALLEL POINT */}
                {newPtType === "parallel_point" && (
                  <div className="space-y-2 mb-2">
                    <div className="grid grid-cols-3 gap-1">
                      <div>
                        <label className="text-[8px] text-slate-400 block">Đi qua điểm:</label>
                        <select
                          value={newPtParThrough}
                          onChange={(e) => setNewPtParThrough(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 px-1 py-1 rounded-2xs text-slate-200 text-[10px]"
                        >
                          {allAvailablePointNames.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[8px] text-slate-400 block">// Đường P1:</label>
                        <select
                          value={newPtParP1}
                          onChange={(e) => setNewPtParP1(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 px-1 py-1 rounded-2xs text-slate-200 text-[10px]"
                        >
                          {allAvailablePointNames.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[8px] text-slate-400 block">Đến P2:</label>
                        <select
                          value={newPtParP2}
                          onChange={(e) => setNewPtParP2(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 px-1 py-1 rounded-2xs text-slate-200 text-[10px]"
                        >
                          {allAvailablePointNames.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="text-[9px] text-emerald-400">
                      Quy tắc: Đường thẳng qua {newPtParThrough} luôn song song với {newPtParP1}{newPtParP2} khi kéo thả!
                    </div>
                  </div>
                )}

                {/* PRIORITY 2: PERPENDICULAR PROJECTION */}
                {newPtType === "perp_proj" && (
                  <div className="space-y-2 mb-2">
                    <div className="grid grid-cols-3 gap-1">
                      <div>
                        <label className="text-[8px] text-slate-400 block">Từ điểm:</label>
                        <select
                          value={newPtPerpFrom}
                          onChange={(e) => setNewPtPerpFrom(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 px-1 py-1 rounded-2xs text-slate-200 text-[10px]"
                        >
                          {allAvailablePointNames.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[8px] text-slate-400 block">Vuông góc P1:</label>
                        <select
                          value={newPtPerpTo1}
                          onChange={(e) => setNewPtPerpTo1(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 px-1 py-1 rounded-2xs text-slate-200 text-[10px]"
                        >
                          {allAvailablePointNames.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[8px] text-slate-400 block">Đến P2:</label>
                        <select
                          value={newPtPerpTo2}
                          onChange={(e) => setNewPtPerpTo2(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 px-1 py-1 rounded-2xs text-slate-200 text-[10px]"
                        >
                          {allAvailablePointNames.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="text-[9px] text-amber-400">
                      Quy tắc: Chân đường vuông góc hạ từ {newPtPerpFrom} xuống ({newPtPerpTo1}{newPtPerpTo2}) luôn vuông góc và nằm trên đường thẳng đó!
                    </div>
                  </div>
                )}

                {/* PRIORITY 3: PLANE */}
                {newPtType === "plane" && (
                  <div className="space-y-1.5 mb-2">
                    <label className="text-[9px] text-slate-400 block">
                      3 đỉnh xác định mặt phẳng chứa điểm:
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {[0, 1, 2].map((idx) => (
                        <select
                          key={idx}
                          value={newPtPlaneTri[idx] || allAvailablePointNames[idx] || "A"}
                          onChange={(e) => {
                            const updated = [...newPtPlaneTri] as [string, string, string];
                            updated[idx] = e.target.value;
                            setNewPtPlaneTri(updated);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 px-1 py-1 rounded-2xs text-slate-200 text-[10px]"
                        >
                          {allAvailablePointNames.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      ))}
                    </div>
                  </div>
                )}

                {/* PRIORITY 3: CENTROID */}
                {newPtType === "centroid" && (
                  <div className="space-y-1.5 mb-2">
                    <label className="text-[9px] text-slate-400 block">
                      3 đỉnh tam giác tính trọng tâm:
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {[0, 1, 2].map((idx) => (
                        <select
                          key={idx}
                          value={newPtTri[idx] || allAvailablePointNames[idx] || "A"}
                          onChange={(e) => {
                            const updated = [...newPtTri] as [string, string, string];
                            updated[idx] = e.target.value;
                            setNewPtTri(updated);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 px-1 py-1 rounded-2xs text-slate-200 text-[10px]"
                        >
                          {allAvailablePointNames.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      ))}
                    </div>
                  </div>
                )}

                {/* FREE XYZ */}
                {newPtType === "custom_xyz" && (
                  <div className="grid grid-cols-3 gap-1 mb-2">
                    <div>
                      <label className="text-[8px] text-slate-400 block">X:</label>
                      <input
                        type="number"
                        step={0.1}
                        value={newPtX}
                        onChange={(e) => setNewPtX(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 px-1 py-0.5 rounded-2xs text-slate-200 text-[10px]"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] text-slate-400 block">Y (cao):</label>
                      <input
                        type="number"
                        step={0.1}
                        value={newPtY}
                        onChange={(e) => setNewPtY(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 px-1 py-0.5 rounded-2xs text-slate-200 text-[10px]"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] text-slate-400 block">Z:</label>
                      <input
                        type="number"
                        step={0.1}
                        value={newPtZ}
                        onChange={(e) => setNewPtZ(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 px-1 py-0.5 rounded-2xs text-slate-200 text-[10px]"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAddPoint}
                  className="w-full py-1 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 rounded-2xs font-bold transition-all active:scale-95"
                >
                  + Thêm Điểm {newPtName} Vào Hình (Có thể Kéo Thả 3D)
                </button>
              </div>

              {/* 2. ADD LINE */}
              <div className="bg-slate-950/70 p-2.5 rounded-2xs border border-slate-800">
                <div className="flex items-center justify-between text-amber-400 font-bold mb-2">
                  <span>📏 2. VẼ ĐOẠN THẲNG / ĐƯỜNG NỐI</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-[9px] text-slate-400 block">Nối từ điểm:</label>
                    <select
                      value={newLineP1}
                      onChange={(e) => setNewLineP1(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 px-1 py-1 rounded-2xs text-slate-200 text-[10px]"
                    >
                      {allAvailablePointNames.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400 block">Đến điểm:</label>
                    <select
                      value={newLineP2}
                      onChange={(e) => setNewLineP2(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 px-1 py-1 rounded-2xs text-slate-200 text-[10px]"
                    >
                      {allAvailablePointNames.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-[9px] text-slate-400 block">Kiểu nét:</label>
                    <select
                      value={newLineStyle}
                      onChange={(e) => setNewLineStyle(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 px-1 py-1 rounded-2xs text-slate-200 text-[10px]"
                    >
                      <option value="dashed">Nét đứt (Dashed)</option>
                      <option value="solid">Nét liền (Solid)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400 block">Màu sắc:</label>
                    <select
                      value={newLineColor}
                      onChange={(e) => setNewLineColor(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 px-1 py-1 rounded-2xs text-slate-200 text-[10px]"
                    >
                      <option value={COLORS.cyan}>Xanh ngọc (Cyan)</option>
                      <option value={COLORS.amber}>Vàng cam (Amber)</option>
                      <option value={COLORS.rose}>Hồng đỏ (Rose)</option>
                      <option value={COLORS.emerald}>Xanh lục (Emerald)</option>
                      <option value={COLORS.purple}>Tím (Purple)</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="w-full py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 rounded-2xs font-bold transition-all active:scale-95"
                >
                  + Vẽ Đoạn Nối [{newLineP1} - {newLineP2}]
                </button>
              </div>

              {/* 3. ADD PLANE */}
              <div className="bg-slate-950/70 p-2.5 rounded-2xs border border-slate-800">
                <div className="flex items-center justify-between text-rose-400 font-bold mb-2">
                  <span>📐 3. VẼ MẶT PHẲNG / THIẾT DIỆN</span>
                </div>
                <div className="mb-2">
                  <label className="text-[9px] text-slate-400 block mb-0.5">
                    Các điểm tạo mặt phẳng (cách nhau bằng dấu phẩy):
                  </label>
                  <input
                    type="text"
                    value={newPlanePts}
                    onChange={(e) => setNewPlanePts(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 px-2 py-1 rounded-2xs text-rose-300 font-bold"
                    placeholder="Ví dụ: M,N,P hoặc S,B,D hoặc A,B',C'"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-[9px] text-slate-400 block">Tô màu mặt:</label>
                    <select
                      value={newPlaneColor}
                      onChange={(e) => setNewPlaneColor(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 px-1 py-1 rounded-2xs text-slate-200 text-[10px]"
                    >
                      <option value={COLORS.rose}>Hồng mờ (Rose)</option>
                      <option value={COLORS.cyan}>Xanh ngọc (Cyan)</option>
                      <option value={COLORS.amber}>Vàng mờ (Amber)</option>
                      <option value={COLORS.emerald}>Xanh lục (Emerald)</option>
                      <option value={COLORS.purple}>Tím mờ (Purple)</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleAddPlane}
                      className="w-full py-1 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/50 text-rose-300 rounded-2xs font-bold transition-all active:scale-95"
                    >
                      + Tô Mặt Phẳng
                    </button>
                  </div>
                </div>
              </div>

              {/* LIST OF DRAWN ELEMENTS & CLEAR BUTTON */}
              <div className="bg-slate-950/90 p-2 rounded-2xs border border-slate-800">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold border-b border-slate-800 pb-1 mb-1.5">
                  <span>DANH SÁCH YẾU TỐ HÌNH HỌC ĐÃ VẼ ({customPoints.length + customLines.length + customPlanes.length})</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomPoints([]);
                      setCustomLines([]);
                      setCustomPlanes([]);
                    }}
                    className="text-rose-400 hover:text-rose-300 text-[9px] underline"
                  >
                    Xóa tất cả
                  </button>
                </div>

                <div className="max-h-32 overflow-y-auto space-y-1 text-[9px]">
                  {customPoints.map((p) => (
                    <div key={p.id} className="flex items-center justify-between bg-slate-900 px-1.5 py-0.5 rounded-2xs">
                      <span className="text-cyan-400 font-bold">Điểm {p.name} ({p.type})</span>
                      <button
                        type="button"
                        onClick={() => setCustomPoints(customPoints.filter((item) => item.id !== p.id))}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {customLines.map((l) => (
                    <div key={l.id} className="flex items-center justify-between bg-slate-900 px-1.5 py-0.5 rounded-2xs">
                      <span className="text-amber-400">Đoạn [{l.p1} - {l.p2}] ({l.style})</span>
                      <button
                        type="button"
                        onClick={() => setCustomLines(customLines.filter((item) => item.id !== l.id))}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {customPlanes.map((pl) => (
                    <div key={pl.id} className="flex items-center justify-between bg-slate-900 px-1.5 py-0.5 rounded-2xs">
                      <span className="text-rose-400">Mặt phẳng {pl.name}</span>
                      <button
                        type="button"
                        onClick={() => setCustomPlanes(customPlanes.filter((item) => item.id !== pl.id))}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: NET UNFOLDING & CROSS SECTION */}
          {activeTab === "unfold" && (
            <div>
              <SectionLabel iconColor="bg-amber-500">TRẢI PHẲNG HÌNH HỌC // NET UNFOLDING</SectionLabel>
              <div className="flex flex-col gap-2.5 p-2.5 bg-slate-900/70 border border-slate-800/90 rounded-2xs mb-3">
                {/* Mode Selector */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setUnfoldMode("net")}
                    className={`py-1.5 px-2 rounded-2xs text-[10px] font-mono border transition-all flex items-center justify-center gap-1 ${
                      unfoldMode === "net"
                        ? "bg-amber-500/25 text-amber-300 font-bold border-amber-500/50 shadow-sm"
                        : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border-slate-700"
                    }`}
                  >
                    <span>📐</span> Trải phẳng (Net)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnfoldMode("explode")}
                    className={`py-1.5 px-2 rounded-2xs text-[10px] font-mono border transition-all flex items-center justify-center gap-1 ${
                      unfoldMode === "explode"
                        ? "bg-cyan-500/25 text-cyan-300 font-bold border-cyan-500/50 shadow-sm"
                        : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border-slate-700"
                    }`}
                  >
                    <span>💥</span> Bóc tách (Explode)
                  </button>
                </div>

                {/* Progress Header */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-mono text-slate-300">Tiến trình mở/trải phẳng:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-mono text-amber-400 font-bold">{fmt(unfold * 100, 0)}%</span>
                    <button
                      type="button"
                      id="btn-poly-play-anim"
                      onClick={() => setIsPlaying(!isPlaying)}
                      className={`px-2 py-0.5 rounded-2xs text-[9px] font-mono border transition-colors ${
                        isPlaying
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/50 font-bold"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold"
                      }`}
                    >
                      {isPlaying ? "⏸ DỪNG" : "▶ TỰ CHẠY"}
                    </button>
                  </div>
                </div>

                {/* Smooth Range Slider */}
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={unfold}
                    onChange={(e) => {
                      setIsPlaying(false);
                      setUnfold(parseFloat(e.target.value));
                    }}
                    className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Quick Step Buttons */}
                <div className="grid grid-cols-4 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setUnfold(0);
                    }}
                    className={`py-1 rounded-2xs text-[9px] font-mono border transition-colors ${
                      unfold === 0
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                    }`}
                  >
                    0% Khối 3D
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setUnfold(0.35);
                    }}
                    className={`py-1 rounded-2xs text-[9px] font-mono border transition-colors ${
                      Math.abs(unfold - 0.35) < 0.05
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                    }`}
                  >
                    35% Mở hé
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setUnfold(0.7);
                    }}
                    className={`py-1 rounded-2xs text-[9px] font-mono border transition-colors ${
                      Math.abs(unfold - 0.7) < 0.05
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                    }`}
                  >
                    70% Mở rộng
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setUnfold(1);
                    }}
                    className={`py-1 rounded-2xs text-[9px] font-mono border transition-colors ${
                      unfold === 1
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                    }`}
                  >
                    100% Trải 2D
                  </button>
                </div>

                {/* Educational Note */}
                <div className="p-1.5 bg-slate-950/60 border border-slate-800/80 rounded-2xs text-[9px] font-mono text-slate-400">
                  {unfold === 0 ? (
                    <span>💡 <strong className="text-slate-200">Khối 3D khép kín:</strong> Có thể kéo thả các điểm hoặc sang Tab "Điểm & Mặt" để thêm đoạn thẳng, mặt cắt.</span>
                  ) : unfold === 1 ? (
                    <span>📐 <strong className="text-emerald-300">Đã trải phẳng hoàn toàn (100% Net):</strong> Nhấn nút góc nhìn <strong className="text-slate-200">"Từ trên (Top)"</strong> để quan sát bản đồ trải phẳng 2D chuẩn xác.</span>
                  ) : (
                    <span>🔄 <strong className="text-amber-300">Đang mở khối ({fmt(unfold * 100, 0)}%):</strong> Các mặt xoay quanh bản lề cạnh đáy để minh họa trực quan quá trình trải phẳng.</span>
                  )}
                </div>
              </div>

              <SectionLabel iconColor="bg-rose-500">THIẾT DIỆN SONG SONG ĐÁY</SectionLabel>
              <ToggleRow
                id="toggle-poly-cross"
                label="Hiện mặt phẳng cắt song song đáy"
                checked={showCross}
                onChange={setShowCross}
              />
              {showCross && (
                <NumberInput
                  id="input-poly-crosst"
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
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
