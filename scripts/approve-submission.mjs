import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, main, regularFile, unpackSubmission, published, hash } from './lib.mjs';
import { PlanSchema } from '../shared/schema.mjs';

main(async () => {
  const [id, ...args] = process.argv.slice(2);
  if (!/^submission-[a-f0-9-]{36}$/.test(id ?? '')) throw new Error('올바른 submission-id가 필요합니다.');
  const reviewer = args[args.indexOf('--reviewer') + 1];
  if (!args.includes('--privacy-reviewed') || !args.includes('--copyright-reviewed') || !args.includes('--reviewer') || !reviewer?.trim() || reviewer.startsWith('--')) throw new Error('승인에는 --privacy-reviewed --copyright-reviewed --reviewer "검토자"가 필요합니다. 실제 검토 후 실행하세요.');
  const stage = path.join(ROOT, 'staging', id);
  const original = unpackSubmission(await regularFile(path.join(stage, 'original-submission.zip')));
  if (original.manifest.submissionId !== id) throw new Error('제출 ID가 다릅니다.');
  const existing = await published();
  const candidates = [];
  for (const { plan } of original.records) {
    const p = PlanSchema.parse(JSON.parse((await regularFile(path.join(stage, 'records', `${plan.id}.json`))).toString('utf8')));
    const file = await regularFile(path.join(stage, plan.filePath));
    if (p.sha256 !== plan.sha256 || p.filePath !== plan.filePath || p.id !== plan.id || p.fileSize !== plan.fileSize || p.originalFileName !== plan.originalFileName || p.fileFormat !== plan.fileFormat || p.status !== 'draft' || hash(file) !== plan.sha256 || file.length !== plan.fileSize) throw new Error('검토 중 원본 연결·무결성이 변경되었습니다. 다시 제출해주세요.');
    if (!p.license.trim() || p.license === '확인 필요') throw new Error(`${p.title}: 공개 이용 조건을 명시해주세요.`);
    if (existing.some(e => e.sha256 === p.sha256)) throw new Error('이미 공개된 중복 자료입니다.');
    candidates.push({ plan: PlanSchema.parse({ ...p, status: 'approved', publishedAt: new Date().toISOString() }), file });
  }
  // All records pass preflight before any publicly served path is written.
  for (const dir of [path.join(ROOT, 'records'), path.join(ROOT, 'public'), path.join(ROOT, 'public', 'plans')]) if ((await fs.lstat(dir)).isSymbolicLink()) throw new Error('공개 경로 링크는 허용하지 않습니다.');
  const written = [];
  try {
    for (const { plan, file } of candidates) {
      const fileDest = path.join(ROOT, 'public', plan.filePath), recordDest = path.join(ROOT, 'records', `${plan.id}.json`);
      await fs.writeFile(fileDest, file, { flag: 'wx' }); written.push(fileDest);
      await fs.writeFile(recordDest, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' }); written.push(recordDest);
    }
    await fs.writeFile(path.join(stage, 'approval.json'), JSON.stringify({ reviewedBy: reviewer, privacyReviewed: true, copyrightReviewed: true, approvedAt: new Date().toISOString(), records: candidates.map(r => r.plan.id) }, null, 2));
    console.log(`로컬 공개 폴더 반영: ${candidates.length}개\n다음: npm run build:catalog && npm run build\n검토 후 records, public/plans, public/catalog를 커밋·push해야 웹사이트에 게시됩니다.`);
  } catch (error) { for (const file of written.reverse()) await fs.unlink(file); throw error; }
});
