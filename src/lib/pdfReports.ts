import logoUrl from "@/app/components/images/system-logo-cutout.png";

type PdfRowCell = string | number | null | undefined;

type PdfImageFormat = "PNG" | "JPEG";
type PdfImageAsset = { dataUrl: string; format: PdfImageFormat };

export type PdfImageColumn = {
  /**
   * Column index in the table (0-based, matching `columns`).
   * Works with the current array-based rows API.
   */
  columnIndex: number;
  imageUrls: Array<string | null | undefined>;
  sizeMm?: number;
  /** Optional per-row fallback text (e.g., initials) when image fails to load. */
  fallbackText?: Array<string | null | undefined>;
};

export type PdfTableReportOptions = {
  title: string;
  subtitle?: string;
  fileName?: string;
  columns: string[];
  rows: PdfRowCell[][];
  imageColumns?: PdfImageColumn[];

  orgName?: string;
  generatedBy?: string;

  /** Defaults to landscape when there are many columns. */
  orientation?: "portrait" | "landscape";
};

let cachedLogoDataUrl: string | null = null;

async function loadImageAsDataUrl(url: string) {
  // In most browsers, fetching a same-origin Vite asset is fine. If it fails,
  // we'll just omit the logo instead of failing the export.
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load image: ${res.status}`);
  }
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image blob"));
    reader.readAsDataURL(blob);
  });
}

function toPdfImageFormat(dataUrl: string): PdfImageFormat {
  const prefix = String(dataUrl || "").slice(0, 64).toLowerCase();
  if (prefix.includes("image/jpeg") || prefix.includes("image/jpg")) return "JPEG";
  return "PNG";
}

async function loadImageAsJpegThumbnail(
  url: string,
  sizePx: number,
  quality: number,
): Promise<PdfImageAsset> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load image: ${res.status}`);
  }
  const blob = await res.blob();

  // Prefer ImageBitmap for speed and to avoid CORS tainting (we draw from a fetched blob).
  const bitmapSupported = typeof createImageBitmap === "function";
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // Fallback: return original data URL if canvas is unavailable.
    const dataUrl = await loadImageAsDataUrl(url);
    return { dataUrl, format: toPdfImageFormat(dataUrl) };
  }

  let sourceWidth = 0;
  let sourceHeight = 0;
  let drawSource: any = null;
  let bitmap: ImageBitmap | null = null;

  if (bitmapSupported) {
    try {
      bitmap = await createImageBitmap(blob);
      sourceWidth = bitmap.width;
      sourceHeight = bitmap.height;
      drawSource = bitmap;
    } catch {
      bitmap = null;
    }
  }

  if (!drawSource) {
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Failed to decode image"));
        el.src = objectUrl;
      });
      sourceWidth = img.naturalWidth || img.width || 0;
      sourceHeight = img.naturalHeight || img.height || 0;
      drawSource = img;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  const maxSide = Math.max(1, Math.max(sourceWidth, sourceHeight));
  const scale = Math.min(1, sizePx / maxSide);
  const outW = Math.max(1, Math.round(sourceWidth * scale));
  const outH = Math.max(1, Math.round(sourceHeight * scale));

  canvas.width = outW;
  canvas.height = outH;

  // White background for consistent JPEG output.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(drawSource, 0, 0, outW, outH);

  if (bitmap) {
    try {
      bitmap.close();
    } catch {
      // ignore
    }
  }

  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return { dataUrl, format: "JPEG" };
}

async function mapWithConcurrency<T, U>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  const safeLimit = Math.max(1, Math.floor(limit || 1));
  const results: U[] = new Array(items.length);
  let nextIndex = 0;

  const runWorker = async () => {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) return;
      results[current] = await fn(items[current], current);
    }
  };

  const workers = new Array(Math.min(safeLimit, items.length))
    .fill(0)
    .map(() => runWorker());
  await Promise.all(workers);
  return results;
}

async function getLogoDataUrl() {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  cachedLogoDataUrl = await loadImageAsDataUrl(logoUrl);
  return cachedLogoDataUrl;
}

function safeFileName(input: string) {
  const trimmed = (input || "report").trim();
  const base = trimmed.length > 0 ? trimmed : "report";
  return base.replace(/[^\w\-]+/g, "_").replace(/_+/g, "_").replace(/^_+/, "");
}

function formatGeneratedAt() {
  return new Date().toLocaleString();
}

