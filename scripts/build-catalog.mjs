import fs from 'node:fs/promises';
import path from 'node:path';
import { main, published, ROOT } from './lib.mjs';
main(async () => {
  const records = (await published()).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const dir = path.join(ROOT, 'public', 'catalog');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'index.json'), JSON.stringify(records, null, 2) + '\n');
  console.log(`통합 목록 생성: ${records.length}개`);
});
