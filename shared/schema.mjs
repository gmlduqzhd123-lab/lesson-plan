import { z } from 'zod';

export const SUBJECTS = ['국어', '수학', '사회', '과학', '영어', '도덕', '체육', '음악', '미술', '실과', '통합교과', '창의적 체험활동', '기타'];
export const LIMITS = Object.freeze({ file: 20 * 1024 ** 2, batch: 100 * 1024 ** 2, expanded: 160 * 1024 ** 2, entry: 24 * 1024 ** 2, entries: 2000, files: 30, text: 300000 });
const short = z.string().max(500);
const list = z.array(short).max(100);
export const PlanSchema = z.object({
  id: z.string().regex(/^plan-[a-f0-9]{64}$/),
  title: z.string().min(1).max(200),
  grades: z.array(z.number().int().min(1).max(6)).max(6).refine(a => new Set(a).size === a.length),
  gradeBand: short.default(''),
  subject: z.string().refine(s => SUBJECTS.includes(s)),
  unit: short,
  normalizedUnit: short,
  lessonNumber: short,
  topic: short,
  objectives: list,
  standards: list,
  curriculum: short,
  teachingModel: short,
  duration: short.default(''),
  keywords: list,
  fileFormat: z.enum(['HWP', 'HWPX']),
  originalFileName: z.string().min(1).max(255).refine(s => !/[\\/\u0000-\u001f]/.test(s)),
  filePath: z.string().regex(/^plans\/[a-f0-9]{64}\.(hwp|hwpx)$/),
  fileSize: z.number().int().positive().max(LIMITS.file),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  previewText: z.string().max(LIMITS.text),
  author: short,
  license: short,
  source: short.default(''),
  publishedAt: z.string().max(40),
  status: z.enum(['draft', 'approved']),
}).strict().superRefine((p, ctx) => {
  if (p.id !== `plan-${p.sha256}` || p.filePath !== `plans/${p.sha256}.${p.fileFormat.toLowerCase()}`) ctx.addIssue({ code: 'custom', message: 'ID·파일 경로와 SHA-256이 일치하지 않습니다.' });
  if (!p.originalFileName.toLowerCase().endsWith(`.${p.fileFormat.toLowerCase()}`)) ctx.addIssue({ code: 'custom', message: '원본 파일 확장자가 형식과 다릅니다.' });
  if (p.normalizedUnit !== normalize(p.unit)) ctx.addIssue({ code: 'custom', message: '단원 정규화 값이 다릅니다.' });
  if (p.status === 'approved' && (!p.license.trim() || !p.publishedAt || !Number.isFinite(Date.parse(p.publishedAt)))) ctx.addIssue({ code: 'custom', message: '공개 자료에는 이용 조건과 등록일이 필요합니다.' });
});
export const ManifestSchema = z.object({
  version: z.literal(1),
  submissionId: z.string().regex(/^submission-[a-f0-9-]{36}$/),
  createdAt: z.string().datetime(),
  declarations: z.object({ privacy: z.literal(true), copyright: z.literal(true) }).strict(),
  entries: z.array(z.object({
    record: z.string().regex(/^records\/plan-[a-f0-9]{64}\.json$/),
    file: z.string().regex(/^plans\/[a-f0-9]{64}\.(hwp|hwpx)$/),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    fileSize: z.number().int().positive().max(LIMITS.file),
  }).strict()).min(1).max(LIMITS.files),
}).strict();
export function normalize(value) { return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ''); }
export function validateSignature(bytes, format) {
  if (format === 'HWPX') {
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 3 || bytes[3] !== 4) throw new Error('HWPX ZIP 서명이 올바르지 않습니다.');
  } else {
    const magic = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    if (!magic.every((b, i) => bytes[i] === b)) throw new Error('HWP 5.x 바이너리 서명이 아닙니다. HWP 3.x 및 암호화·비정상 파일은 직접 확인해주세요.');
  }
}
