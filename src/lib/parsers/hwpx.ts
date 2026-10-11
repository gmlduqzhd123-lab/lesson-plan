import { readSafeZip } from '../../../shared/safe-zip.mjs';
import { LIMITS } from '../../../shared/schema.mjs';

export function extractHwpx(bytes: Uint8Array): string {
  const entries = readSafeZip(bytes, { maxInput: LIMITS.file, maxExpanded: 64 * 1024 ** 2 });
  const sections = [...entries.keys()].filter(n => /^Contents\/section\d+\.xml$/i.test(n)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  if (!sections.length) throw new Error('HWPX 본문 section XML이 없습니다. 암호화 또는 지원되지 않는 파일인지 확인해주세요.');
  const lines: string[] = [];
  let xmlSize = 0;
  for (const name of sections) {
    const raw = new TextDecoder('utf-8', { fatal: true }).decode(entries.get(name)!);
    xmlSize += raw.length;
    if (xmlSize > 8 * 1024 ** 2 || /<!DOCTYPE|<!ENTITY/i.test(raw)) throw new Error('XML 크기 제한 초과 또는 허용되지 않은 외부 엔티티입니다.');
    const doc = new DOMParser().parseFromString(raw, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('손상된 HWPX XML입니다.');
    const all = Array.from(doc.getElementsByTagName('*'));
    for (const node of all) {
      if (node.localName !== 'p') continue;
      const texts = Array.from(node.getElementsByTagName('*')).filter(n => n.localName === 't' && closestParagraph(n) === node).map(n => n.textContent ?? '');
      if (texts.length) lines.push(texts.join('').trim());
    }
    // Preserve row label/value relationships even when each table cell is a paragraph.
    for (const row of all.filter(n => n.localName === 'tr')) {
      const cells = Array.from(row.children).filter(n => n.localName === 'tc');
      const values = cells.map(cell => Array.from(cell.getElementsByTagName('*')).filter(n => n.localName === 't').map(n => n.textContent ?? '').join(' ').trim());
      if (values.length > 1) lines.unshift(values.join('\t'));
    }
  }
  const text = lines.filter(Boolean).join('\n');
  if (!text.trim()) throw new Error('추출 가능한 텍스트가 없습니다. 그림 위주 자료는 직접 입력해주세요.');
  if (text.length > LIMITS.text) throw new Error('문서 본문이 너무 깁니다. 자료를 나누어 제출해주세요.');
  return text;
}
function closestParagraph(n: Element): Element | null {
  let parent = n.parentElement;
  while (parent && parent.localName !== 'p') parent = parent.parentElement;
  return parent;
}