export async function exportTableReportToPdf(options: PdfTableReportOptions) {
  const orgName = options.orgName || "Murekefu Music Hub";
  const generatedAt = formatGeneratedAt();
  const title = options.title || "Report";
  const subtitle = options.subtitle || "";

  const orientation =
    options.orientation ||
    (options.columns.length > 7 ? "landscape" : "portrait");

  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const autoTable: any = (autoTableModule as any).default || autoTableModule;

  const doc = new jsPDF({
    orientation: orientation === "landscape" ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const marginX = 12;
  const headerHeight = subtitle ? 30 : 26;
  const footerHeight = 10;

  const brandRgb: [number, number, number] = [10, 102, 95]; // teal-ish
  const textRgb: [number, number, number] = [15, 23, 42];
  const mutedRgb: [number, number, number] = [71, 85, 105];

  let logoDataUrl: string | null = null;
  try {
    logoDataUrl = await getLogoDataUrl();
  } catch {
    // ignore
  }

  const imageColumns = (options.imageColumns || [])
    .filter((col) => Number.isFinite(col.columnIndex))
    .map((col) => ({
      columnIndex: Math.max(0, Math.floor(col.columnIndex)),
      sizeMm: Math.max(6, Math.floor(col.sizeMm || 10)),
      imageUrls: col.imageUrls || [],
      fallbackText: col.fallbackText || [],
    }));

  const imageAssetsByColumn = new Map<number, Array<PdfImageAsset | null>>();
  if (imageColumns.length > 0) {
    // Load all images up-front so AutoTable hooks remain synchronous.
    await Promise.all(
      imageColumns.map(async (col) => {
        const sizePx = Math.max(48, Math.round(col.sizeMm * 12)); // ~300dpi-ish thumbnail
        const assets = await mapWithConcurrency(
          col.imageUrls,
          6,
          async (url) => {
            const raw = String(url || "").trim();
            if (!raw) return null;
            try {
              return await loadImageAsJpegThumbnail(raw, sizePx, 0.82);
            } catch {
              return null;
            }
          },
        );
        imageAssetsByColumn.set(col.columnIndex, assets);
      }),
    );
  }

  const drawHeader = (pageNumber: number) => {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(marginX, headerHeight + 2, pageWidth - marginX, headerHeight + 2);

    // Accent bar
    doc.setFillColor(...brandRgb);
    doc.rect(marginX, 8, pageWidth - marginX * 2, 1.2, "F");

    // Logo + org name
    let logoOk = false;
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", marginX, 11, 10, 10);
      logoOk = true;
    }

    const leftTextX = logoOk ? marginX + 12 : marginX;
    doc.setTextColor(...textRgb);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(orgName, leftTextX, 16);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...mutedRgb);
    doc.text(`Generated: ${generatedAt}`, pageWidth - marginX, 16, {
      align: "right",
    });

    doc.setTextColor(...textRgb);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(title, marginX, 24);

    if (subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...mutedRgb);
      const maxWidth = pageWidth - marginX * 2;
      const lines = doc.splitTextToSize(subtitle, maxWidth);
      doc.text(lines, marginX, 28);
    }

    if (pageNumber > 1) {
      // Subtle page indicator on subsequent pages
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...mutedRgb);
      doc.text(`Page ${pageNumber}`, pageWidth - marginX, headerHeight, {
        align: "right",
      });
    }
  };

  const drawFooter = (pageNumber: number, pageCount: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...mutedRgb);
    doc.text(
      `${orgName}${options.generatedBy ? ` | Generated by ${options.generatedBy} | ` : " | "}${generatedAt}`,
      marginX,
      pageHeight - 6,
    );
    doc.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - marginX, pageHeight - 6, {
      align: "right",
    });
  };

  const columnStyles: Record<number, any> = {};
  for (const col of imageColumns) {
    columnStyles[col.columnIndex] = {
      cellWidth: col.sizeMm + 6,
      halign: "center",
      valign: "middle",
    };
  }

  autoTable(doc, {
    head: [options.columns],
    body: (options.rows || []).map((row) =>
      (row || []).map((cell) => (cell === null || cell === undefined ? "" : String(cell))),
    ),
    margin: {
      top: headerHeight + 6,
      left: marginX,
      right: marginX,
      bottom: footerHeight,
    },
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2,
      textColor: textRgb,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: brandRgb,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles,
    didParseCell: (data: any) => {
      if (data.section !== "body") return;
      if (!imageAssetsByColumn.has(data.column.index)) return;
      const col = imageColumns.find((c) => c.columnIndex === data.column.index);
      if (!col) return;
      data.cell.text = [""];
      data.cell.styles.minCellHeight = Math.max(
        Number(data.cell.styles.minCellHeight || 0),
        col.sizeMm + 4,
      );
      data.cell.styles.halign = "center";
      data.cell.styles.valign = "middle";
    },
    didDrawCell: (data: any) => {
      if (data.section !== "body") return;
      const assets = imageAssetsByColumn.get(data.column.index);
      if (!assets) return;
      const asset = assets[data.row.index] || null;
      const col = imageColumns.find((c) => c.columnIndex === data.column.index);
      const sizeMm = col?.sizeMm || 10;

      const pad = 1;
      const maxSize = Math.max(4, Math.min(data.cell.width, data.cell.height) - pad * 2);
      const size = Math.min(sizeMm, maxSize);
      const x = data.cell.x + (data.cell.width - size) / 2;
      const y = data.cell.y + (data.cell.height - size) / 2;

      if (asset) {
        try {
          doc.addImage(asset.dataUrl, asset.format, x, y, size, size);
        } catch {
          // ignore image draw failures
        }
        return;
      }

      const fallback =
        String(col?.fallbackText?.[data.row.index] || "").trim().slice(0, 2) ||
        "";
      if (!fallback) return;

      doc.setFillColor(226, 232, 240);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(x, y, size, size, 2, 2, "FD");
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(fallback.toUpperCase(), x + size / 2, y + size / 2 + 2.1, {
        align: "center",
      });
    },
    didDrawPage: (data: any) => {
      // Header (branding + title) per page
      drawHeader(data.pageNumber);
    },
  });

  const pageCount = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber);
    drawFooter(pageNumber, pageCount);
  }

  const fileName =
    options.fileName ||
    `${safeFileName(title)}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
