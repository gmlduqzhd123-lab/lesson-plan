import path from 'node:path';
import { main, published, ROOT, writeJsonAtomic } from './lib.mjs';
main(async () => {
  const records = (await published()).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const dir = path.join(ROOT, 'public', 'catalog');
  await writeJsonAtomic(path.join(dir, 'index.json'), records);
  console.log(`통합 목록 생성: ${records.length}개`);
});
