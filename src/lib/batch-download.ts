import type { Plan } from '../types';

export const MAX_DOWNLOAD_BYTES = 256 * 1024 ** 2;
export type DownloadProgress = { stage: 'files' | 'zip'; completed: number; total: number; percent: number };
export class BatchDownloadError extends Error {
  constructor(public failures: { title: string; name: string; reason: string }[]) {
    super('일부 자료를 준비하지 못했습니다. 파일을 다운로드하지 않았습니다.');
  }
}

export function archiveNames(names: string[]): string[] {
  const key = (name: string) => name.normalize('NFC').toLowerCase();
  const reserved = new Set(names.map(key)), used = new Set<string>();
  return names.map(name => {
    if (!name || /[\\/\u0000-\u001f]/.test(name) || name === '.' || name === '..') throw new Error('올바르지 않은 원본 파일명입니다.');
    let result = name, number = 2;
    const dot = name.lastIndexOf('.'), stem = dot > 0 ? name.slice(0, dot) : name, extension = dot > 0 ? name.slice(dot) : '';
    while (used.has(key(result))) {
      do { result = `${stem} (${number++})${extension}`; } while (reserved.has(key(result)) || used.has(key(result)));
    }
    used.add(key(result)); return result;
  });
}

export async function prepareDownloads(plans: Plan[], options: { signal: AbortSignal; onProgress: (progress: DownloadProgress) => void }) {
  if (!plans.length) throw new Error('다운로드할 자료를 선택해주세요.');
  if (plans.some(p => p.status !== 'approved' || !/^plans\/[a-f0-9]{64}\.(hwp|hwpx|pdf)$/.test(p.filePath))) throw new Error('공개 승인된 자료만 다운로드할 수 있습니다.');
  if (plans.reduce((sum, p) => sum + p.fileSize, 0) > MAX_DOWNLOAD_BYTES) throw new Error('한 번에 256MiB까지 다운로드할 수 있습니다. 선택한 자료를 나누어 받아주세요.');
  const names = archiveNames(plans.map(p => p.originalFileName));
  const bytes: Uint8Array<ArrayBuffer>[] = new Array(plans.length);
  const failures: { title: string; name: string; reason: string }[] = [];
  let completed = 0, next = 0;
  const checkAborted = () => { if (options.signal.aborted) throw new DOMException('다운로드를 취소했습니다.', 'AbortError'); };
  options.onProgress({ stage: 'files', completed, total: plans.length, percent: 0 });
  async function worker() {
    while (next < plans.length) {
      checkAborted(); const index = next++, p = plans[index];
      const controller = new AbortController();
      const abort = () => controller.abort(); options.signal.addEventListener('abort', abort, { once: true });
      const timeout = setTimeout(abort, 30000);
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}${p.filePath}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`파일을 가져오지 못했습니다 (HTTP ${response.status}).`);
        const data = new Uint8Array(await response.arrayBuffer());
        if (data.byteLength !== p.fileSize) throw new Error('원본 파일 크기가 목록과 다릅니다.');
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data))).map(b => b.toString(16).padStart(2, '0')).join('');
        if (hash !== p.sha256) throw new Error('원본 파일 무결성 검사에 실패했습니다.');
        bytes[index] = data;
      } catch (error) {
        checkAborted();
        failures.push({ title: p.title, name: p.originalFileName, reason: controller.signal.aborted ? '요청 시간이 초과되었습니다.' : error instanceof Error ? error.message : '파일을 가져오지 못했습니다.' });
      } finally { clearTimeout(timeout); options.signal.removeEventListener('abort', abort); }
      completed++; options.onProgress({ stage: 'files', completed, total: plans.length, percent: completed / plans.length * 100 });
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, plans.length) }, worker));
  checkAborted();
  if (failures.length) throw new BatchDownloadError(failures);
  if (plans.length === 1) return { blob: new Blob([bytes[0]], { type: plans[0].fileFormat === 'PDF' ? 'application/pdf' : 'application/octet-stream' }), name: plans[0].originalFileName };
  options.onProgress({ stage: 'zip', completed, total: plans.length, percent: 0 });
  const { default: JSZip } = await import('jszip'); checkAborted();
  const zip = new JSZip();
  bytes.forEach((data, index) => zip.file(names[index], data));
  // Write known sizes in local headers: HWPX contains ZIP signatures itself,
  // which some streaming unzip readers mistake for entries with deferred sizes.
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' }, metadata => {
    checkAborted(); options.onProgress({ stage: 'zip', completed, total: plans.length, percent: metadata.percent });
  });
  checkAborted(); return { blob, name: `지도안_모음_${plans.length}개.zip` };
}
