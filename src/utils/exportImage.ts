/**
 * Export Utility for SVGs (2D graphs, Trigonometry, Vectors, Calculus, BBT)
 * and Three.js 3D WebGL Canvases (Solids of Revolution, Polyhedra)
 */

export function downloadSvgAsPng(
  svgElement: SVGSVGElement | null,
  fileName: string,
  scale = 2,
  backgroundColor?: string
): Promise<boolean> {
  return new Promise((resolve) => {
    if (!svgElement) {
      resolve(false);
      return;
    }

    try {
      const isLight = document.documentElement.classList.contains("light");
      const defaultBg = isLight ? "#ffffff" : "#020617";
      const bg = backgroundColor ?? defaultBg;
      // Clone the SVG node so we can safely modify it for export
      const clone = svgElement.cloneNode(true) as SVGSVGElement;
      
      // Determine dimensions from viewBox or bounding box
      let width = 640;
      let height = 420;

      if (svgElement.viewBox && svgElement.viewBox.baseVal && svgElement.viewBox.baseVal.width > 0) {
        width = svgElement.viewBox.baseVal.width;
        height = svgElement.viewBox.baseVal.height;
      } else if (svgElement.clientWidth && svgElement.clientHeight) {
        width = svgElement.clientWidth;
        height = svgElement.clientHeight;
      }

      clone.setAttribute("width", String(width));
      clone.setAttribute("height", String(height));
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

      // Inject standard fonts and KaTeX CSS references if present
      const styleEl = document.createElement("style");
      styleEl.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=IBM+Plex+Mono:wght@400;600;700&display=swap');
        text { font-family: 'IBM Plex Mono', 'Space Grotesk', system-ui, sans-serif; }
      `;
      clone.insertBefore(styleEl, clone.firstChild);

      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(clone);

      // Fix any self-closing tags or namespace issues
      if (!svgString.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
        svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        fallbackSvgDownload(svgString, fileName);
        resolve(true);
        return;
      }

      // Smooth rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Fill background
      if (bg) {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const blobURL = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        try {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(blobURL);

          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              triggerDownload(url, `${fileName}.png`);
              setTimeout(() => URL.revokeObjectURL(url), 2000);
              resolve(true);
            } else {
              fallbackSvgDownload(svgString, fileName);
              resolve(true);
            }
          }, "image/png");
        } catch {
          URL.revokeObjectURL(blobURL);
          fallbackSvgDownload(svgString, fileName);
          resolve(true);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(blobURL);
        fallbackSvgDownload(svgString, fileName);
        resolve(true);
      };

      img.src = blobURL;
    } catch {
      resolve(false);
    }
  });
}

export function downloadSvgAsSvg(svgElement: SVGSVGElement | null, fileName: string) {
  if (!svgElement) return;
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(svgElement);
  if (!svgString.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
    svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  fallbackSvgDownload(svgString, fileName);
}

function fallbackSvgDownload(svgString: string, fileName: string) {
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `${fileName}.svg`);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadCanvas3D(
  container: HTMLElement | null,
  fileName: string,
  backgroundColor?: string
): boolean {
  if (!container) return false;
  const canvas = container.querySelector("canvas");
  if (!canvas) return false;

  try {
    const isLight = document.documentElement.classList.contains("light");
    const defaultBg = isLight ? "#ffffff" : "#020617";
    const bg = backgroundColor ?? defaultBg;

    const outCanvas = document.createElement("canvas");
    outCanvas.width = canvas.width || canvas.clientWidth * 2;
    outCanvas.height = canvas.height || canvas.clientHeight * 2;
    const ctx = outCanvas.getContext("2d");
    if (!ctx) return false;

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);

    // Draw the 3D WebGL buffer
    ctx.drawImage(canvas, 0, 0, outCanvas.width, outCanvas.height);

    outCanvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        triggerDownload(url, `${fileName}.png`);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
    }, "image/png");

    return true;
  } catch {
    return false;
  }
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
