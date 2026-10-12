import { webcrypto } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Upload from '../src/pages/Upload';
import { hwpxFixture } from './fixtures.mjs';
import { createUuid } from '../src/lib/uuid';
import { createSubmission } from '../src/lib/submission';
import { analyzeFile } from '../src/lib/parsers/analyze';
import { readSafeZip } from '../shared/safe-zip.mjs';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function olderCrypto() { vi.stubGlobal('crypto', { getRandomValues: webcrypto.getRandomValues.bind(webcrypto), subtle: webcrypto.subtle }); }
function fileFrom(bytes: Uint8Array, name: string) {
  const file = new File([new Uint8Array(bytes)], name);
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new Uint8Array(bytes).buffer });
  return file;
}

it('analyzes multiple selected files through the real parser when randomUUID is unavailable', async () => {
  olderCrypto();
  const user = userEvent.setup(); render(<Upload publishedPlans={[]} />);
  const bytes = await hwpxFixture();
  const hwp = new Uint8Array([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1,0]);
  await user.upload(screen.getByLabelText('지도안 파일 선택'), [fileFrom(bytes, '5학년_체육.hwpx'), fileFrom(hwp, '4학년_국어.hwp')]);
  await waitFor(() => expect(screen.getByText('2개 분석 완료', { exact: false })).toBeTruthy());
  await user.click(screen.getByRole('button', { name: '5학년_체육.hwpx 분류 수정' }));
  expect((screen.getByLabelText('단원') as HTMLInputElement).value).toBe('2. 도전');
  await user.click(screen.getByRole('button', { name: '4학년_국어.hwp 분류 수정' }));
  expect((screen.getByLabelText('교과') as HTMLSelectElement).value).toBe('국어');
});

it('creates a valid administrator ZIP with byte-preserved original without randomUUID', async () => {
  olderCrypto();
  const bytes = await hwpxFixture(), file = fileFrom(bytes, '5학년_체육.hwpx');
  const analyzed = await analyzeFile(file);
  const result = await createSubmission([{ key: createUuid(), file, state: '완료', plan: { ...analyzed.plan!, license: '합성 시험 자료' } }], { privacy: true, copyright: true });
  expect(result.submissionId).toMatch(/^submission-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  const array = await new Promise<ArrayBuffer>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.readAsArrayBuffer(result.blob); });
  const entries = readSafeZip(new Uint8Array(array));
  expect(entries.get(`submission/${analyzed.plan!.filePath}`)).toEqual(bytes);
});

it('shows initialization errors and leaves the file selector usable instead of failing silently', async () => {
  vi.stubGlobal('crypto', {});
  render(<Upload publishedPlans={[]} />);
  fireEvent.change(screen.getByLabelText('지도안 파일 선택'), { target: { files: [new File(['anything'], 'test.hwp')] } });
  expect(screen.getByRole('alert').textContent).toContain('파일 처리를 시작하지 못했습니다');
  expect((screen.getByLabelText('지도안 파일 선택') as HTMLInputElement).disabled).toBe(false);
  expect(screen.queryByText('분석 중')).toBeNull();
});

it('keeps fallback identifiers distinct and compliant with the UUID v4 format', () => {
  olderCrypto();
  const ids = Array.from({ length: 100 }, createUuid);
  expect(new Set(ids).size).toBe(100);
  expect(ids.every(id => /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id))).toBe(true);
});
