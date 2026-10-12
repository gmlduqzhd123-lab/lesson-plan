import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, FileText, ShieldCheck } from 'lucide-react';
import { CatalogStatus, PlanCard, gradeLabel } from '../components/Library';
import type { Plan } from '../types';
import { saveBlob } from '../lib/download';

export default function Detail(props: { plans: Plan[]; loading: boolean; error: string; retry: () => void }) {
  const { id } = useParams();
  const p = props.plans.find(p => p.id === id);
  const [fileState, setFileState] = useState<'checking' | 'ready' | 'missing'>('checking');
  const [downloadError, setDownloadError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setFileState('checking'); setDownloadError('');
    if (p) fetch(`${import.meta.env.BASE_URL}${p.filePath}`, { method: 'HEAD', signal: controller.signal }).then(r => { if (!controller.signal.aborted) setFileState(r.ok ? 'ready' : 'missing'); }).catch(() => { if (!controller.signal.aborted) setFileState('missing'); });
    return () => controller.abort();
  }, [p]);
  const download = async () => {
    if (!p) return;
    setBusy(true); setDownloadError('');
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}${p.filePath}`);
      if (!response.ok) throw new Error('원본 파일이 없거나 가져오지 못했습니다.');
      const blob = await response.blob();
      if (blob.size !== p.fileSize) throw new Error('원본 파일 크기가 목록과 다릅니다.');
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))).map(b => b.toString(16).padStart(2, '0')).join('');
      if (digest !== p.sha256) throw new Error('원본 파일 무결성 검사에 실패했습니다.');
      saveBlob(blob, p.originalFileName);
    } catch (e) { setDownloadError(e instanceof Error ? e.message : '다운로드 실패'); setFileState('missing'); }
    finally { setBusy(false); }
  };
  if (props.loading || props.error) return <div className="container page"><CatalogStatus {...props} /></div>;
  if (!p) return <div className="container page empty-state"><FileText size={35} /><h1>자료를 찾을 수 없어요</h1><p>주소가 잘못되었거나 공개 목록에서 제외된 자료입니다.</p><Link className="button primary" to="/library">자료실로 이동</Link></div>;
  const related = props.plans.filter(other => other.id !== p.id && other.subject === p.subject && (p.educationLevel === '유아' ? other.educationLevel === '유아' : (!p.grades.length || other.grades.some(g => p.grades.includes(g))))).slice(0, 3);
  return <div className="container page"><Link className="text-link back-link" to="/library"><ArrowLeft size={17} /> 자료실로 돌아가기</Link><div className="detail-layout"><article className="detail-main"><div className="detail-header"><div className="tag-row"><span className="tag blue">{gradeLabel(p)}</span><span className="tag mint">{p.subject}</span>{p.teachingModel && <span className="tag purple">{p.teachingModel}</span>}<span className="tag trust"><ShieldCheck size={12} /> 안심 검토 완료</span><span className="tag">{p.fileFormat}</span></div><h1>{p.title}</h1><p>{p.unit || '단원 미분류'}{p.lessonNumber && ` · ${p.lessonNumber}`}</p></div>
    <dl className="metadata">{[['학습 주제', p.topic], ['학습 목표', p.objectives.join('\n')], ['성취기준', p.standards.join('\n')], ['교육과정', p.curriculum], ['교수학습모형', p.teachingModel], ['수업 시간', p.duration]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || '제공되지 않음'}</dd></div>)}</dl>
    {p.classificationNotes.length > 0 && <section className="guide-panel"><h2>분류 확인 메모</h2><ul>{p.classificationNotes.map(note => <li key={note}>{note}</li>)}</ul></section>}
    <section className="preview"><h2>본문 미리보기 · 주요 활동</h2><p className="muted">문서에서 추출한 텍스트입니다. 원본의 표와 페이지 배치는 재현하지 않습니다.</p>{p.previewText ? <pre>{p.previewText}</pre> : <div className="preview-empty">이 자료에는 텍스트 미리보기가 없습니다. 원본 파일을 다운로드해주세요.</div>}</section>
  </article><aside className="download-panel"><div className="download-file"><FileText size={30} /><strong>수업 자료 파일</strong><span>{p.fileFormat} · {(p.fileSize / 1024 ** 2).toFixed(2)}MiB · {p.materialType}</span></div><button className="button primary" disabled={busy || fileState !== 'ready'} onClick={download}><Download size={18} />{busy ? '원본 확인 중…' : fileState === 'checking' ? '파일 확인 중…' : '원본 다운로드'}</button>{fileState === 'missing' && <p role="alert" className="error-text">파일이 없거나 접근할 수 없어 다운로드할 수 없습니다.</p>}{downloadError && <p role="alert" className="error-text">{downloadError}</p>}
    <div className="trust-box"><div className="trust-head"><ShieldCheck size={17} /><strong>선생님 안심 이용 보증</strong></div><ul><li><span>✓</span> 학생 얼굴·실명 등 개인정보 비식별 완료</li><li><span>✓</span> 출처 기관의 수업 활용 및 재배포 허락 확인</li><li><span>✓</span> 원본 파일 변조 방지 SHA-256 검증</li></ul></div>
    <dl><dt>원본 파일명</dt><dd>{p.originalFileName}</dd><dt>등록일</dt><dd>{new Date(p.publishedAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</dd><dt>작성자 공개 정보</dt><dd>{p.author || '비공개'}</dd><dt>출처</dt><dd>{/^https:\/\//.test(p.source) ? <a href={p.source} target="_blank" rel="noopener noreferrer">원본 게시글 보기</a> : p.source || '제공되지 않음'}</dd><dt>이용 조건</dt><dd>{p.license}</dd></dl><p className="download-note"><ShieldCheck size={16} /> 명시된 이용 조건을 확인하고 활용해주세요.</p>
  </aside></div>{related.length > 0 && <section className="section"><div className="section-heading"><h2>함께 살펴볼 지도안</h2></div><div className="card-grid">{related.map(p => <PlanCard key={p.id} plan={p} />)}</div></section>}</div>;
}
