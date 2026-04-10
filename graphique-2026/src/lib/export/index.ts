// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — Export Service
// ─────────────────────────────────────────────────────────────────────────────

export interface ExportOptions {
  scale?: number;
  background?: string;
  filename?: string;
}

/**
 * Export an SVG element to PNG using canvas rasterization
 */
export async function exportToPNG(
  svgElement: SVGElement,
  options: ExportOptions = {}
): Promise<void> {
  const scale = options.scale ?? 2;
  const background = options.background ?? "#0D1117";
  const filename = options.filename ?? "graphique-diagram";

  const svgData = new XMLSerializer().serializeToString(svgElement);
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    const bbox = svgElement.getBoundingClientRect();
    canvas.width = (bbox.width || 800) * scale;
    canvas.height = (bbox.height || 600) * scale;

    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);

    URL.revokeObjectURL(url);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${filename}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
  };
  img.src = url;
}

/**
 * Export SVG content as an .svg file
 */
export function exportToSVG(svgElement: SVGElement, options: ExportOptions = {}): void {
  const filename = options.filename ?? "graphique-diagram";
  const svgData = new XMLSerializer().serializeToString(svgElement);
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

  // Dynamically import jsPDF to keep bundle small
  const { jsPDF } = await import("jspdf");

  const bbox = svgElement.getBoundingClientRect();
  const w = bbox.width || 800;
  const h = bbox.height || 600;

  const orientation = w > h ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation, unit: "px", format: [w, h] });

  const svgData = new XMLSerializer().serializeToString(svgElement);
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  await new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w * 2;
      canvas.height = h * 2;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#0D1117";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      const imgData = canvas.toDataURL("image/png");
      doc.addImage(imgData, "PNG", 0, 0, w, h);
      doc.save(`${filename}.pdf`);
      URL.revokeObjectURL(url);
      resolve();
    };
    img.src = url;
  });
}