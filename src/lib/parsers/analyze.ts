import { classify } from '../classifier';
import { extractHwpx } from './hwpx';
import { LIMITS, validateSignature } from '../../../shared/schema.mjs';
import type { Draft, Plan } from '../../types';

export async function hashFile(file: File) {
  const bytes = await file.arrayBuffer();
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function analyzeFile(file: File): Promise<Pick<Draft, 'plan' | 'confidence' | 'evidence' | 'warning'>> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!['hwp', 'hwpx'].includes(ext ?? '')) throw new Error('HWP와 HWPX 파일만 선택할 수 있습니다.');
  if (!file.size || file.size > LIMITS.file) throw new Error('빈 파일이거나 파일당 20MiB 제한을 초과했습니다.');
  const format = ext === 'hwpx' ? 'HWPX' : 'HWP';
  const bytes = new Uint8Array(await file.arrayBuffer());
  validateSignature(bytes, format);
  const sha256 = await hashFile(file);
  let text = '', warning = '';
  if (format === 'HWPX') text = extractHwpx(bytes);
  else warning = '구형 HWP 본문 분석은 지원하지 않습니다. 파일명으로 추정했으며, 직접 분류를 확인해주세요. 원본은 그대로 보존합니다.';
  const result = classify(text, file.name);
  const plan: Plan = {
    id: `plan-${sha256}`, title: file.name.replace(/\.hwpx?$/i, ''), grades: [], gradeBand: '', subject: '기타', unit: '', normalizedUnit: '',
    lessonNumber: '', topic: '', objectives: [], standards: [], curriculum: '', teachingModel: '', duration: '', keywords: [],
    fileFormat: format, originalFileName: file.name, filePath: `plans/${sha256}.${ext}`, fileSize: file.size, sha256,
    previewText: text, author: '', license: '', source: '', publishedAt: '', status: 'draft', ...result.values,
  };
  return { plan, confidence: result.confidence, evidence: result.evidence, warning };
}
