import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, main, unpackSubmission, published } from './lib.mjs';
import { LIMITS } from '../shared/schema.mjs';

main(async () => {
  const input = process.argv[2];
  if (!input) throw new Error('사용법: npm run import -- ./submission.zip');
  const stat = await fs.stat(input);
  if (stat.size > LIMITS.batch + 5 * 1024 ** 2) throw new Error('ZIP 입력 크기 제한 초과입니다.');
  const bytes = await fs.readFile(input);
  const { manifest, records } = unpackSubmission(bytes);
  const existing = await published();
  if (records.some(r => existing.some(p => p.sha256 === r.plan.sha256))) throw new Error('이미 공개된 원본 파일이 포함되어 있습니다. 중복 자료를 제거해주세요.');
  const stagingRoot = path.join(ROOT, 'staging');
  await fs.mkdir(stagingRoot, { recursive: true });
  if ((await fs.lstat(stagingRoot)).isSymbolicLink()) throw new Error('staging 링크는 허용하지 않습니다.');
  const dest = path.join(stagingRoot, manifest.submissionId);
  await fs.mkdir(dest); // Reject an existing submission rather than overwrite a review.
  try {
    await fs.writeFile(path.join(dest, 'original-submission.zip'), bytes, { flag: 'wx' });
    await fs.mkdir(path.join(dest, 'records'));
    await fs.mkdir(path.join(dest, 'plans'));
    for (const { plan, file } of records) {
      await fs.writeFile(path.join(dest, 'records', `${plan.id}.json`), JSON.stringify(plan, null, 2));
      await fs.writeFile(path.join(dest, plan.filePath), file);
    }
    await fs.writeFile(path.join(dest, 'manifest.json'), JSON.stringify(manifest, null, 2));
    await fs.writeFile(path.join(dest, 'REVIEW.md'), `# 비공개 검토\n\n학생 이름, 연락처, 사진 및 미리보기의 개인정보를 확인하세요.\n저작권과 배포 허락을 확인하고 각 records JSON의 author, license, source, 분류를 수정하세요.\n원본에 개인정보가 있으면 원본을 정리해 다시 분석·제출하세요.\n\n이 패키지는 아직 공개되지 않았습니다.\n\nnpm run approve -- ${manifest.submissionId} --privacy-reviewed --copyright-reviewed --reviewer "검토자"\n`);
    console.log(`비공개 가져오기 완료: ${manifest.submissionId} (${records.length}개)\n검토 폴더: ${dest}\n공개 폴더에는 추가하지 않았습니다.`);
  } catch (error) { await fs.rm(dest, { recursive: true, force: true }); throw error; }
});
