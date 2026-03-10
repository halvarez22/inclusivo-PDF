import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { InclusiveChange } from "../types";

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const downloadOriginalPdfWithHighlights = async (
  originalText: string,
  changes: InclusiveChange[],
  fileName: string
) => {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let currentPage = pdfDoc.addPage();
  let { width, height } = currentPage.getSize();

  const margin = 50;
  const fontSize = 12;
  const lineHeight = fontSize * 1.35;
  let x = margin;
  let y = height - margin;
  let usableWidth = width - 2 * margin - 5; // pequeño margen extra para evitar desbordes visuales

  // Todas las frases detectadas por el LLM: sin duplicados, recortadas, ordenadas por longitud (largas primero)
  // para que "los habitantes del estado" se marque entero y no solo "los habitantes"
  const originals = [...new Set(changes.map(c => c.original?.trim()).filter(Boolean))];
  originals.sort((a, b) => b.length - a.length);
  const originalsNorm = originals.map(o => o.toLowerCase());
  const regex = originals.length
    ? new RegExp(`(${originals.map(escapeRegExp).join("|")})`, "gi")
    : null;

  const lines = originalText.split("\n");

  const ensureSpace = () => {
    if (y < margin + lineHeight) {
      currentPage = pdfDoc.addPage();
      const size = currentPage.getSize();
      width = size.width;
      height = size.height;
      x = margin;
      y = height - margin;
      usableWidth = width - 2 * margin - 5;
    }
  };

  /** Rompe el texto en líneas que caben. firstLineMax = ancho para la 1ª línea (resto de línea actual). */
  const wrapToFit = (text: string, maxW: number, firstLineMax?: number): string[] => {
    const out: string[] = [];
    const words = text.split(/\s+/);
    let current = "";
    let isFirst = true;
    const getLimit = () => (isFirst && firstLineMax != null ? firstLineMax : maxW);
    for (const word of words) {
      const withSpace = current ? current + " " + word : word;
      const limit = getLimit();
      if (font.widthOfTextAtSize(withSpace, fontSize) <= limit) {
        current = withSpace;
      } else {
        if (current) {
          out.push(current);
          current = "";
          isFirst = false;
        }
        const w = font.widthOfTextAtSize(word, fontSize);
        if (w <= getLimit()) {
          current = word;
        } else {
          for (const char of word) {
            const cand = current + char;
            if (font.widthOfTextAtSize(cand, fontSize) <= getLimit()) {
              current = cand;
            } else {
              if (current) out.push(current);
              current = char;
              isFirst = false;
            }
          }
        }
      }
    }
    if (current) out.push(current);
    return out;
  };

  const drawTextRun = (text: string, highlight: boolean) => {
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    if (highlight) {
      currentPage.drawRectangle({
        x,
        y: y - fontSize + 3,
        width: textWidth,
        height: fontSize + 4,
        color: rgb(1, 1, 0),
        opacity: 0.5,
      });
    }
    currentPage.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
    x += textWidth;
  };

  for (const line of lines) {
    x = margin;
    ensureSpace();
    if (!regex) {
      const maxLineWidth = usableWidth;
      const wrapped = wrapToFit(line, maxLineWidth);
      for (const ln of wrapped) {
        ensureSpace();
        currentPage.drawText(ln, { x, y, size: fontSize, font });
        y -= lineHeight;
      }
      continue;
    }
    const parts = line.split(regex);
    const maxLineWidth = usableWidth;
    for (const part of parts) {
      if (!part) continue;
      const isHighlight = originalsNorm.includes(part.toLowerCase());
      const remainingWidth = usableWidth - (x - margin);
      const wrapped = wrapToFit(part, maxLineWidth, Math.max(remainingWidth, 0));
      for (let i = 0; i < wrapped.length; i++) {
        if (i > 0) {
          y -= lineHeight;
          x = margin;
          ensureSpace();
        }
        drawTextRun(wrapped[i], isHighlight);
      }
    }
    y -= lineHeight;
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const base = fileName.toLowerCase().endsWith(".pdf")
    ? fileName.slice(0, -4)
    : fileName;
  a.href = url;
  a.download = `original_resaltado_${base}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
