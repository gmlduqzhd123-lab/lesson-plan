import { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { BatchDownloadError, prepareDownloads, type DownloadProgress } from '../lib/batch-download';
import { saveBlob } from '../lib/download';
import { useAccessGate } from './AccessGate';
import type { Plan } from '../types';
import '../batch-download.css';

export default function BatchDownload({ visible, results, selected, onChange, onBusyChange }: { visible: Plan[]; results: Plan[]; selected: Plan[]; onChange: (plans: Plan[]) => void; onBusyChange: (busy: boolean) => void }) {
  const { requireAccess } = useAccessGate();
  const running = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState('');
  const [failures, setFailures] = useState<BatchDownloadError['failures']>([]);
  const [notice, setNotice] = useState('');
  const [toolsOpen, setToolsOpen] = useState(false);
  useEffect(() => () => { running.current?.abort(); }, []);
  async function download() {
    if (running.current || !selected.length) return;
    const controller = new AbortController(); running.current = controller;
    setBusy(true); onBusyChange(true); setError(''); setFailures([]); setNotice('');
    try {
      const result = await prepareDownloads(selected, { signal: controller.signal, onProgress: p => { if (!controller.signal.aborted) setProgress(p); } });
      if (controller.signal.aborted) return;
      saveBlob(result.blob, result.name); setNotice(`${selected.length}개 자료를 모두 확인하고 다운로드했습니다.`);
    } catch (e) {
      if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : '다운로드하지 못했습니다.'); if (e instanceof BatchDownloadError) setFailures(e.failures); }
    } finally { running.current = null; if (!controller.signal.aborted) { setBusy(false); onBusyChange(false); setProgress(null); } }
  }
  const triggerDownload = () => { requireAccess(() => { void download(); }); };
  return <section className={`batch-download${toolsOpen ? ' tools-open' : ''}`} aria-label="선택 자료 다운로드" aria-busy={busy}>
    <div className="batch-toolbar"><strong aria-live="polite">선택한 자료 {selected.length}개</strong><button className="mobile-selection-tools button secondary" aria-expanded={toolsOpen} aria-controls="selection-tools" onClick={() => setToolsOpen(open => !open)}>{toolsOpen ? '선택 도구 접기' : '전체 선택·선택 도구'}</button><div id="selection-tools" className="batch-buttons">
      <button className="button secondary" disabled={busy || !visible.length} onClick={() => onChange([...new Map([...selected, ...visible].map(p => [p.id, p])).values()])}>현재 화면의 자료 전체 선택</button>
      <button className="button secondary" disabled={busy || !results.length} onClick={() => onChange([...new Map([...selected, ...results].map(p => [p.id, p])).values()])}>검색 결과 전체 선택 ({results.length}개)</button>
      <button className="button secondary" disabled={busy || !selected.length} onClick={() => onChange([])}>선택 해제</button>
      <button className="button primary" disabled={busy || !selected.length} onClick={triggerDownload}><Download size={17} />{busy ? '다운로드 준비 중…' : selected.length > 1 ? '선택 자료 ZIP 다운로드' : '선택 자료 다운로드'}</button>
    </div></div>
    <p className="batch-help">현재 화면은 {visible.length}개, 검색·필터에 맞는 전체 결과는 {results.length}개입니다. 검색 결과 전체 선택은 아직 표시되지 않은 자료도 포함합니다. 검색·필터를 바꿔도 선택은 유지됩니다. 한 번에 256MiB까지 받을 수 있어요.</p>
    {selected.length > 0 && <details><summary>선택 목록 보기 ({selected.length}개 · {(selected.reduce((n, p) => n + p.fileSize, 0) / 1024 ** 2).toFixed(1)}MiB)</summary><ul className="batch-list">{selected.map(p => <li key={p.id}><div><strong>{p.title}</strong><small>{p.originalFileName}</small></div><button disabled={busy} onClick={() => onChange(selected.filter(plan => plan.id !== p.id))} aria-label={`${p.title} 선택 목록에서 제외`}><X size={18} /></button></li>)}</ul></details>}
    {progress && <div role="status" className="batch-progress"><span>{progress.stage === 'files' ? `원본 확인 ${progress.completed} / ${progress.total}개` : `ZIP 생성 ${Math.round(progress.percent)}%`}</span><progress max={100} value={progress.percent} aria-label={progress.stage === 'files' ? '원본 확인 진행률' : 'ZIP 생성 진행률'} /></div>}
    {error && <div className="alert" role="alert"><p>{error}</p>{failures.length > 0 && <ul>{failures.map((f, i) => <li key={i}>{f.title} · {f.name}: {f.reason}</li>)}</ul>}</div>}
    {notice && <p role="status" className="batch-success">{notice}</p>}
    {selected.length > 0 && <div className="mobile-download-bar" aria-label="하단 선택 자료 다운로드"><div><strong>{selected.length}개 선택</strong><small>{busy ? progress?.stage === 'zip' ? `ZIP 생성 ${Math.round(progress.percent)}%` : `원본 확인 ${progress?.completed || 0}/${selected.length}` : '원본 확인 후 다운로드'}</small></div><button className="button primary" disabled={busy} onClick={triggerDownload}><Download size={17} />{busy ? '준비 중…' : selected.length > 1 ? 'ZIP 받기' : '원본 받기'}</button></div>}
  </section>;
}

