import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import * as THREE from "three";
import { Eye, EyeOff, Grid, Move, RotateCcw, RotateCw } from "lucide-react";

interface IntegralRevolution3DProps {
  fn: (x: number) => number;
  lower: number;
  upper: number;
  areaColor: string;
  customLatex?: string;
}

function fmt(n: number, d = 2): string {
  if (isNaN(n) || !isFinite(n)) return "0";
  const p = Math.pow(10, d);
  return (Math.round(n * p) / p).toFixed(d).replace(/\.?0+$/, "");
}

// Create billboarded 2D canvas text sprites for crisp coordinate labels (x, y, z, O, a, b)
function makeTextSprite(text: string, color = "#ffffff", fontSize = 56): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128);
    ctx.font = `bold ${fontSize}px 'JetBrains Mono', monospace, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 64, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(0.42, 0.42, 1);
  return sprite;
}

export default function IntegralRevolution3D({
  fn,
  lower,
  upper,
  areaColor,
  customLatex = "-0.35x^2 + 3.2",
}: IntegralRevolution3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Angle in radians: 0 to 2*PI
  const [angle, setAngle] = useState<number>(0);
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  // Tùy chỉnh hiển thị: Hệ trục tọa độ, độ trong suốt khối, và lưới khung wireframe
  const [showAxes, setShowAxes] = useState<boolean>(true);
  const [solidOpacity, setSolidOpacity] = useState<number>(0.78);
  const [showWireframe, setShowWireframe] = useState<boolean>(false);

  // Chế độ thao tác chuột: 'rotate' (xoay 3D) hoặc 'pan' (kéo, dê khối tự do)
  const [mouseMode, setMouseMode] = useState<"rotate" | "pan">("rotate");
  const mouseModeRef = useRef<"rotate" | "pan">("rotate");
  mouseModeRef.current = mouseMode;

  // Tự xoay: khối tròn xoay tự xoay liên tục tại chỗ quanh nó
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(false);
  const isAutoRotatingRef = useRef<boolean>(false);
  isAutoRotatingRef.current = isAutoRotating;

  // Keep angle ref up-to-date for animation loop
  const angleRef = useRef<number>(0);
  angleRef.current = angle;

  // Numerical Simpson integration for Full Revolution Volume V = pi * integral_a^b [f(x)]^2 dx
  const fullVolume = useMemo(() => {
    if (upper <= lower) return 0;
    const n = 600;
    const h = (upper - lower) / n;
    let s = Math.pow(fn(lower), 2) + Math.pow(fn(upper), 2);
    for (let i = 1; i < n; i++) {
      const x = lower + i * h;
      const factor = i % 2 === 0 ? 2 : 4;
      s += factor * Math.pow(fn(x), 2);
    }
    return (Math.PI * s * h) / 3;
  }, [fn, lower, upper]);

  // Current volume swept based on angle: V(theta) = (theta / 2pi) * V_full
  const currentSweptVolume = useMemo(() => {
    return (angle / (2 * Math.PI)) * fullVolume;
  }, [angle, fullVolume]);

  const deg = Math.round((angle / (2 * Math.PI)) * 360);

  // Rotation animation loop
  useEffect(() => {
    if (!isRotating) return;

    let lastTime = performance.now();
    const speed = 0.85; // rad per second (~7.4s for full 360)

    const step = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const next = angleRef.current + speed * dt;
      if (next >= 2 * Math.PI) {
        setAngle(2 * Math.PI);
        setIsRotating(false);
      } else {
        setAngle(next);
        animFrameIdRef.current = requestAnimationFrame(step);
      }
    };

    animFrameIdRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [isRotating]);

  // Three.js Scene Setup (Mount / Unmount)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      5000
    );
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dl1 = new THREE.DirectionalLight(0xffffff, 0.95);
    dl1.position.set(6, 9, 8);
    scene.add(dl1);
    const dl2 = new THREE.DirectionalLight(0x38bdf8, 0.5);
    dl2.position.set(-6, -3, -5);
    scene.add(dl2);

    // Main orbit container group
    const group = new THREE.Group();
    // Default isometric-friendly orientation
    group.quaternion.setFromEuler(new THREE.Euler(-0.32, 0.55, 0));
    scene.add(group);
    groupRef.current = group;

    // Helper to pan/translate the 3D group in camera view plane
    const panGroup = (dx: number, dy: number) => {
      if (!groupRef.current || !cameraRef.current || !container) return;
      const camera = cameraRef.current;
      const clientWidth = container.clientWidth || 1;
      const clientHeight = container.clientHeight || 1;

      camera.updateMatrixWorld();
      const dist = camera.position.distanceTo(groupRef.current.position);
      const vFov = (camera.fov * Math.PI) / 180;
      const planeHeight = 2 * Math.tan(vFov / 2) * dist;
      const planeWidth = planeHeight * camera.aspect;

      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);

      const moveX = (dx / clientWidth) * planeWidth;
      const moveY = -(dy / clientHeight) * planeHeight;

      groupRef.current.position.addScaledVector(right, moveX);
      groupRef.current.position.addScaledVector(up, moveY);
    };

    // Mouse drag interaction: Rotate or Pan (kéo, dê khối 3D tùy thích)
    let dragAction: "rotate" | "pan" | null = null;
    let prevX = 0;
    let prevY = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 2) {
        e.preventDefault();
      }
      // Dê / kéo khối nếu: đang ở chế độ 'pan', hoặc click chuột phải (button 2), hoặc nút giữa (button 1), hoặc giữ phím Shift
      if (mouseModeRef.current === "pan" || e.button === 2 || e.button === 1 || e.shiftKey) {
        dragAction = "pan";
      } else {
        dragAction = "rotate";
      }
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault(); // Ngăn menu chuột phải để cho phép dùng chuột phải kéo dê khối
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragAction || !groupRef.current) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      prevX = e.clientX;
      prevY = e.clientY;

      if (dragAction === "pan") {
        panGroup(dx, dy);
      } else {
        const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * 0.008);
        const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * 0.008);
        groupRef.current.quaternion.premultiply(qY).multiply(qX);
      }
    };

    const onMouseUp = () => {
      dragAction = null;
    };

    // Wheel zoom
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!cameraRef.current) return;
      const curDist = cameraRef.current.position.length();
      const zoomFactor = Math.max(0.003, curDist * 0.001);
      const nextDist = Math.max(0.5, Math.min(4000.0, curDist + e.deltaY * zoomFactor));
      const dir = cameraRef.current.position.clone().normalize();
      cameraRef.current.position.copy(dir.multiplyScalar(nextDist));
    };

    // Touch support for mobile / tablets: 1-finger rotate/pan, 2-finger pan & pinch zoom
    let touchMode: "rotate" | "pan" | "zoom" | null = null;
    let touchPrevX = 0;
    let touchPrevY = 0;
    let touchDist0 = 0;
    let touchMidX0 = 0;
    let touchMidY0 = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchMode = mouseModeRef.current === "pan" ? "pan" : "rotate";
        touchPrevX = e.touches[0].clientX;
        touchPrevY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        touchMode = "zoom";
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchDist0 = Math.hypot(dx, dy);
        touchMidX0 = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        touchMidY0 = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && touchMode && groupRef.current) {
        const dx = e.touches[0].clientX - touchPrevX;
        const dy = e.touches[0].clientY - touchPrevY;
        touchPrevX = e.touches[0].clientX;
        touchPrevY = e.touches[0].clientY;

        if (touchMode === "pan") {
          panGroup(dx, dy);
        } else {
          const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * 0.008);
          const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * 0.008);
          groupRef.current.quaternion.premultiply(qY).multiply(qX);
        }
      } else if (e.touches.length === 2 && cameraRef.current) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const curDist = Math.hypot(dx, dy);
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

        // 2-finger pan
        const panDx = midX - touchMidX0;
        const panDy = midY - touchMidY0;
        touchMidX0 = midX;
        touchMidY0 = midY;
        panGroup(panDx, panDy);

        // 2-finger zoom
        const diff = touchDist0 - curDist;
        const currentDist = cameraRef.current.position.length();
        const zoomFactor = Math.max(0.01, currentDist * 0.003);
        const nextDist = Math.max(0.5, Math.min(4000.0, currentDist + diff * zoomFactor));
        touchDist0 = curDist;
        const dir = cameraRef.current.position.clone().normalize();
        cameraRef.current.position.copy(dir.multiplyScalar(nextDist));
      }
    };

    const onTouchEnd = () => {
      touchMode = null;
    };

    const dom = renderer.domElement;
    dom.addEventListener("mousedown", onMouseDown);
    dom.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    dom.addEventListener("wheel", onWheel, { passive: false });
    dom.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    });
    ro.observe(container);

    // Render loop
    let reqId = 0;
    const renderLoop = () => {
      reqId = requestAnimationFrame(renderLoop);
      if (isAutoRotatingRef.current && groupRef.current) {
        // Tự xoay khối tròn xoay tại vị trí hiện tại quanh trục thẳng đứng Y
        const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.008);
        groupRef.current.quaternion.premultiply(qY);
      }
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    reqId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(reqId);
      ro.disconnect();
      dom.removeEventListener("mousedown", onMouseDown);
      dom.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      dom.removeEventListener("wheel", onWheel);
      dom.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      if (rendererRef.current && rendererRef.current.domElement.parentNode) {
        rendererRef.current.domElement.parentNode.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
    };
  }, []);

  // Center camera whenever lower/upper/fn changes
  useEffect(() => {
    if (!cameraRef.current) return;
    const xMid = (lower + upper) / 2;
    const dx = Math.max(1, upper - lower);

    // Compute approximate max radius |f(x)|
    let maxR = 0.5;
    for (let i = 0; i <= 30; i++) {
      const x = lower + (i / 30) * (upper - lower);
      try {
        const val = Math.abs(fn(x));
        if (isFinite(val) && val > maxR) maxR = val;
      } catch {}
    }

    const span = Math.max(dx, maxR * 2.2, 2.5);
    const dist = span * 1.8;
    cameraRef.current.position.set(0, dist * 0.45, dist * 0.95);
    cameraRef.current.lookAt(0, 0, 0);
  }, [lower, upper, fn]);

  // Build / Update 3D Geometry for Solid of Revolution
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    // Clear previous objects
    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      } else if (obj instanceof THREE.Line) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    }

    const xMid = (lower + upper) / 2;
    const N = 72; // number of slices along [lower, upper]
    const xPoints: number[] = [];
    const yPoints: number[] = [];

    let maxRadius = 0.5;
    for (let i = 0; i <= N; i++) {
      const x = lower + (i / N) * (upper - lower);
      let y = 0;
      try {
        const v = fn(x);
        y = isFinite(v) ? v : 0;
      } catch {
        y = 0;
      }
      xPoints.push(x - xMid); // Centered relative to xMid
      yPoints.push(y);
      if (Math.abs(y) > maxRadius) maxRadius = Math.abs(y);
    }

    const xMinCentered = lower - xMid;
    const xMaxCentered = upper - xMid;

    // ==========================================
    // 1. HỆ TRỤC TỌA ĐỘ VÀ MŨI TÊN (COORDINATE AXES & ARROWS)
    // ==========================================
    const axesGroup = new THREE.Group();

    // Kích thước mũi tên và trục tính theo độ rộng miền hiển thị
    const axisExtent = Math.max(Math.abs(xMinCentered), Math.abs(xMaxCentered)) + 1.8;
    const arrowRadius = Math.max(0.1, Math.min(0.25, axisExtent * 0.035));
    const arrowLength = Math.max(0.3, Math.min(0.7, axisExtent * 0.08));

    // 1.1. TRỤC HOÀNH Ox (Trục quay tạo khối tròn xoay - Màu trắng sáng #ffffff)
    const axisOxGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-axisExtent, 0, 0),
      new THREE.Vector3(axisExtent, 0, 0),
    ]);
    const axisOxLine = new THREE.Line(
      axisOxGeom,
      new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2.4 })
    );
    axesGroup.add(axisOxLine);

    // Mũi tên trục Ox (nón nhọn hướng theo chiều dương +Ox)
    const arrowOxGeom = new THREE.ConeGeometry(arrowRadius, arrowLength, 20);
    arrowOxGeom.rotateZ(-Math.PI / 2);
    const arrowOxMesh = new THREE.Mesh(arrowOxGeom, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    arrowOxMesh.position.set(axisExtent + arrowLength * 0.45, 0, 0);
    axesGroup.add(arrowOxMesh);

    // Nhãn "x" trục Ox
    const labelX = makeTextSprite("x", "#ffffff", 64);
    labelX.position.set(axisExtent + arrowLength + 0.45, 0, 0);
    axesGroup.add(labelX);

    // 1.2. TRỤC TUNG Oy (Màu trắng bạc #e2e8f0)
    const yExtent = maxRadius + 1.4;
    const yNeg = -Math.max(0.6, maxRadius * 0.35);
    const axisOyGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-xMid, yNeg, 0),
      new THREE.Vector3(-xMid, yExtent, 0),
    ]);
    const axisOyLine = new THREE.Line(
      axisOyGeom,
      new THREE.LineBasicMaterial({ color: 0xe2e8f0, linewidth: 1.8 })
    );
    axesGroup.add(axisOyLine);

    // Mũi tên trục Oy (nón nhọn hướng theo chiều dương +Oy)
    const arrowOyGeom = new THREE.ConeGeometry(arrowRadius, arrowLength, 20);
    const arrowOyMesh = new THREE.Mesh(arrowOyGeom, new THREE.MeshBasicMaterial({ color: 0xe2e8f0 }));
    arrowOyMesh.position.set(-xMid, yExtent + arrowLength * 0.45, 0);
    axesGroup.add(arrowOyMesh);

    // Nhãn "y" trục Oy
    const labelY = makeTextSprite("y", "#e2e8f0", 64);
    labelY.position.set(-xMid, yExtent + arrowLength + 0.45, 0);
    axesGroup.add(labelY);

    // 1.3. TRỤC Oz (Trục trong không gian 3D - Màu cyan #38bdf8)
    const zExtent = maxRadius + 1.4;
    const zNeg = -Math.max(0.6, maxRadius * 0.35);
    const axisOzGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-xMid, 0, zNeg),
      new THREE.Vector3(-xMid, 0, zExtent),
    ]);
    const axisOzLine = new THREE.Line(
      axisOzGeom,
      new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 1.8 })
    );
    axesGroup.add(axisOzLine);

    // Mũi tên trục Oz (nón nhọn hướng theo chiều dương +Oz)
    const arrowOzGeom = new THREE.ConeGeometry(arrowRadius, arrowLength, 20);
    arrowOzGeom.rotateX(Math.PI / 2);
    const arrowOzMesh = new THREE.Mesh(arrowOzGeom, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    arrowOzMesh.position.set(-xMid, 0, zExtent + arrowLength * 0.45);
    axesGroup.add(arrowOzMesh);

    // Nhãn "z" trục Oz
    const labelZ = makeTextSprite("z", "#38bdf8", 64);
    labelZ.position.set(-xMid, 0, zExtent + arrowLength + 0.45);
    axesGroup.add(labelZ);

    // Gốc tọa độ O(0,0,0) (offset tại -xMid)
    const originMesh = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(0.06, arrowRadius * 0.65), 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    );
    originMesh.position.set(-xMid, 0, 0);
    axesGroup.add(originMesh);

    const labelO = makeTextSprite("O", "#f59e0b", 56);
    labelO.position.set(-xMid - 0.28, -0.28, 0);
    axesGroup.add(labelO);

    // Vạch đánh dấu cận a và cận b trên trục Ox
    const tickLen = Math.max(0.12, arrowRadius * 1.1);
    const tickAGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(xMinCentered, -tickLen, 0),
      new THREE.Vector3(xMinCentered, tickLen, 0),
    ]);
    axesGroup.add(new THREE.Line(tickAGeom, new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 2 })));
    const labelA = makeTextSprite(`a = ${fmt(lower)}`, "#06b6d4", 48);
    labelA.position.set(xMinCentered, -tickLen - 0.35, 0);
    axesGroup.add(labelA);

    const tickBGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(xMaxCentered, -tickLen, 0),
      new THREE.Vector3(xMaxCentered, tickLen, 0),
    ]);
    axesGroup.add(new THREE.Line(tickBGeom, new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 2 })));
    const labelB = makeTextSprite(`b = ${fmt(upper)}`, "#06b6d4", 48);
    labelB.position.set(xMaxCentered, -tickLen - 0.35, 0);
    axesGroup.add(labelB);

    // Thêm hệ trục vào nhóm orbit khi người dùng bật showAxes
    if (showAxes) {
      group.add(axesGroup);
    }

    const threeColor = new THREE.Color(areaColor);
    const baseOpacity = solidOpacity;

    // 4. MIỀN DIỆN TÍCH BAN ĐẦU Ở GÓC θ = 0 (Nằm trên mặt phẳng Oxy, z = 0)
    // Tạo đa giác dải tam giác giữa trục Ox và đường cong y = f(x)
    const flatVerts: number[] = [];
    const flatIndices: number[] = [];
    for (let i = 0; i <= N; i++) {
      flatVerts.push(xPoints[i], 0, 0); // Đỉnh trên trục Ox: index 2*i
      flatVerts.push(xPoints[i], yPoints[i], 0); // Đỉnh trên đường cong: index 2*i + 1
    }
    for (let i = 0; i < N; i++) {
      const b0 = 2 * i;
      const t0 = 2 * i + 1;
      const b1 = 2 * (i + 1);
      const t1 = 2 * (i + 1) + 1;
      flatIndices.push(b0, b1, t0);
      flatIndices.push(b1, t1, t0);
    }
    const flatGeom = new THREE.BufferGeometry();
    flatGeom.setAttribute("position", new THREE.Float32BufferAttribute(flatVerts, 3));
    flatGeom.setIndex(flatIndices);
    flatGeom.computeVertexNormals();

    const flatMat = new THREE.MeshStandardMaterial({
      color: threeColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: angle > 0.05 ? baseOpacity * 0.75 : baseOpacity,
      roughness: 0.35,
      metalness: 0.1,
    });
    group.add(new THREE.Mesh(flatGeom, flatMat));

    // Lưới khung wireframe cho mặt phẳng ban đầu (nếu bật)
    if (showWireframe) {
      const flatWireGeom = new THREE.WireframeGeometry(flatGeom);
      const flatWireMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.35,
      });
      group.add(new THREE.LineSegments(flatWireGeom, flatWireMat));
    }

    // Viền đường cong y = f(x) ban đầu (màu hổ phách)
    const curvePts: THREE.Vector3[] = [];
    for (let i = 0; i <= N; i++) {
      curvePts.push(new THREE.Vector3(xPoints[i], yPoints[i], 0));
    }
    const curveGeom = new THREE.BufferGeometry().setFromPoints(curvePts);
    group.add(new THREE.Line(curveGeom, new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2.5 })));

    // Hai đường biên x = a và x = b (nét đứt hoặc nét thanh màu cyan)
    const lineAPts = [new THREE.Vector3(xMinCentered, 0, 0), new THREE.Vector3(xMinCentered, yPoints[0], 0)];
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(lineAPts), new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 1.8 })));

    const lineBPts = [new THREE.Vector3(xMaxCentered, 0, 0), new THREE.Vector3(xMaxCentered, yPoints[N], 0)];
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(lineBPts), new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 1.8 })));

    // 5. MẶT TRÒN XOAY (SWEEP SURFACE OF REVOLUTION) KHI GÓC QUAY θ > 0
    if (angle > 0.015) {
      const M = Math.max(6, Math.round(54 * (angle / (2 * Math.PI))));
      const sweepVerts: number[] = [];
      const sweepIndices: number[] = [];

      for (let i = 0; i <= N; i++) {
        const x = xPoints[i];
        const y0 = yPoints[i];
        for (let j = 0; j <= M; j++) {
          const phi = (j / M) * angle;
          const y = y0 * Math.cos(phi);
          const z = y0 * Math.sin(phi);
          sweepVerts.push(x, y, z);
        }
      }

      for (let i = 0; i < N; i++) {
        for (let j = 0; j < M; j++) {
          const row1 = i * (M + 1);
          const row2 = (i + 1) * (M + 1);
          const v1 = row1 + j;
          const v2 = row2 + j;
          const v3 = row2 + (j + 1);
          const v4 = row1 + (j + 1);

          sweepIndices.push(v1, v2, v4);
          sweepIndices.push(v2, v3, v4);
        }
      }

      const sweepGeom = new THREE.BufferGeometry();
      sweepGeom.setAttribute("position", new THREE.Float32BufferAttribute(sweepVerts, 3));
      sweepGeom.setIndex(sweepIndices);
      sweepGeom.computeVertexNormals();

      const sweepMat = new THREE.MeshStandardMaterial({
        color: threeColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: baseOpacity,
        roughness: 0.35,
        metalness: 0.12,
      });
      group.add(new THREE.Mesh(sweepGeom, sweepMat));

      // Lưới khung (wireframe) cho khối tròn xoay
      if (showWireframe) {
        const sweepWireGeom = new THREE.WireframeGeometry(sweepGeom);
        const sweepWireMat = new THREE.LineBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.45,
        });
        group.add(new THREE.LineSegments(sweepWireGeom, sweepWireMat));

        // Các vành tròn vĩ tuyến bao quanh Ox tại các lát cắt để làm rõ khối tròn xoay
        const ringStep = Math.max(1, Math.round(N / 12));
        for (let ri = 0; ri <= N; ri += ringStep) {
          const rx = xPoints[ri];
          const ry = Math.abs(yPoints[ri]);
          if (ry > 0.05) {
            const ringPts: THREE.Vector3[] = [];
            for (let j = 0; j <= M; j++) {
              const phi = (j / M) * angle;
              ringPts.push(new THREE.Vector3(rx, ry * Math.cos(phi), ry * Math.sin(phi)));
            }
            group.add(
              new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(ringPts),
                new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.4 })
              )
            );
          }
        }
      }

      // 6. HAI MẶT QUẠT ĐÁY TẠI x = a VÀ x = b
      // Tại x = a (nếu |f(a)| > 0.02)
      if (Math.abs(yPoints[0]) > 0.02) {
        const capAVerts: number[] = [xMinCentered, 0, 0]; // Tâm: index 0
        const capAIndices: number[] = [];
        const yA = yPoints[0];
        for (let j = 0; j <= M; j++) {
          const phi = (j / M) * angle;
          capAVerts.push(xMinCentered, yA * Math.cos(phi), yA * Math.sin(phi));
        }
        for (let j = 1; j <= M; j++) {
          capAIndices.push(0, j, j + 1);
        }
        const capAGeom = new THREE.BufferGeometry();
        capAGeom.setAttribute("position", new THREE.Float32BufferAttribute(capAVerts, 3));
        capAGeom.setIndex(capAIndices);
        capAGeom.computeVertexNormals();
        const capAMat = new THREE.MeshStandardMaterial({
          color: threeColor,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: Math.min(1, baseOpacity * 1.05),
          roughness: 0.3,
        });
        group.add(new THREE.Mesh(capAGeom, capAMat));

        if (showWireframe) {
          group.add(
            new THREE.LineSegments(
              new THREE.WireframeGeometry(capAGeom),
              new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })
            )
          );
        }
      }

      // Tại x = b (nếu |f(b)| > 0.02)
      if (Math.abs(yPoints[N]) > 0.02) {
        const capBVerts: number[] = [xMaxCentered, 0, 0]; // Tâm: index 0
        const capBIndices: number[] = [];
        const yB = yPoints[N];
        for (let j = 0; j <= M; j++) {
          const phi = (j / M) * angle;
          capBVerts.push(xMaxCentered, yB * Math.cos(phi), yB * Math.sin(phi));
        }
        for (let j = 1; j <= M; j++) {
          capBIndices.push(0, j + 1, j);
        }
        const capBGeom = new THREE.BufferGeometry();
        capBGeom.setAttribute("position", new THREE.Float32BufferAttribute(capBVerts, 3));
        capBGeom.setIndex(capBIndices);
        capBGeom.computeVertexNormals();
        const capBMat = new THREE.MeshStandardMaterial({
          color: threeColor,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: Math.min(1, baseOpacity * 1.05),
          roughness: 0.3,
        });
        group.add(new THREE.Mesh(capBGeom, capBMat));

        if (showWireframe) {
          group.add(
            new THREE.LineSegments(
              new THREE.WireframeGeometry(capBGeom),
              new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })
            )
          );
        }
      }

      // 7. MIẾNG PHẲNG TẠI VỊ TRÍ GÓC QUAY HIỆN TẠI θ (Mặt cắt quét đang quay)
      if (angle > 0.04 && angle < 2 * Math.PI - 0.04) {
        const sliceVerts: number[] = [];
        const sliceIndices: number[] = [];
        for (let i = 0; i <= N; i++) {
          sliceVerts.push(xPoints[i], 0, 0); // Trên trục Ox: 2*i
          sliceVerts.push(
            xPoints[i],
            yPoints[i] * Math.cos(angle),
            yPoints[i] * Math.sin(angle)
          ); // Trên đường sinh đang quay: 2*i + 1
        }
        for (let i = 0; i < N; i++) {
          const b0 = 2 * i;
          const t0 = 2 * i + 1;
          const b1 = 2 * (i + 1);
          const t1 = 2 * (i + 1) + 1;
          sliceIndices.push(b0, t0, b1);
          sliceIndices.push(b1, t0, t1);
        }
        const sliceGeom = new THREE.BufferGeometry();
        sliceGeom.setAttribute("position", new THREE.Float32BufferAttribute(sliceVerts, 3));
        sliceGeom.setIndex(sliceIndices);
        sliceGeom.computeVertexNormals();
        const sliceMat = new THREE.MeshStandardMaterial({
          color: threeColor,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: Math.min(1, baseOpacity * 1.08),
          roughness: 0.3,
        });
        group.add(new THREE.Mesh(sliceGeom, sliceMat));

        if (showWireframe) {
          group.add(
            new THREE.LineSegments(
              new THREE.WireframeGeometry(sliceGeom),
              new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })
            )
          );
        }

        // Đường sinh đang quay ở mép góc θ (màu vàng hổ phách sáng)
        const rotCurvePts: THREE.Vector3[] = [];
        for (let i = 0; i <= N; i++) {
          rotCurvePts.push(
            new THREE.Vector3(xPoints[i], yPoints[i] * Math.cos(angle), yPoints[i] * Math.sin(angle))
          );
        }
        group.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(rotCurvePts),
            new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2.2 })
          )
        );
      }

      // 8. CUNG TRÒN QUỸ ĐẠO QUAY QUANH Ox (Orbit trace arcs)
      // Cung tròn tại cận a
      if (Math.abs(yPoints[0]) > 0.05) {
        const arcAPts: THREE.Vector3[] = [];
        for (let j = 0; j <= M; j++) {
          const phi = (j / M) * angle;
          arcAPts.push(
            new THREE.Vector3(xMinCentered, yPoints[0] * Math.cos(phi), yPoints[0] * Math.sin(phi))
          );
        }
        group.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(arcAPts),
            new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 1.5 })
          )
        );
      }
      // Cung tròn tại cận b
      if (Math.abs(yPoints[N]) > 0.05) {
        const arcBPts: THREE.Vector3[] = [];
        for (let j = 0; j <= M; j++) {
          const phi = (j / M) * angle;
          arcBPts.push(
            new THREE.Vector3(xMaxCentered, yPoints[N] * Math.cos(phi), yPoints[N] * Math.sin(phi))
          );
        }
        group.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(arcBPts),
            new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 1.5 })
          )
        );
      }
    }
  }, [fn, lower, upper, angle, areaColor, showAxes, solidOpacity, showWireframe]);

  // Perspective presets
  const setPreset = useCallback((preset: "iso" | "front" | "top" | "side") => {
    if (!groupRef.current) return;
    switch (preset) {
      case "front": // Nhìn trực diện Oxy (như mặt phẳng 2D)
        groupRef.current.quaternion.setFromEuler(new THREE.Euler(0, 0, 0));
        break;
      case "top": // Nhìn từ trên xuống
        groupRef.current.quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
        break;
      case "side": // Nhìn dọc theo trục hoành Ox
        groupRef.current.quaternion.setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
        break;
      case "iso":
      default:
        groupRef.current.quaternion.setFromEuler(new THREE.Euler(-0.32, 0.55, 0));
        break;
    }
  }, []);

  const resetView = useCallback(() => {
    setPreset("iso");
    if (groupRef.current) {
      groupRef.current.position.set(0, 0, 0);
    }
  }, [setPreset]);

  // Toggle Play / Pause rotation
  const toggleRotate = () => {
    if (isRotating) {
      setIsRotating(false);
    } else {
      if (angle >= 2 * Math.PI - 0.02) {
        setAngle(0);
      }
      setIsRotating(true);
    }
  };

  const handleResetTo2D = () => {
    setIsRotating(false);
    setAngle(0);
    setPreset("front");
    if (groupRef.current) {
      groupRef.current.position.set(0, 0, 0);
    }
  };

  const handleFullRevolution = () => {
    setIsRotating(false);
    setAngle(2 * Math.PI);
  };

  return (
    <div
      className={`${
        isFullScreen
          ? "fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md p-3 sm:p-4 flex flex-col w-screen h-screen overflow-hidden shadow-2xl animate-in fade-in duration-150"
          : "bg-slate-900/60 border border-slate-800 rounded-xs overflow-hidden flex flex-col shadow-sm"
      }`}
    >
      {/* Header bar */}
      <div className="h-8 bg-slate-900/90 border-b border-slate-800/80 px-3 flex items-center justify-between shrink-0 text-xs select-none">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-3 bg-amber-500 rounded-2xs inline-block" />
          <span className="font-bold text-slate-200 uppercase tracking-tight text-[11px] font-mono">
            MÔ HÌNH 3D: QUAY MIỀN PHẲNG QUANH TRỤC Ox
          </span>
          <span className="text-[9px] bg-slate-800 text-amber-300 border border-amber-500/40 px-1 py-0.2 rounded font-mono font-bold">
            V = {fmt(fullVolume, 3)} đvtt
          </span>
          {isFullScreen && (
            <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-mono font-bold">
              FULLSCREEN
            </span>
          )}
        </div>

        {/* Action buttons on header */}
        <div className="flex items-center gap-1.5">
          {/* Nút TỰ XOAY quanh nó tại chỗ */}
          <button
            type="button"
            onClick={() => setIsAutoRotating((r) => !r)}
            className={`px-2 py-0.5 border rounded-2xs text-[10px] font-mono transition-colors active:scale-95 font-bold flex items-center gap-1 ${
              isAutoRotating
                ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-xs"
                : "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 hover:bg-cyan-500/30"
            }`}
            title="Nhấn để khối tròn xoay tự xoay liên tục quanh nó tại chỗ cho đến khi nhấn lại (quan sát 360 độ)"
          >
            <RotateCw className={`w-3 h-3 ${isAutoRotating ? "animate-spin" : ""}`} />
            <span>{isAutoRotating ? "⏸ DỪNG TỰ XOAY" : "▶ TỰ XOAY"}</span>
          </button>
          <button
            type="button"
            onClick={toggleRotate}
            className={`px-2 py-0.5 border rounded-2xs text-[10px] font-mono transition-colors active:scale-95 font-bold ${
              isRotating
                ? "bg-amber-500 text-slate-950 border-amber-400 shadow-xs"
                : "bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30"
            }`}
            title="Nhấn để quay miền diện tích hình phẳng xung quanh trục hoành Ox tạo khối tròn xoay"
          >
            {isRotating ? "⏸ DỪNG QUAY" : deg === 0 ? "▶ QUAY QUANH Ox" : "▶ TIẾP TỤC QUAY"}
          </button>
          <button
            type="button"
            onClick={handleResetTo2D}
            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-2xs text-[10px] font-mono transition-colors active:scale-95"
            title="Đưa về trạng thái phẳng 2D ban đầu (0 độ)"
          >
            ↺ 0° BAN ĐẦU
          </button>
          <button
            type="button"
            onClick={() => setIsFullScreen((f) => !f)}
            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-2xs text-[10px] font-mono transition-colors active:scale-95"
            title="Mở rộng / Thu nhỏ toàn màn hình"
          >
            {isFullScreen ? "THU NHỎ" : "TOÀN MÀN HÌNH"}
          </button>
        </div>
      </div>

      {/* 3D Viewport Area */}
      <div className={`relative bg-slate-950 border border-slate-800/80 rounded-2xs overflow-hidden flex items-center justify-center select-none ${isFullScreen ? "w-full flex-1 h-full min-h-0" : ""}`}>
        <div
          ref={containerRef}
          className={`w-full ${isFullScreen ? "h-full min-h-[calc(100vh-140px)]" : "h-[380px]"} ${
            mouseMode === "pan" ? "cursor-move active:cursor-move" : "cursor-grab active:cursor-grabbing"
          }`}
        />

        {/* Top HUD Info Tags */}
        <div className="absolute top-2 left-2 flex gap-1.5 font-mono text-[9px] pointer-events-none flex-wrap max-w-[85%]">
          <span className="bg-slate-900/90 border border-slate-800 text-cyan-400 px-1.5 py-0.5 rounded-2xs">
            TRỤC QUAY: Ox (y=0, z=0)
          </span>
          <span
            className={`border px-1.5 py-0.5 rounded-2xs font-mono text-[9px] font-bold ${
              deg === 0
                ? "bg-slate-900/90 border-slate-700 text-emerald-400"
                : deg === 360
                ? "bg-amber-950/90 border-amber-700 text-amber-300"
                : "bg-indigo-950/90 border-indigo-700 text-indigo-300 animate-pulse"
            }`}
          >
            {deg === 0
              ? "TRẠNG THÁI: MIỀN PHẲNG BAN ĐẦU (0°)"
              : deg === 360
              ? "KHỐI TRÒN XOAY HOÀN CHỈNH (360°)"
              : `ĐANG QUAY QUANH Ox: θ = ${deg}°`}
          </span>
          {deg > 0 && (
            <span className="bg-slate-900/90 border border-slate-800 text-amber-300 px-1.5 py-0.5 rounded-2xs font-mono font-semibold">
              V(θ) = {fmt(currentSweptVolume, 3)} đvtt
            </span>
          )}
          <span className="bg-slate-900/90 border border-slate-800 text-slate-300 px-1.5 py-0.5 rounded-2xs">
            CUỘN ĐỂ ZOOM
          </span>
          <span className="bg-slate-900/90 border border-slate-800 text-amber-300/90 px-1.5 py-0.5 rounded-2xs">
            {mouseMode === "pan" ? "✋ ĐANG Ở CHẾ ĐỘ DÊ / KÉO KHỐI" : "✋ MẸO: CHUỘT PHẢI HOẶC GIỮ SHIFT ĐỂ DÊ KHỐI"}
          </span>
          {isAutoRotating && (
            <span className="bg-cyan-950/90 border border-cyan-500/70 text-cyan-300 px-1.5 py-0.5 rounded-2xs font-bold animate-pulse">
              ⟳ ĐANG TỰ XOAY QUANH NÓ (360°)
            </span>
          )}
        </div>

        {/* Bottom Quick Perspective Bar & Mouse Mode Switch */}
        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center justify-between gap-1.5 bg-slate-900/90 border border-slate-800/90 p-1.5 rounded-xs backdrop-blur-sm">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Chế độ thao tác chuột: Xoay 3D vs Dê / Kéo khối */}
            <div className="flex items-center gap-1 bg-slate-950/90 p-0.5 rounded-2xs border border-slate-800">
              <span className="text-[9px] text-slate-400 font-mono px-1">CHUỘT:</span>
              <button
                type="button"
                onClick={() => setMouseMode("rotate")}
                className={`px-2 py-0.5 rounded-2xs text-[9px] font-mono flex items-center gap-1 transition-all ${
                  mouseMode === "rotate"
                    ? "bg-amber-500/25 text-amber-300 border border-amber-500/60 font-bold shadow-xs"
                    : "text-slate-400 hover:text-slate-200 border border-transparent"
                }`}
                title="Kéo chuột trái để xoay góc nhìn 3D quanh tâm"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>XOAY 3D</span>
              </button>
              <button
                type="button"
                onClick={() => setMouseMode("pan")}
                className={`px-2 py-0.5 rounded-2xs text-[9px] font-mono flex items-center gap-1 transition-all ${
                  mouseMode === "pan"
                    ? "bg-cyan-500/25 text-cyan-300 border border-cyan-500/60 font-bold shadow-xs"
                    : "text-slate-400 hover:text-slate-200 border border-transparent"
                }`}
                title="Nhấp giữ chuột kéo để di chuyển (dê) khối tròn xoay tới bất kỳ vị trí nào tùy thích (hoặc dùng chuột phải / giữ Shift)"
              >
                <Move className="w-2.5 h-2.5" />
                <span>DÊ / KÉO KHỐI</span>
              </button>
            </div>

            <span className="text-slate-600 text-[10px] select-none">|</span>

            {/* Các góc nhìn preset */}
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-[9px] font-mono px-1">GÓC NHÌN:</span>
              <button
                type="button"
                onClick={() => setPreset("iso")}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-2xs text-[9px] font-mono transition-colors active:scale-95"
              >
                3D Phối cảnh
              </button>
              <button
                type="button"
                onClick={() => setPreset("front")}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-2xs text-[9px] font-mono transition-colors active:scale-95"
              >
                Chính diện (Oxy 2D)
              </button>
              <button
                type="button"
                onClick={() => setPreset("top")}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-2xs text-[9px] font-mono transition-colors active:scale-95"
              >
                Từ trên (Top)
              </button>
              <button
                type="button"
                onClick={() => setPreset("side")}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-2xs text-[9px] font-mono transition-colors active:scale-95"
              >
                Bên hông (Side)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsAutoRotating((r) => !r)}
              className={`px-2 py-0.5 rounded-2xs text-[9px] font-mono transition-colors active:scale-95 border flex items-center gap-1 font-bold ${
                isAutoRotating
                  ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-xs"
                  : "bg-slate-800 hover:bg-slate-700 text-cyan-300 border-cyan-500/40"
              }`}
              title="Bật / Tắt chế độ tự xoay khối tròn xoay tại chỗ liên tục để quan sát toàn diện 360 độ"
            >
              <RotateCw className={`w-2.5 h-2.5 ${isAutoRotating ? "animate-spin" : ""}`} />
              <span>{isAutoRotating ? "DỪNG TỰ XOAY" : "TỰ XOAY"}</span>
            </button>

            <button
              type="button"
              onClick={resetView}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-2xs text-[9px] font-mono transition-colors active:scale-95"
              title="Đưa khối 3D về vị trí chính giữa và góc phối cảnh chuẩn"
            >
              CĂN GIỮA // RESET
            </button>
          </div>
        </div>
      </div>

      {/* Rotation Slider & Manual Controls underneath 3D viewport */}
      <div className="bg-slate-900/90 border-t border-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <span className="text-[10px] text-amber-300 font-bold shrink-0">
            GÓC QUAY θ ({deg}°):
          </span>
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={deg}
            onChange={(e) => {
              setIsRotating(false);
              setAngle((Number(e.target.value) / 360) * 2 * Math.PI);
            }}
            className="flex-1 accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleResetTo2D}
            className={`px-2 py-0.5 rounded-2xs text-[9px] border transition-colors ${
              deg === 0
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold"
                : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
            }`}
          >
            0° (Hình phẳng 2D)
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRotating(false);
              setAngle(Math.PI);
            }}
            className={`px-2 py-0.5 rounded-2xs text-[9px] border transition-colors ${
              deg === 180
                ? "bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold"
                : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
            }`}
          >
            180° (Nửa khối)
          </button>
          <button
            type="button"
            onClick={handleFullRevolution}
            className={`px-2 py-0.5 rounded-2xs text-[9px] border transition-colors ${
              deg === 360
                ? "bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold"
                : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
            }`}
          >
            360° (Khối tròn xoay)
          </button>
        </div>
      </div>

      {/* Tùy chỉnh hiển thị 3D: Ẩn/Hiện trục tọa độ, Bật/Tắt lưới khung wireframe, Thanh trượt chỉnh độ trong suốt */}
      <div className="bg-slate-900/95 border-t border-slate-800/80 px-3 py-2 flex flex-wrap items-center justify-between gap-2.5 text-xs font-mono">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Nút ẩn/hiện hệ trục tọa độ */}
          <button
            type="button"
            onClick={() => setShowAxes((prev) => !prev)}
            className={`px-2.5 py-1 rounded-2xs text-[10px] font-mono border flex items-center gap-1.5 transition-all active:scale-95 ${
              showAxes
                ? "bg-cyan-950/60 text-cyan-300 border-cyan-500/60 shadow-xs font-bold"
                : "bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200"
            }`}
            title={showAxes ? "Nhấn để ẩn hệ trục tọa độ Ox, Oy, Oz và các mũi tên" : "Nhấn để hiện hệ trục tọa độ Ox, Oy, Oz cùng mũi tên định hướng"}
          >
            {showAxes ? <Eye className="w-3.5 h-3.5 text-cyan-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
            <span>{showAxes ? "TRỤC TỌA ĐỘ: ĐANG HIỆN" : "TRỤC TỌA ĐỘ: ĐÃ ẨN"}</span>
          </button>

          {/* Nút bật/tắt lưới khung cho khối tròn xoay */}
          <button
            type="button"
            onClick={() => setShowWireframe((prev) => !prev)}
            className={`px-2.5 py-1 rounded-2xs text-[10px] font-mono border flex items-center gap-1.5 transition-all active:scale-95 ${
              showWireframe
                ? "bg-amber-950/60 text-amber-300 border-amber-500/60 shadow-xs font-bold"
                : "bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200"
            }`}
            title={showWireframe ? "Nhấn để tắt lưới khung (wireframe) của khối tròn xoay" : "Nhấn để bật lưới khung (wireframe) hiển thị các đường sinh và lát cắt"}
          >
            <Grid className={`w-3.5 h-3.5 ${showWireframe ? "text-amber-400" : "text-slate-500"}`} />
            <span>{showWireframe ? "LƯỚI KHUNG: ĐANG BẬT" : "LƯỚI KHUNG: ĐÃ TẮT"}</span>
          </button>
        </div>

        {/* Thanh trượt chỉnh độ trong suốt của màu sắc khối tròn xoay */}
        <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-md bg-slate-950/70 border border-slate-800/80 px-2.5 py-1 rounded-2xs">
          <span className="text-[10px] text-slate-300 font-medium shrink-0 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full ring-1 ring-white/30" style={{ backgroundColor: areaColor }} />
            ĐỘ TRONG SUỐT:
          </span>
          <input
            type="range"
            min={15}
            max={100}
            step={5}
            value={Math.round(solidOpacity * 100)}
            onChange={(e) => setSolidOpacity(Number(e.target.value) / 100)}
            className="flex-1 accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            title={`Điều chỉnh độ trong suốt / độ đậm của màu sắc khối tròn xoay (${Math.round(solidOpacity * 100)}%)`}
          />
          <span className="text-[10px] font-mono text-cyan-300 font-bold w-10 text-right shrink-0">
            {Math.round(solidOpacity * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
