import { getSharp } from '@/lib/sharp-loader';
import type { GeneratedPracticeQuestion } from '@/lib/ai/types';

const A4_WIDTH = 1240;
const A4_HEIGHT = 1754;
const MARGIN = 60;
const LINE_HEIGHT = 36;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapText(text: string, maxChars = 42): string[] {
  const lines: string[] = [];
  let current = '';
  for (const ch of text) {
    if (current.length >= maxChars && ch !== ' ') {
      lines.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

interface SheetQuestion {
  sourceLabel: string;
  items: GeneratedPracticeQuestion[];
}

async function renderPracticeSheetPng(
  title: string,
  sections: SheetQuestion[],
): Promise<Buffer> {
  const textBlocks: { y: number; lines: string[]; bold?: boolean; size?: number }[] = [];
  let y = MARGIN;

  textBlocks.push({ y, lines: [title], bold: true, size: 32 });
  y += 50;
  textBlocks.push({ y, lines: [`打印日期：${new Date().toLocaleDateString('zh-CN')}`], size: 22 });
  y += 40;

  for (const section of sections) {
    textBlocks.push({ y, lines: [`【${section.sourceLabel}】`], bold: true, size: 26 });
    y += 38;

    section.items.forEach((item, idx) => {
      const prefix = `${idx + 1}. `;
      const qLines = wrapText(`${prefix}${item.question}`, 40);
      textBlocks.push({ y, lines: qLines, size: 24 });
      y += qLines.length * LINE_HEIGHT;

      if (item.options && item.options.length > 0) {
        for (const opt of item.options) {
          const optLines = wrapText(`    ${opt}`, 38);
          textBlocks.push({ y, lines: optLines, size: 22 });
          y += optLines.length * 30;
        }
      } else {
        textBlocks.push({ y, lines: ['    答：________________________'], size: 22 });
        y += 30;
      }
      y += 16;
    });
    y += 20;
  }

  textBlocks.push({
    y: A4_HEIGHT - MARGIN - 40,
    lines: ['—— 答案见家长端或完成后再核对 ——'],
    size: 20,
  });

  const textElements = textBlocks
    .map((block) => {
      const weight = block.bold ? 'font-weight="700"' : '';
      const size = block.size ?? 24;
      const inner = block.lines
        .map((line, li) => {
          const dy = li === 0 ? 0 : size + 8;
          return `<tspan x="${MARGIN}" dy="${li === 0 ? 0 : dy}" ${weight} font-size="${size}">${escapeXml(line)}</tspan>`;
        })
        .join('');
      return `<text x="${MARGIN}" y="${block.y}" font-family="PingFang SC, Microsoft YaHei, sans-serif" fill="#5D4037">${inner}</text>`;
    })
    .join('\n');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${A4_WIDTH}" height="${A4_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#FFFDE7"/>
  <rect x="20" y="20" width="${A4_WIDTH - 40}" height="${A4_HEIGHT - 40}" fill="none" stroke="#D7CCC8" stroke-width="2" stroke-dasharray="8,4"/>
  ${textElements}
</svg>`;

  return (await getSharp())(Buffer.from(svg)).png().toBuffer();
}

export { renderPracticeSheetPng, A4_WIDTH, A4_HEIGHT };
export type { SheetQuestion };
