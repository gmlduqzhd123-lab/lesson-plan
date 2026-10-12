import { webcrypto } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { archiveNames, BatchDownloadError, prepareDownloads, MAX_DOWNLOAD_BYTES } from '../src/lib/batch-download';
import { readSafeZip } from '../shared/safe-zip.mjs';
import { recordFixture, hwpxFixture } from './fixtures.mjs';
import LibraryPage from '../src/pages/LibraryPage';
import type { Plan } from '../src/types';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const data = [new Uint8Array([1,2,3]), new Uint8Array([4,5,6])];
const plans = data.map((bytes, i) => recordFixture(bytes, { title: `자료 ${i}`, originalFileName: '동일.hwpx', status: 'approved', grades: [i + 1], publishedAt: '2026-10-12T00:00:00Z' })) as Plan[];
function options() { return { signal: new AbortController().signal, onProgress: vi.fn() }; }
function mockFiles() {
  vi.stubEnv('BASE_URL', '/lesson-plan/');
  vi.stubGlobal('crypto', webcrypto);
  const fetcher = vi.fn(async (url: string) => { const index = plans.findIndex(p => url.endsWith(p.filePath)); return new Response(data[index]); });
  vi.stubGlobal('fetch', fetcher); return fetcher;
}
async function blobBytes(blob: Blob) { return new Uint8Array(await new Promise<ArrayBuffer>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.readAsArrayBuffer(blob); })); }

it('preserves distinct original names and resolves exact, case and Unicode collisions without overwriting', () => {
  expect(archiveNames(['a.hwp','a.hwp','a (2).hwp','A.HWP'])).toEqual(['a.hwp','a (3).hwp','a (2).hwp','A (4).HWP']);
  expect(new Set(archiveNames(['가.hwp','가.hwp']).map(n => n.normalize('NFC'))).size).toBe(2);
  expect(() => archiveNames(['../bad.hwp'])).toThrow();
});
it('downloads a single file as the byte-identical original and uses the Pages base path', async () => {
  const fetcher = mockFiles(); const output = await prepareDownloads([plans[0]], options());
  expect(output.name).toBe('동일.hwpx'); expect(await blobBytes(output.blob)).toEqual(data[0]);
  expect(fetcher.mock.calls[0][0]).toBe(`/lesson-plan/${plans[0].filePath}`);
});
it('builds a valid ZIP only after all originals pass SHA-256 and preserves both duplicate-named files', async () => {
  mockFiles(); const config = options(); const output = await prepareDownloads(plans, config);
  const zip = readSafeZip(await blobBytes(output.blob));
  expect([...zip.keys()]).toEqual(['동일.hwpx', '동일 (2).hwpx']);
  expect(zip.get('동일.hwpx')).toEqual(data[0]); expect(zip.get('동일 (2).hwpx')).toEqual(data[1]);
  expect(config.onProgress.mock.calls.some(([p]) => p.stage === 'zip')).toBe(true);
});
it('reports all failed files and never reaches ZIP creation for missing or corrupted originals', async () => {
  vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith(plans[0].filePath) ? new Response(null, { status: 404 }) : new Response(new Uint8Array([7,8,9]))));
  const config = options();
  const error = await prepareDownloads(plans, config).catch(e => e);
  expect(error).toBeInstanceOf(BatchDownloadError); expect(error.failures).toHaveLength(2);
  expect(error.failures.some((f: { reason: string }) => f.reason.includes('HTTP 404'))).toBe(true);
  expect(error.failures.some((f: { reason: string }) => f.reason.includes('무결성'))).toBe(true);
  expect(config.onProgress.mock.calls.some(([p]) => p.stage === 'zip')).toBe(false);
});
it('packages HWPX ZIP bytes without confusing nested file signatures with outer ZIP entries', async () => {
  vi.stubGlobal('crypto', webcrypto);
  const hwpx = await hwpxFixture();
  const p = recordFixture(hwpx, { status: 'approved' }) as Plan;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(url.endsWith(p.filePath) ? new Uint8Array(hwpx) : data[0])));
  const output = await prepareDownloads([p, plans[0]], options());
  const zip = readSafeZip(await blobBytes(output.blob));
  expect(zip.get(p.originalFileName)).toEqual(hwpx); expect(zip.size).toBe(2);
});
it('rejects oversized selections, draft records and cancellation before starting requests', async () => {
  const fetcher = mockFiles();
  await expect(prepareDownloads([{...plans[0],fileSize:MAX_DOWNLOAD_BYTES+1}],options())).rejects.toThrow('256MiB');
  await expect(prepareDownloads([{...plans[0],status:'draft'}],options())).rejects.toThrow('승인');
  const abort = new AbortController(); abort.abort();
  await expect(prepareDownloads(plans,{...options(),signal:abort.signal})).rejects.toThrow('취소');
  expect(fetcher).not.toHaveBeenCalled();
});
it('selects only displayed cards, keeps selections across filters and removes hidden selected items', () => {
  const many = Array.from({length:65}, (_,i) => ({...plans[0],id:`plan-${String(i).padStart(64,'0')}`,title:`자료 ${i}`,grades:[i===64?6:5]}));
  render(<MemoryRouter><LibraryPage plans={many} loading={false} error="" retry={vi.fn()} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'현재 화면의 자료 전체 선택'}));
  expect(screen.getByText('선택한 자료 60개')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('학년'),{target:{value:'6'}});
  expect(screen.getByText('선택한 자료 60개')).toBeTruthy();
  expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByText('선택한 자료 61개')).toBeTruthy();
  fireEvent.click(screen.getByText(/선택 목록 보기/));
  fireEvent.click(screen.getByRole('button',{name:'자료 0 선택 목록에서 제외'}));
  expect(screen.getByText('선택한 자료 60개')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'선택 해제'}));
  expect((screen.getByRole('button',{name:'선택 자료 다운로드'}) as HTMLButtonElement).disabled).toBe(true);
});
it('selects every filtered result beyond displayed cards, preserves other selections and deduplicates repeated selection', () => {
  const many = Array.from({length:65}, (_,i) => ({...plans[0],id:`plan-${String(i).padStart(64,'0')}`,title:`자료 ${i}`,grades:[i===64?6:5]}));
  render(<MemoryRouter><LibraryPage plans={many} loading={false} error="" retry={vi.fn()} /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('학년'),{target:{value:'5'}});
  expect(screen.getAllByRole('checkbox')).toHaveLength(60);
  fireEvent.click(screen.getByRole('button',{name:'검색 결과 전체 선택 (64개)'}));
  expect(screen.getByText('선택한 자료 64개')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'검색 결과 전체 선택 (64개)'}));
  expect(screen.getByText('선택한 자료 64개')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('학년'),{target:{value:'6'}});
  fireEvent.click(screen.getByRole('button',{name:'검색 결과 전체 선택 (1개)'}));
  expect(screen.getByText('선택한 자료 65개')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('자료 검색'),{target:{value:'없음'}});
  expect((screen.getByRole('button',{name:'검색 결과 전체 선택 (0개)'}) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText('선택한 자료 65개')).toBeTruthy();
});
