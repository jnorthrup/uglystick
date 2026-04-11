// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — Export Service
// ─────────────────────────────────────────────────────────────────────────────

export interface ExportOptions {
  scale?: number;
  background?: string;
  filename?: string;
}

interface SvgExportGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  viewBox: string | null;
}

export function parseViewBox(value: string | null | undefined): SvgExportGeometry | null {
  if (!value) return null;
  const parts = value
    .trim()
    .split(/[\s,]+/)
    .map((part) => Number.parseFloat(part))
    .filter((part) => Number.isFinite(part));

  if (parts.length < 4) return null;

  const [x, y, width, height] = parts;
  if (width <= 0 || height <= 0) return null;

  return {
    x,
    y,
    width,
    height,
    viewBox: `${x} ${y} ${width} ${height}`,
  };
}

export function parseLength(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function resolveSvgExportGeometry(svgElement: SVGElement): SvgExportGeometry {
  const originalViewBox = parseViewBox(svgElement.getAttribute("data-original-view-box"));
  if (originalViewBox) return originalViewBox;

  const currentViewBox = parseViewBox(svgElement.getAttribute("viewBox"));
  if (currentViewBox) return currentViewBox;

  const originalWidth = parseLength(svgElement.getAttribute("data-original-width"));
  const originalHeight = parseLength(svgElement.getAttribute("data-original-height"));
  if (originalWidth && originalHeight) {
    return {
      x: 0,
      y: 0,
      width: originalWidth,
      height: originalHeight,
      viewBox: null,
    };
  }

  const attrWidth = parseLength(svgElement.getAttribute("width"));
  const attrHeight = parseLength(svgElement.getAttribute("height"));
  if (attrWidth && attrHeight) {
    return {
      x: 0,
      y: 0,
      width: attrWidth,
      height: attrHeight,
      viewBox: svgElement.getAttribute("viewBox") ?? null,
    };
  }

  const bbox = svgElement.getBoundingClientRect();
  const width = Math.max(1, bbox.width || 800);
  const height = Math.max(1, bbox.height || 600);
  return {
    x: 0,
    y: 0,
    width,
    height,
    viewBox: svgElement.getAttribute("viewBox") ?? null,
  };
}

export function getExportBackground(svgElement: SVGElement, fallback: string): string {
  const firstElement = svgElement.firstElementChild;
  if (firstElement && firstElement.tagName.toLowerCase() === "rect") {
    const fill = firstElement.getAttribute("fill");
    if (fill && fill !== "none") return fill;
  }
  return fallback;
}

export function cloneSvgForExport(
  svgElement: SVGElement,
  fallbackBackground = "#0D1117"
): { svg: SVGSVGElement; geometry: SvgExportGeometry; background: string } {
  const geometry = resolveSvgExportGeometry(svgElement);
  const clone = svgElement.cloneNode(true) as SVGSVGElement;

  if (geometry.viewBox) {
    clone.setAttribute("viewBox", geometry.viewBox);
  } else {
    clone.removeAttribute("viewBox");
  }

  clone.setAttribute("width", String(geometry.width));
  clone.setAttribute("height", String(geometry.height));
  clone.removeAttribute("style");
  clone.setAttribute("preserveAspectRatio", "xMidYMid meet");

  return {
    svg: clone,
    geometry,
    background: getExportBackground(svgElement, fallbackBackground),
  };
}

async function rasterizeSvgForExport(
  svgElement: SVGElement,
  scale: number,
  fallbackBackground: string
): Promise<{ canvas: HTMLCanvasElement; geometry: SvgExportGeometry; background: string }> {
  const { svg, geometry, background } = cloneSvgForExport(svgElement, fallbackBackground);
  const svgData = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(geometry.width * scale));
        canvas.height = Math.max(1, Math.round(geometry.height * scale));

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error("Canvas 2D context unavailable for export"));
          return;
        }

        ctx.fillStyle = background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve({ canvas, geometry, background });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load SVG for export"));
      };

      img.src = url;
    });
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/**
 * Export an SVG element to PNG using canvas rasterization
 */
export async function exportToPNG(
  svgElement: SVGElement,
  options: ExportOptions = {}
): Promise<void> {
  const scale = options.scale ?? 2;
  const filename = options.filename ?? "graphique-diagram";
  const background = options.background ?? "#0D1117";

  const { canvas } = await rasterizeSvgForExport(svgElement, scale, background);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `${filename}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

/**
 * Export SVG content as an .svg file
 */
export function exportToSVG(svgElement: SVGElement, options: ExportOptions = {}): void {
  const filename = options.filename ?? "graphique-diagram";
  const { svg } = cloneSvgForExport(svgElement, options.background ?? "#0D1117");
  const svgData = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export diagram code as a text file (Mermaid .mmd or DOT .dot)
 */
export function exportToText(
  code: string,
  format: "mermaid" | "dot" | "json",
  options: ExportOptions = {}
): void {
  const filename = options.filename ?? "graphique-diagram";
  const ext = format === "mermaid" ? "mmd" : format === "dot" ? "dot" : "json";
  const mime =
    format === "json" ? "application/json" : "text/plain;charset=utf-8";
  const blob = new Blob([code], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export to PDF using jsPDF
 */
export async function exportToPDF(
  svgElement: SVGElement,
  options: ExportOptions = {}
): Promise<void> {
  const filename = options.filename ?? "graphique-diagram";
  const scale = options.scale ?? 2;

  // Dynamically import jsPDF to keep bundle small
  const { jsPDF } = await import("jspdf");

  const { canvas, geometry } = await rasterizeSvgForExport(
    svgElement,
    scale,
    options.background ?? "#0D1117"
  );

  const orientation = geometry.width > geometry.height ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation, unit: "px", format: [geometry.width, geometry.height] });
  const imgData = canvas.toDataURL("image/png");
  doc.addImage(imgData, "PNG", 0, 0, geometry.width, geometry.height);
  doc.save(`${filename}.pdf`);
}
