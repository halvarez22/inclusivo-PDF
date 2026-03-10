import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } from "docx";
import type { InclusiveChange } from "../types";

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildParagraph = (text: string, changes: InclusiveChange[]) => {
  const phrases = changes.map(c => c.inclusive).filter(p => p && p.length > 0);
  if (phrases.length === 0) {
    return new Paragraph({
      children: [new TextRun({ text })],
    });
  }
  const regex = new RegExp(`(${phrases.map(escapeRegExp).join("|")})`, "g");
  const parts = text.split(regex);
  const children = parts.map((part) => {
    const matching = changes.find(c => c.inclusive === part);
    if (matching) {
      return new TextRun({ text: part, highlight: "yellow" });
    }
    return new TextRun({ text: part });
  });
  return new Paragraph({ children });
};

const buildParagraphWithPhrases = (text: string, phrases: string[]) => {
  const validPhrases = phrases.filter(p => p && p.length > 0);
  if (validPhrases.length === 0) {
    return new Paragraph({
      children: [new TextRun({ text })],
    });
  }
  const regex = new RegExp(`(${validPhrases.map(escapeRegExp).join("|")})`, "g");
  const parts = text.split(regex);
  const children = parts.map(part => {
    if (validPhrases.includes(part)) {
      return new TextRun({ text: part, highlight: "yellow" });
    }
    return new TextRun({ text: part });
  });
  return new Paragraph({ children });
};

export const downloadDocxWithHighlights = async (
  modifiedText: string,
  changes: InclusiveChange[],
  fileName: string
) => {
  const lines = modifiedText.split("\n");
  const paragraphs = lines.map(line => buildParagraph(line, changes));
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const base = fileName.toLowerCase().endsWith(".pdf")
    ? fileName.slice(0, -4)
    : fileName;
  a.href = url;
  a.download = `inclusivo_${base}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const downloadDocxComparisonTwoColumns = async (
  originalText: string,
  modifiedText: string,
  changes: InclusiveChange[],
  fileName: string
) => {
  const originalLines = originalText.split("\n");
  const modifiedLines = modifiedText.split("\n");
  const maxLines = Math.max(originalLines.length, modifiedLines.length);

  const originalPhrases = changes.map(c => c.original).filter(p => p && p.length > 0);
  const inclusivePhrases = changes.map(c => c.inclusive).filter(p => p && p.length > 0);

  const rows: TableRow[] = [];

  for (let i = 0; i < maxLines; i++) {
    const leftLine = originalLines[i] ?? "";
    const rightLine = modifiedLines[i] ?? "";

    const leftParagraph = buildParagraphWithPhrases(leftLine, originalPhrases);
    const rightParagraph = buildParagraphWithPhrases(rightLine, inclusivePhrases);

    rows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [leftParagraph],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [rightParagraph],
          }),
        ],
      })
    );
  }

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [table],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const base = fileName.toLowerCase().endsWith(".pdf")
    ? fileName.slice(0, -4)
    : fileName;
  a.href = url;
  a.download = `comparativa_2_columnas_${base}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
