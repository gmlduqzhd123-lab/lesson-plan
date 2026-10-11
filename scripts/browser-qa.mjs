import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { hwpxFixture, recordFixture } from '../tests/fixtures.mjs';
import { ROOT, unpackSubmission } from './lib.mjs';

const origin = process.env.QA_URL || 'http://127.0.0.1:4173/lesson-plan/';
const dir = path.join(ROOT, '.tmp', 'browser-qa');
await fs.mkdir(dir, { recursive: true });
const executablePath = process.env.BROWSER_PATH || (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined);
const browser = await chromium.launch({ executablePath, headless: true });
const report = { url: origin, checks: [], consoleErrors: [], failedRequests: [], screenshots: [] };
const check = (name) => { report.checks.push(name); console.log(`PASS ${name}`); };
try {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  page.on('pageerror', e => report.consoleErrors.push(e.message));
  page.on('requestfailed', r => report.failedRequests.push({ url: r.url(), error: r.failure()?.errorText }));
  await page.goto(origin); await page.getByRole('heading', { level: 1 }).waitFor();
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'main-content');
  assert.equal(await page.evaluate(() => location.hash.includes('main-content')), false);
  check('keyboard skip link focuses main without changing HashRouter route');
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport); await page.goto(origin); await page.getByText('첫 번째 수업 자료를 기다리고 있어요').waitFor(); await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'horizontal overflow');
    const file = path.join(dir, `home-${viewport.width}.png`); await page.screenshot({ path: file, fullPage: true }); report.screenshots.push(file); check(`home empty state, font loading, no overflow ${viewport.width}`);
    if (viewport.width < 760) { await page.getByRole('button', { name: '메뉴 열기' }).click(); await page.getByRole('navigation').getByRole('link', { name: '지도안 자료실' }).click(); } else await page.getByRole('navigation').getByRole('link', { name: '지도안 자료실' }).click();
    await page.getByRole('heading', { name: '우리 수업에 딱 맞는 지도안' }).waitFor(); await page.reload(); await page.getByLabel('학년', { exact: true }).waitFor(); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); check(`library navigation and hash reload ${viewport.width}`);
    await page.goto(`${origin}#/upload`); await page.getByRole('heading', { name: '선생님의 수업을 나눠주세요' }).waitFor(); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); check(`upload layout ${viewport.width}`);
    await page.goto(`${origin}#/about`); await page.getByRole('heading', { name: '좋은 수업은, 나눌수록 넓어집니다' }).waitFor(); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); check(`about layout ${viewport.width}`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const bytes = await hwpxFixture();
  await page.goto(`${origin}#/upload`);
  await page.getByLabel('한글 파일 선택').setInputFiles([{ name: '5학년_체육_지도안.hwpx', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) }, { name: '중복.hwpx', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) }, { name: '손상.hwpx', mimeType: 'application/octet-stream', buffer: Buffer.from('broken') }]);
  await page.getByText('같은 원본이 있습니다.', { exact: false }).waitFor(); await page.getByText('HWPX ZIP 서명이 올바르지 않습니다.', { exact: false }).waitFor(); check('multi-file analysis, duplicate hash and bad file isolation');
  await page.getByRole('button', { name: '중복.hwpx 제거', exact: true }).click(); await page.getByRole('button', { name: '손상.hwpx 제거', exact: true }).click();
  await page.getByRole('button', { name: '5학년_체육_지도안.hwpx 분류 수정', exact: true }).click();
  await page.getByLabel('출처 및 이용 조건 (필수)', { exact: true }).fill('테스트 fixture 전용');
  assert.equal(await page.getByLabel('단원', { exact: true }).inputValue(), '2. 도전'); assert.equal(await page.getByLabel('교과', { exact: true }).inputValue(), '체육'); assert.equal(await page.getByLabel('자료 제목').inputValue(), '5학년_체육_지도안'); check('table classification and metadata editing');
  await page.setViewportSize({ width: 320, height: 568 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); await page.screenshot({ path: path.join(dir, 'upload-editor-320.png'), fullPage: true }); check('upload table and editor mobile overflow');
  await page.getByLabel('학생 이름, 연락처, 사진 등 개인정보가', { exact: false }).check();
  await page.getByLabel('저작권 및 배포 권한을 확인했으며', { exact: false }).check();
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: '관리자 제출용 ZIP 다운로드', exact: true }).click(); const download = await downloadPromise; const zipPath = path.join(dir, download.suggestedFilename()); await download.saveAs(zipPath);
  const submission = unpackSubmission(await fs.readFile(zipPath)); assert.equal(submission.records.length, 1); assert.equal(submission.records[0].plan.license, '테스트 fixture 전용'); await page.getByRole('status').filter({ hasText: '아직 공개 등록되지 않았습니다' }).waitFor(); check('real browser ZIP download validates in administrator importer');
  // Seeded catalog is intercepted inside this browser only; never placed in public or records.
  const p = recordFixture(bytes, { status: 'approved', publishedAt: '2026-10-11T00:00:00.000Z' });
  const q = { ...p, id: 'plan-' + 'f'.repeat(64), sha256: 'f'.repeat(64), filePath: 'plans/' + 'f'.repeat(64) + '.hwpx', title: '달리기 다음 차시', unit: '3. 경쟁', normalizedUnit: '3.경쟁' };
  await page.route('**/catalog/index.json', route => route.fulfill({ json: [p, q] }));
  await page.route(`**/${p.filePath}`, route => route.fulfill({ body: Buffer.from(bytes), contentType: 'application/octet-stream' }));
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(`${origin}#/library`); await page.reload(); await page.getByRole('link', { name: /협력 달리기 수업/ }).waitFor();
  await page.getByLabel('학년', { exact: true }).selectOption('5'); await page.getByLabel('교과', { exact: true }).selectOption('체육'); await page.getByLabel('단원', { exact: true }).selectOption('2. 도전'); await page.getByLabel('자료 검색').fill('함께달리기'); assert.equal(await page.locator('.plan-card').count(), 1); check('seeded catalog simultaneous filters and Korean whitespace search');
  await page.locator('.plan-card').click(); await page.getByRole('button', { name: '원본 다운로드', exact: true }).waitFor(); await page.reload(); await page.getByRole('heading', { name: p.title, exact: true }).waitFor(); const originalPromise = page.waitForEvent('download'); await page.getByRole('button', { name: '원본 다운로드', exact: true }).click(); const originalDownload = await originalPromise; assert.equal(originalDownload.suggestedFilename(), p.originalFileName); await originalDownload.saveAs(path.join(dir, 'download.hwpx')); assert.deepEqual(await fs.readFile(path.join(dir, 'download.hwpx')), Buffer.from(bytes)); check('seeded detail, hash refresh, byte-preserved original and Korean filename download');
  await page.getByRole('heading', { name: '함께 살펴볼 지도안' }).waitFor(); check('related lesson discovery');
  await page.unroute(`**/${p.filePath}`); await page.route(`**/${p.filePath}`, route => route.fulfill({ status: 404 })); await page.reload(); await page.getByText('파일이 없거나 접근할 수 없어 다운로드할 수 없습니다.').waitFor(); assert.equal(await page.getByRole('button', { name: '원본 다운로드', exact: true }).isDisabled(), true); check('missing original disables download with reason');
  await page.unroute('**/catalog/index.json'); await page.route('**/catalog/index.json', route => route.fulfill({ status: 503 })); await page.goto(`${origin}#/library`); await page.reload(); await page.getByRole('alert').waitFor(); check('catalog HTTP failure state');
  assert.deepEqual(report.consoleErrors, []);
  await fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`Browser QA: ${report.checks.length} checks; console errors: ${report.consoleErrors.length}. Evidence: ${dir}`);
} finally { await browser.close(); }
