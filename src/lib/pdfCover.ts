// Extract the first page of a PDF as a JPEG image.
// Used to auto-generate cover art for compositions/arrangements.
import * as pdfjsLib from 'pdfjs-dist';

// Use the worker from the package
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export async function extractPdfFirstPage(pdfFile: File): Promise<string | null> {
  try {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    if (pdf.numPages === 0) {
      return null;
    }

    const page = await pdf.getPage(1);

    // Render at 2x scale for good quality
    const scale = 2;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const context = canvas.getContext('2d');
    if (!context) return null;

    // White background
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    // Convert to JPEG data URL (quality 0.85)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    // Cleanup
    pdf.destroy();

    return dataUrl;
  } catch (err) {
    console.error('[extractPdfFirstPage] error:', err);
    return null;
  }
}

export default extractPdfFirstPage;
