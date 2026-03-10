import { Document, Packer, Paragraph, TextRun } from "docx";
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
