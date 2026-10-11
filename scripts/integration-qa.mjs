// Isolated test server only. The product remains a static GitHub Pages application.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { ROOT, unpackSubmission } from './lib.mjs';

const source = path.join(ROOT, '.tmp', 'audit-local');
const zipName = (await fs.readdir(source)).filter(n => /^submission-.*\.zip$/.test(n)).at(-1);
assert.ok(zipName, 'Run local browser QA first');
const zip = path.join(source, zipName);
const submission = unpackSubmission(await fs.readFile(zip));
const root = await fs.mkdtemp(path.join(ROOT, '.tmp', 'integration-'));
for (const dir of ['scripts', 'shared']) await fs.cp(path.join(ROOT, dir), path.join(root, dir), { recursive: true });
await fs.cp(path.join(ROOT, 'dist'), path.join(root, 'public'), { recursive: true });
const run = (name, ...args) => {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', name), ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
};
run('import-submission.mjs', zip);
assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, 'public/catalog/index.json'), 'utf8')), []);
run('approve-submission.mjs', submission.manifest.submissionId, '--privacy-reviewed', '--copyright-reviewed', '--reviewer', '격리 테스트 검토자');
run('build-catalog.mjs'); run('validate-records.mjs');
const publicRoot = path.join(root, 'public');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/lesson-plan/')) { res.writeHead(404).end(); return; }
    const filename = path.resolve(publicRoot, decodeURIComponent(url.pathname.slice('/lesson-plan/'.length)) || 'index.html');
    const relative = path.relative(publicRoot, filename);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
    const body = await fs.readFile(filename);
    res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Content-Length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined), headless: true });
const report = { scope: 'isolated real static HTTP, browser-generated ZIP, no route mocks, no public production records', checks: [], errors: [] };
try {
  const page = await browser.newPage({ acceptDownloads: true });
  page.on('pageerror', error => report.errors.push(error.message));
  const origin = `http://127.0.0.1:${server.address().port}/lesson-plan/`;
  await page.goto(`${origin}#/library`);
  await page.getByRole('link', { name: /수동 분류한 HWP 테스트/ }).waitFor();
  assert.equal(await page.locator('.plan-card').count(), 2);
  report.checks.push('private import does not update public catalog; explicit approval publishes two linked records');
  await page.getByLabel('학년', { exact: true }).selectOption('4');
  await page.getByLabel('교과', { exact: true }).selectOption('국어');
  await page.getByLabel('자료 검색').fill('수동분류');
  assert.equal(await page.locator('.plan-card').count(), 1);
  report.checks.push('real catalog HTTP search and combined filters');
  for (const { plan, file } of submission.records) {
    await page.goto(`${origin}#/library/${plan.id}`);
    await page.getByRole('heading', { name: plan.title, exact: true }).waitFor();
    await page.reload();
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole('button', { name: '원본 다운로드', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(root, `detail-${plan.fileFormat}-${width}.png`), fullPage: true });
    }
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: '원본 다운로드', exact: true }).click();
    const download = await pending;
    assert.equal(download.suggestedFilename(), plan.originalFileName);
    const downloaded = path.join(root, `download.${plan.fileFormat.toLowerCase()}`);
    await download.saveAs(downloaded);
    assert.deepEqual(await fs.readFile(downloaded), Buffer.from(file));
    report.checks.push(`${plan.fileFormat}: detail reload and five responsive widths; original HTTP download preserves name and bytes`);
  }
  const p = submission.records[0].plan;
  await page.goto(`${origin}#/library/${p.id}`);
  await page.getByRole('button', { name: '원본 다운로드', exact: true }).waitFor();
  await fs.writeFile(path.join(publicRoot, p.filePath), Buffer.alloc(p.fileSize));
  await page.getByRole('button', { name: '원본 다운로드', exact: true }).click();
  await page.getByText('원본 파일 무결성 검사에 실패했습니다.').waitFor();
  report.checks.push('same-size tampered original rejected by browser SHA-256 verification');
  assert.deepEqual(report.errors, []);
  await fs.writeFile(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checks: report.checks, evidence: path.join(root, 'report.json') }, null, 2));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
