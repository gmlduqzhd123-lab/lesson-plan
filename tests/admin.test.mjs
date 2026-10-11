import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import JSZip from 'jszip';
import { ROOT, unpackSubmission } from '../scripts/lib.mjs';
import { submissionFixture } from './fixtures.mjs';

async function sandbox(t) {
  const tempRoot = path.join(ROOT, '.tmp');
  await fs.mkdir(tempRoot, { recursive: true });
  const root = await fs.mkdtemp(path.join(tempRoot, 'admin-'));
  for (const dir of ['scripts', 'shared']) await fs.cp(path.join(ROOT, dir), path.join(root, dir), { recursive: true });
  await fs.mkdir(path.join(root, 'records'));
  await fs.mkdir(path.join(root, 'public', 'plans'), { recursive: true });
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return { root, run: (name, ...args) => spawnSync(process.execPath, [path.join(root, 'scripts', name), ...args], { cwd: root, encoding: 'utf8' }) };
}

for (const relative of ['records', 'public/catalog']) test(`rejects directory links at ${relative} without writing outside the repository`, async t => {
  const { root, run } = await sandbox(t);
  const outside = await fs.mkdtemp(path.join(ROOT, '.tmp', 'outside-'));
  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  const marker = relative === 'records' ? 'marker.txt' : 'index.json';
  await fs.writeFile(path.join(outside, marker), 'protected');
  const target = path.join(root, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  if (relative === 'records') await fs.rmdir(target);
  await fs.symlink(outside, target, process.platform === 'win32' ? 'junction' : 'dir');
  assert.notEqual(run('build-catalog.mjs').status, 0);
  assert.equal(await fs.readFile(path.join(outside, marker), 'utf8'), 'protected');
});

test('approval audit output link rejects publication and rolls back candidate files', async t => {
  const { root, run } = await sandbox(t);
  const fixture = await submissionFixture();
  const input = path.join(root, 'input.zip'); await fs.writeFile(input, fixture.bytes);
  assert.equal(run('import-submission.mjs', input).status, 0);
  const outside = await fs.mkdtemp(path.join(ROOT, '.tmp', 'outside-'));
  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  await fs.symlink(outside, path.join(root, 'staging', fixture.id, 'approval.json'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.notEqual(run('approve-submission.mjs', fixture.id, '--privacy-reviewed', '--copyright-reviewed', '--reviewer', '검토자').status, 0);
  assert.deepEqual(await fs.readdir(path.join(root, 'public', 'plans')), []);
  assert.deepEqual(await fs.readdir(path.join(root, 'records')), []);
  assert.deepEqual(await fs.readdir(outside), []);
});
test('import stays private; explicit review required; approve, validate, catalog and duplicate rejection', async t => {
  const { root, run } = await sandbox(t);
  const fixture = await submissionFixture();
  const zipPath = path.join(root, 'submission.zip');
  await fs.writeFile(zipPath, fixture.bytes);
  const imported = run('import-submission.mjs', zipPath);
  assert.equal(imported.status, 0, imported.stderr);
  assert.deepEqual(await fs.readdir(path.join(root, 'public', 'plans')), []);
  assert.deepEqual(await fs.readdir(path.join(root, 'records')), []);
  assert.notEqual(run('approve-submission.mjs', fixture.id).status, 0);
  assert.deepEqual(await fs.readdir(path.join(root, 'public', 'plans')), []);
  const approved = run('approve-submission.mjs', fixture.id, '--privacy-reviewed', '--copyright-reviewed', '--reviewer', '테스트 검토자');
  assert.equal(approved.status, 0, approved.stderr);
  assert.equal(run('validate-records.mjs').status, 0);
  assert.equal(run('build-catalog.mjs').status, 0);
  const catalog = JSON.parse(await fs.readFile(path.join(root, 'public', 'catalog', 'index.json'), 'utf8'));
  assert.equal(catalog.length, 1); assert.equal(catalog[0].status, 'approved');
  assert.deepEqual(await fs.readFile(path.join(root, 'public', fixture.p.filePath)), Buffer.from((await unpackSubmission(fixture.bytes)).records[0].file));
  assert.equal(run('check-duplicates.mjs').status, 0);
  assert.notEqual(run('import-submission.mjs', zipPath).status, 0);
  assert.notEqual(run('approve-submission.mjs', fixture.id, '--privacy-reviewed', '--copyright-reviewed', '--reviewer', '재검토').status, 0);
});
test('empty catalog builds as JSON array', async t => { const { root, run } = await sandbox(t); assert.equal(run('validate-records.mjs').status, 0); assert.equal(run('build-catalog.mjs').status, 0); assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, 'public', 'catalog', 'index.json'), 'utf8')), []); });
test('staged metadata is editable but original hashes cannot be changed', async t => {
  const { root, run } = await sandbox(t); const f = await submissionFixture();
  const file = path.join(root, 's.zip'); await fs.writeFile(file, f.bytes); assert.equal(run('import-submission.mjs', file).status, 0);
  const staged = path.join(root, 'staging', f.id, 'records', `${f.p.id}.json`);
  await fs.writeFile(staged, JSON.stringify({ ...f.p, title: '검토한 제목', author: '공개 작성자' }));
  const result = run('approve-submission.mjs', f.id, '--privacy-reviewed', '--copyright-reviewed', '--reviewer', '검토자'); assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(await fs.readFile(path.join(root, 'records', `${f.p.id}.json`), 'utf8')).title, '검토한 제목');
});
test('tampered staged original rejects approval before any publication', async t => {
  const { root, run } = await sandbox(t); const f = await submissionFixture(); const file = path.join(root, 's.zip'); await fs.writeFile(file, f.bytes); assert.equal(run('import-submission.mjs', file).status, 0);
  await fs.writeFile(path.join(root, 'staging', f.id, f.p.filePath), 'tampered');
  assert.notEqual(run('approve-submission.mjs', f.id, '--privacy-reviewed', '--copyright-reviewed', '--reviewer', '검토자').status, 0); assert.deepEqual(await fs.readdir(path.join(root, 'public', 'plans')), []);
});
test('rejects traversal, unexpected file, invalid manifest and damaged ZIP', async () => {
  const z = new JSZip(); z.file('submission/../evil.hwp', 'x'); assert.throws(() => unpackSubmission(new Uint8Array())); assert.throws(() => unpackSubmission(new Uint8Array([1,2,3])));
  const malicious = await z.generateAsync({ type: 'uint8array' }); assert.throws(() => unpackSubmission(malicious), /경로/);
  const f = await submissionFixture(); f.zip.file('submission/evil.exe', 'x');
  const bad = await f.zip.generateAsync({ type: 'uint8array' }); assert.throws(() => unpackSubmission(bad), /허용되지/);
  f.zip.remove('submission/evil.exe'); f.zip.file('submission/manifest.json', '{}'); const badManifest = await f.zip.generateAsync({ type: 'uint8array' }); assert.throws(() => unpackSubmission(badManifest));
});
test('rejects hash mismatch and missing license at approval', async t => {
  const f = await submissionFixture(); f.zip.file(`submission/${f.p.filePath}`, 'fake'); const bad = await f.zip.generateAsync({ type: 'uint8array' }); assert.throws(() => unpackSubmission(bad), /SHA-256/);
  const { root, run } = await sandbox(t); const noLicense = await submissionFixture({ license: '' }); const file = path.join(root, 's.zip'); await fs.writeFile(file, noLicense.bytes); assert.equal(run('import-submission.mjs', file).status, 0); assert.notEqual(run('approve-submission.mjs', noLicense.id, '--privacy-reviewed', '--copyright-reviewed', '--reviewer', '검토자').status, 0); assert.deepEqual(await fs.readdir(path.join(root, 'public', 'plans')), []);
});
test('published validation detects file corruption and orphan files', async t => {
  const { root, run } = await sandbox(t); await fs.writeFile(path.join(root, 'public', 'plans', 'orphan.hwp'), 'x'); assert.notEqual(run('validate-records.mjs').status, 0);
});
