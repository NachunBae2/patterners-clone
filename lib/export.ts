"use client";

/** Triggers a browser download for a Blob. */
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const safeName = (title: string) => (title.trim() || "patterners").replace(/[\\/:*?"<>|]+/g, "_");

/**
 * Exports a standalone SVG string as svg/png/jpg.
 * `scale` multiplies the SVG's width/height for raster output.
 */
export async function exportSvg(svg: string, format: "svg" | "png" | "jpg", filename: string, scale = 2) {
  if (format === "svg") {
    download(new Blob([svg], { type: "image/svg+xml" }), `${filename}.svg`);
    return;
  }
  const blob = await rasterize(svg, format, scale);
  download(blob, `${filename}.${format}`);
}

export async function rasterize(svg: string, format: "png" | "jpg", scale = 2): Promise<Blob> {
  const m = svg.match(/<svg[^>]*\swidth="([\d.]+)"[^>]*\sheight="([\d.]+)"/);
  const w = m ? Number(m[1]) : 800;
  const h = m ? Number(m[2]) : 600;
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("svg load failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d")!;
    if (format === "jpg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), format === "jpg" ? "image/jpeg" : "image/png", 0.92),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Small data-URL thumbnail from an SVG string (for the home list). */
export function svgThumbnail(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
