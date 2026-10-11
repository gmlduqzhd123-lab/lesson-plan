import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, FileText, FolderUp, LoaderCircle, Package, Pencil, ShieldCheck, Trash2, UploadCloud } from 'lucide-react';
import { LIMITS, SUBJECTS, normalize } from '../../shared/schema.mjs';
import { analyzeFile } from '../lib/parsers/analyze';
import { createSubmission } from '../lib/submission';
import { saveBlob } from '../lib/download';
import { reconcileDuplicates } from '../lib/drafts';
import type { Draft, Plan } from '../types';

export default function Upload({ publishedPlans }: { publishedPlans: Plan[] }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const processing = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState('');
  const [privacy, setPrivacy] = useState(false);
  const [copyright, setCopyright] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { setDrafts(ds => reconcileDuplicates(ds, publishedPlans)); }, [publishedPlans, busy]);
  const update = (key: string, delta: Partial<Draft>) => setDrafts(ds => ds.map(d => d.key === key ? { ...d, ...delta } : d));
  const addFiles = async (files: File[]) => {
    if (processing.current || !files.length) return;
    setError(''); setNotice(''); setPrivacy(false); setCopyright(false);
    if (drafts.length + files.length > LIMITS.files || drafts.reduce((n, d) => n + d.file.size, 0) + files.reduce((n, f) => n + f.size, 0) > LIMITS.batch) { setError('한 번에 최대 30개, 전체 100MiB까지 분석할 수 있습니다.'); return; }
    const queue: Draft[] = files.map(file => ({ key: crypto.randomUUID(), file, state: '대기' }));
    setDrafts(ds => [...ds, ...queue]); setBusy(true); processing.current = true;
    const hashes = new Set([...drafts.filter(d => d.state === '완료').map(d => d.plan?.sha256), ...publishedPlans.map(p => p.sha256)]);
    try {
      for (const draft of queue) {
        update(draft.key, { state: '분석 중' });
        await new Promise(resolve => setTimeout(resolve, 0));
        try {
          const result = await analyzeFile(draft.file);
          if (hashes.has(result.plan?.sha256)) update(draft.key, { ...result, state: '중복', error: '선택 목록 또는 공개 자료실에 같은 원본이 있습니다. 이 행을 제거해주세요.' });
          else { hashes.add(result.plan?.sha256); update(draft.key, { ...result, state: '완료' }); }
        } catch (e) { update(draft.key, { state: '실패', error: e instanceof Error ? e.message : '분석 실패' }); }
      }
    } finally { setBusy(false); processing.current = false; }
  };
  const patchPlan = (key: string, delta: Partial<Plan>) => {
    if (processing.current) return;
    setPrivacy(false); setCopyright(false); setNotice('');
    setDrafts(ds => ds.map(d => d.key === key && d.plan ? { ...d, plan: { ...d.plan, ...delta, ...(delta.unit !== undefined ? { normalizedUnit: normalize(delta.unit) } : {}) } } : d));
  };
  const exportZip = async () => {
    if (processing.current) return;
    processing.current = true; setBusy(true); setError(''); setNotice('');
    try { const result = await createSubmission(drafts, { privacy, copyright }); saveBlob(result.blob, `${result.submissionId}.zip`); setNotice('관리자 제출용 ZIP을 생성했습니다. 아직 공개 등록되지 않았습니다. 다운로드한 파일을 관리자에게 별도로 전달해주세요.'); }
    catch (e) { setError(e instanceof Error ? e.message : '패키지 생성 실패'); }
    finally { processing.current = false; setBusy(false); }
  };
  return <div className="container page upload-page"><div className="page-heading"><span className="overline">SHARE YOUR LESSON</span><h1>선생님의 수업을 나눠주세요</h1><p>지도안 파일을 분석하고, 분류를 확인한 뒤 제출 패키지를 만드세요.</p></div>
    <div className="stepper"><span className="current"><b>1</b> 파일 분석</span><i /><span className={drafts.some(d => d.plan) ? 'current' : ''}><b>2</b> 분류 확인</span><i /><span className={privacy && copyright ? 'current' : ''}><b>3</b> 제출 ZIP 생성</span></div>
    <div className="local-notice"><ShieldCheck size={21} /><div><strong>파일은 선생님의 기기 안에서만 처리됩니다.</strong><p>서버에 업로드하지 않으며, ZIP을 만들어도 자료실에 자동 게시되지 않습니다.</p></div></div>
    <button disabled={busy} className={`dropzone ${dragging ? 'dragging' : ''}`} onClick={() => input.current?.click()} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); void addFiles(Array.from(e.dataTransfer.files)); }}><span className="upload-icon"><UploadCloud size={35} /></span><strong>교수학습과정안 파일을 여기에 놓아주세요.</strong><span>HWP, HWPX, PDF 파일을 한 번에 여러 개 선택할 수 있습니다.</span><span className="button secondary"><FolderUp size={17} /> 파일 선택</span><small>파일당 32MiB · 전체 100MiB · 최대 30개</small></button>
    <input ref={input} className="sr-only" aria-label="지도안 파일 선택" type="file" accept=".hwp,.hwpx,.pdf" multiple disabled={busy} onChange={e => { void addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
    <div className="format-note"><strong>HWPX</strong> 본문·표 분석 <span>·</span> <strong>HWP · PDF</strong> 파일명 추정 및 직접 입력 <span>·</span> 구형 HWP 본문 분석은 지원하지 않습니다.</div>
    {error && <div className="alert" role="alert">{error}</div>}{notice && <div className="success" role="status"><Check size={20} />{notice}</div>}
    {drafts.length > 0 && <section className="analysis-section"><div className="section-heading"><h2>분석 결과 <span className="count">{drafts.length}</span></h2><span className="muted" role="status">{busy ? '처리 중…' : `${drafts.filter(d => d.state === '완료').length}개 분석 완료`} · {(drafts.reduce((n, d) => n + d.file.size, 0) / 1024 ** 2).toFixed(2)}MiB</span></div>
      <div className="analysis-table-wrap"><table className="analysis-table"><thead><tr><th>파일명 · 상태</th><th>학년</th><th>교과</th><th>단원 · 차시 · 주제</th><th>성취기준</th><th>신뢰도</th><th>수정</th></tr></thead><tbody>{drafts.map(d => <tr key={d.key}><td><div className="file-name"><FileText size={17} /><strong>{d.file.name}</strong></div><small>{(d.file.size / 1024 ** 2).toFixed(2)}MiB · {d.state}</small>{d.error && <p role="alert" className="error-text">{d.error}</p>}{d.warning && <p className="warning-text">{d.warning}</p>}</td><td>{d.plan?.educationLevel === '유아' ? '유아' : d.plan?.grades.map(g => `${g}학년`).join(', ') || d.plan?.gradeBand || '확인 필요'}</td><td>{d.plan?.subject || '—'}</td><td>{d.plan?.unit || '—'}<small>{[d.plan?.lessonNumber, d.plan?.topic].filter(Boolean).join(' · ')}</small></td><td>{d.plan?.standards.join(', ') || '—'}</td><td><span className={`confidence ${d.confidence === '높음' ? 'high' : ''}`}>{d.confidence || (d.state === '분석 중' ? <LoaderCircle size={15} className="spinner" /> : '—')}</span></td><td><div className="row-actions">{d.plan && d.state === '완료' && <button disabled={busy} className="icon-button" aria-label={`${d.file.name} 분류 수정`} onClick={() => setEditing(editing === d.key ? '' : d.key)}><Pencil size={16} /></button>}<button disabled={busy} className="icon-button" aria-label={`${d.file.name} 제거`} onClick={() => { setDrafts(ds => reconcileDuplicates(ds.filter(x => x.key !== d.key), publishedPlans)); setPrivacy(false); setCopyright(false); setNotice(''); }}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div>
      {drafts.filter(d => d.key === editing && d.plan).map(d => <fieldset className="editor" key={d.key} disabled={busy} aria-label="분류 수정"><div className="section-heading"><h3>{d.file.name} · 분류 수정</h3><button className="text-link" onClick={() => setEditing('')}>접기 <ChevronDown size={16} /></button></div><p className="muted">모든 값은 수정할 수 있습니다. 학년군이 표시된 자료는 실제 수업 학년을 직접 선택하세요.</p><div className="editor-grid"><label className="wide">자료 제목<input maxLength={200} value={d.plan!.title} onChange={e => patchPlan(d.key, { title: e.target.value })} /></label><label>교육 단계<select value={d.plan!.educationLevel} onChange={e => patchPlan(d.key, { educationLevel: e.target.value as Plan['educationLevel'], grades: [], gradeBand: '' })}><option>초등</option><option>유아</option></select></label><label>자료 유형<select value={d.plan!.materialType} onChange={e => patchPlan(d.key, { materialType: e.target.value as Plan['materialType'] })}><option>지도안</option><option>수업 보조자료</option></select></label><fieldset className="wide" disabled={d.plan!.educationLevel === '유아'}><legend>실제 수업 학년</legend><div className="grade-checks">{[1, 2, 3, 4, 5, 6].map(g => <label key={g}><input type="checkbox" checked={d.plan!.grades.includes(g)} onChange={e => patchPlan(d.key, { grades: e.target.checked ? [...d.plan!.grades, g].sort() : d.plan!.grades.filter(n => n !== g) })} />{g}학년</label>)}</div></fieldset>
        <label>교과<select aria-label="교과" value={d.plan!.subject} onChange={e => patchPlan(d.key, { subject: e.target.value })}>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select></label>
        {(['gradeBand', 'unit', 'lessonNumber', 'topic', 'curriculum', 'teachingModel', 'duration', 'author', 'license', 'source'] as const).map((key, i) => <label key={key}>{['학년군 (참고)', '단원', '차시', '학습 주제', '교육과정 (확인된 경우만)', '교수학습모형', '수업 시간', '작성자 공개 정보 (선택)', '출처 및 이용 조건 (필수)', '출처'][i]}<input maxLength={500} value={d.plan![key]} placeholder={key === 'license' ? '예: 작성자 허락, 수업 활용 가능·재배포 금지' : ''} onChange={e => patchPlan(d.key, { [key]: e.target.value })} /></label>)}
        {(['objectives', 'standards', 'keywords'] as const).map((key, i) => <label className="wide" key={key}>{['학습 목표', '성취기준', '키워드'][i]} (한 줄에 하나)<textarea rows={3} value={d.plan![key].join('\n')} onChange={e => patchPlan(d.key, { [key]: e.target.value.split('\n') })} /></label>)}
        <label className="wide">본문 미리보기 · 주요 활동 (개인정보 확인)<textarea rows={7} maxLength={LIMITS.text} value={d.plan!.previewText} onChange={e => patchPlan(d.key, { previewText: e.target.value })} /></label>
      </div><details><summary>자동 분석 근거</summary><ul>{d.evidence?.map((s, i) => <li key={i}>{s}</li>)}</ul></details><button className="button primary" onClick={() => setEditing('')}>수정 내용 확인</button></fieldset>)}
      <div className="submission-panel"><div><Package size={26} /><h2>제출 전 확인해주세요</h2><p>공개 저장소의 파일은 누구나 접근할 수 있습니다. 원본과 미리보기를 함께 검토하세요.</p></div><label className="consent"><input type="checkbox" disabled={busy} checked={privacy} onChange={e => setPrivacy(e.target.checked)} />학생 이름, 연락처, 사진 등 개인정보가 원본과 미리보기에 없음을 확인했습니다.</label><label className="consent"><input type="checkbox" disabled={busy} checked={copyright} onChange={e => setCopyright(e.target.checked)} />저작권 및 배포 권한을 확인했으며, 각 자료의 이용 조건을 입력했습니다.</label><button className="button primary" disabled={busy || !privacy || !copyright || drafts.some(d => d.state !== '완료' || !d.plan?.license.trim())} onClick={exportZip}><Package size={18} />{busy ? '처리 중…' : '관리자 제출용 ZIP 다운로드'}</button><small>이용 조건이 비어 있으면 각 행의 연필 버튼에서 입력해주세요. 실패·중복 행은 제거해야 합니다.</small></div>
    </section>}
  </div>;
}
