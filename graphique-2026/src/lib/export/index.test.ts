import { describe, expect, it } from "vitest";
import { cloneSvgForExport, resolveSvgExportGeometry } from "./index";

const SVG_NS = "http://www.w3.org/2000/svg";

function makeSvg(attrs: Record<string, string> = {}) {
  const svg = document.createElementNS(SVG_NS, "svg");
  for (const [key, value] of Object.entries(attrs)) {
    svg.setAttribute(key, value);
  }

  const bg = document.createElementNS(SVG_NS, "rect");
  bg.setAttribute("x", "0");
  bg.setAttribute("y", "0");
  bg.setAttribute("width", "100");
  bg.setAttribute("height", "100");
  bg.setAttribute("fill", "#123456");
  svg.appendChild(bg);

  return svg;
}

describe("svg export helpers", () => {
  it("prefers the original diagram bounds when available", () => {
    const svg = makeSvg({
      viewBox: "0 0 1200 900",
      width: "1200",
      height: "900",
      style: "width: 100%; height: 100%;",
      "data-original-view-box": "0 0 2400 1800",
      "data-original-width": "2400",
      "data-original-height": "1800",
    });

    expect(resolveSvgExportGeometry(svg)).toEqual({
      x: 0,
      y: 0,
      width: 2400,
      height: 1800,
      viewBox: "0 0 2400 1800",
    });
  });

  it("normalizes the exported svg clone for raster output", () => {
    const svg = makeSvg({
      viewBox: "0 0 1200 900",
      width: "1200",
      height: "900",
      style: "width: 100%; height: 100%;",
      "data-original-view-box": "0 0 2400 1800",
      "data-original-width": "2400",
      "data-original-height": "1800",
    });

    const { svg: clone, geometry, background } = cloneSvgForExport(svg, "#0d1117");

    expect(geometry.width).toBe(2400);
    expect(geometry.height).toBe(1800);
    expect(clone.getAttribute("viewBox")).toBe("0 0 2400 1800");
    expect(clone.getAttribute("width")).toBe("2400");
    expect(clone.getAttribute("height")).toBe("1800");
    expect(clone.getAttribute("style")).toBeNull();
    expect(background).toBe("#123456");
  });
});
