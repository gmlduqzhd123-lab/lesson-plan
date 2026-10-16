import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Check, Compass, Copy, Download, FileText, Share2, ShieldCheck, Sparkles, Wand2 } from 'lucide-react';
import { CatalogStatus, PlanCard, gradeLabel } from '../components/Library';
import { useAccessGate } from '../components/AccessGate';
import type { Plan } from '../types';
import { saveBlob } from '../lib/download';
import { getLessonDate } from '../lib/search';
import { buildAiPrompt, buildLessonSections, getRecommendedYsTools, type AiPromptOptions } from '../lib/lesson-insights';

const FOCUS_MODES: AiPromptOptions['focusMode'][] = [
  '기본 맞춤형',
  '에듀테크·디지털 활용',
  '배움중심·협력학습',
  '수준별·기초학력 지원',
];

export default function Detail(props: { plans: Plan[]; loading: boolean; error: string; retry: () => void }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { requireAccess } = useAccessGate();
  const p = props.plans.find(p => p.id === id);
  const [fileState, setFileState] = useState<'checking' | 'ready' | 'missing'>('checking');
  const [downloadError, setDownloadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [studentCount, setStudentCount] = useState(24);
  const [groupSize, setGroupSize] = useState(4);
  const [durationMinutes, setDurationMinutes] = useState(40);
  const [focusMode, setFocusMode] = useState<AiPromptOptions['focusMode']>('에듀테크·디지털 활용');
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  useEffect(() => {
    const controller = new AbortController(); setFileState('checking'); setDownloadError('');
    if (p) fetch(`${import.meta.env.BASE_URL}${p.filePath}`, { method: 'HEAD', signal: controller.signal }).then(r => { if (!controller.signal.aborted) setFileState(r.ok ? 'ready' : 'missing'); }).catch(() => { if (!controller.signal.aborted) setFileState('missing'); });
    return () => controller.abort();
  }, [p]);

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/library');
    }
  };

  const copyWithFeedback = (key: string, text: string) => {
    requireAccess(async () => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(prev => (prev === key ? '' : prev)), 2000);
      } catch {
        /* ignore */
      }
    });
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const runDownload = async () => {
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

  const download = () => {
    requireAccess(() => { void runDownload(); });
  };

  const lessonFlow = useMemo(() => (p ? buildLessonSections(p) : null), [p]);
  const aiPrompt = useMemo(
    () => (p ? buildAiPrompt(p, { studentCount, groupSize, durationMinutes, focusMode }) : ''),
    [p, studentCount, groupSize, durationMinutes, focusMode],
  );
  const ysTools = useMemo(() => (p ? getRecommendedYsTools(p) : []), [p]);

  if (props.loading || props.error) return <div className="container page"><CatalogStatus {...props} /></div>;
  if (!p || !lessonFlow) return <div className="container page empty-state"><FileText size={35} /><h1>자료를 찾을 수 없어요</h1><p>주소가 잘못되었거나 공개 목록에서 제외된 자료입니다.</p><Link className="button primary" to="/library">자료실로 이동</Link></div>;

  const standards = p.standards || [];
  const objectives = p.objectives || [];
  const classificationNotes = p.classificationNotes || [];
  const standardCounts = new Map<string, number>();
  for (const code of standards) {
    standardCounts.set(code, props.plans.filter(item => (item.standards || []).includes(code)).length);
  }

  const related = props.plans
    .filter(other => other.id !== p.id && other.subject === p.subject && (p.educationLevel === '유아' ? other.educationLevel === '유아' : (!p.grades.length || other.grades.some(g => p.grades.includes(g)))))
    .sort((a, b) => {
      const score = (item: Plan) =>
        ((item.standards || []).some(s => standards.includes(s)) ? 4 : 0) +
        (item.normalizedUnit && item.normalizedUnit === p.normalizedUnit ? 2 : 0) +
        (item.teachingModel && item.teachingModel === p.teachingModel ? 1 : 0);
      return score(b) - score(a);
    })
    .slice(0, 3);

  return <div className="container page"><button type="button" className="text-link back-link" onClick={handleBack}><ArrowLeft size={17} /> 자료실로 돌아가기</button><div className="detail-layout"><article className="detail-main"><div className="detail-header"><div className="tag-row"><span className="tag blue">{gradeLabel(p)}</span><span className="tag mint">{p.subject}</span>{p.teachingModel && <span className="tag purple">{p.teachingModel}</span>}<span className="tag trust"><ShieldCheck size={12} /> 안심 검토 완료</span><span className="tag">{p.fileFormat}</span></div><h1>{p.title}</h1><p>{p.unit || '단원 미분류'}{p.lessonNumber && ` · ${p.lessonNumber}`}</p></div>
    <dl className="metadata">
      <div><dt>학습 주제</dt><dd>{p.topic || '제공되지 않음'}</dd></div>
      <div><dt>학습 목표</dt><dd>{objectives.length ? objectives.join('\n') : '제공되지 않음'}</dd></div>
      <div>
        <dt>성취기준</dt>
        <dd>
          {standards.length ? (
            <div className="detail-standard-badges">
              {standards.map(code => (
                <Link key={code} to={`/library?standard=${encodeURIComponent(code)}`} className="detail-standard-chip" title={`${code} 성취기준을 다루는 다른 지도안 비교하기`}>
                  <Compass size={13} />
                  <strong>{code}</strong>
                  <span>동일 성취기준 {standardCounts.get(code) || 1}개 비교 →</span>
                </Link>
              ))}
            </div>
          ) : '제공되지 않음'}
        </dd>
      </div>
      <div><dt>교육과정</dt><dd>{p.curriculum || '제공되지 않음'}</dd></div>
      <div><dt>교수학습모형</dt><dd>{p.teachingModel || '제공되지 않음'}</dd></div>
      <div><dt>수업 시간</dt><dd>{p.duration || '제공되지 않음'}</dd></div>
    </dl>
    {classificationNotes.length > 0 && <section className="guide-panel"><h2>분류 확인 메모</h2><ul>{classificationNotes.map(note => <li key={note}>{note}</li>)}</ul></section>}


    <section className="preview structured-flow-section" aria-label="도입 전개 정리 수업 흐름">
      <div className="preview-header">
        <div>
          <h2>도입 · 전개 · 정리 수업 흐름 뷰어</h2>
          <p className="muted">{lessonFlow.isSynthesized ? '단원·학습주제·성취기준에 맞춰 재구성한 표준 수업 단계입니다. 원하는 단계만 바로 복사해 활용하세요.' : '문서 본문에서 추출한 단계별 수업 흐름입니다. 필요한 영역만 원클릭으로 복사하세요.'}</p>
        </div>
        <div className="preview-actions">
          {p.previewText && <button type="button" className={`preview-copy-btn ${copiedKey === 'raw' ? 'copied' : ''}`} onClick={() => copyWithFeedback('raw', p.previewText)} aria-label="본문 텍스트 복사">{copiedKey === 'raw' ? <><Check size={14} /> 본문 복사 완료</> : <><Copy size={14} /> 본문 복사</>}</button>}
          <button type="button" className={`preview-copy-btn primary-copy ${copiedKey === 'full-flow' ? 'copied' : ''}`} onClick={() => copyWithFeedback('full-flow', lessonFlow.fullFlowText)}>
            {copiedKey === 'full-flow' ? <><Check size={14} /> 전체 흐름 복사 완료</> : <><Copy size={14} /> 전체 수업 흐름 복사</>}
          </button>
        </div>
      </div>

      <div className="stage-cards">
        {lessonFlow.stages.map(stage => {
          const isStageCopied = copiedKey === `stage-${stage.id}`;
          return (
            <div key={stage.id} className={`stage-card stage-${stage.id}`}>
              <div className="stage-card-head">
                <div className="stage-title-group">
                  <span className={`stage-badge badge-${stage.id}`}>{stage.badge}</span>
                  <strong>{stage.title}</strong>
                  <small>{stage.duration}</small>
                </div>
                <button
                  type="button"
                  className={`stage-copy-btn ${isStageCopied ? 'copied' : ''}`}
                  onClick={() => copyWithFeedback(`stage-${stage.id}`, stage.copyText)}
                >
                  {isStageCopied ? <><Check size={13} /> {stage.badge} 복사됨</> : <><Copy size={13} /> {stage.badge} 복사</>}
                </button>
              </div>
              <ul className="stage-lines">
                {stage.lines.map((line, idx) => <li key={idx}>{line}</li>)}
              </ul>
            </div>
          );
        })}
      </div>

      {p.previewText && <pre>{p.previewText}</pre>}
    </section>

    <section className="preview ai-prompt-section" aria-label="AI 수업 재구성 프롬프트 생성기">
      <div className="preview-header">
        <div>
          <span className="ai-badge"><Sparkles size={13} /> AI 수업 설계 도우미</span>
          <h2>내 학급 맞춤형 AI 재구성 프롬프트</h2>
          <p className="muted">우리 반 인원과 수업 조건에 맞게 ChatGPT · Claude · Gemini용 세안 작성 프롬프트를 1초 만에 생성합니다.</p>
        </div>
        <button
          type="button"
          className={`button primary ai-copy-btn ${copiedKey === 'ai-prompt' ? 'copied' : ''}`}
          onClick={() => copyWithFeedback('ai-prompt', aiPrompt)}
        >
          {copiedKey === 'ai-prompt' ? <><Check size={16} /> AI 프롬프트 복사 완료!</> : <><Wand2 size={16} /> AI 재구성 프롬프트 복사</>}
        </button>
      </div>

      <div className="ai-options-grid">
        <label>
          학급 인원 (명)
          <input type="number" min={1} max={40} value={studentCount} onChange={e => setStudentCount(Math.max(1, Number(e.target.value) || 24))} />
        </label>
        <label>
          모둠당 인원 (명)
          <input type="number" min={1} max={10} value={groupSize} onChange={e => setGroupSize(Math.max(1, Number(e.target.value) || 4))} />
        </label>
        <label>
          수업 시간 (분)
          <select value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))}>
            <option value={35}>35분 (유아·저학년)</option>
            <option value={40}>40분 (초등 기본 1차시)</option>
            <option value={80}>80분 (블록타임 2차시)</option>
          </select>
        </label>
        <label>
          재구성 중점 방향
          <select value={focusMode} onChange={e => setFocusMode(e.target.value as AiPromptOptions['focusMode'])}>
            {FOCUS_MODES.map(mode => <option key={mode} value={mode}>{mode}</option>)}
          </select>
        </label>
      </div>

      <div className="ai-prompt-footer">
        <button type="button" className="text-link" onClick={() => setShowPromptPreview(v => !v)}>
          {showPromptPreview ? '생성된 프롬프트 미리보기 접기' : '생성된 프롬프트 전문 미리보기'}
        </button>
        {showPromptPreview && <pre className="ai-prompt-box">{aiPrompt}</pre>}
      </div>
    </section>

    <section className="preview ysschool-tools-section" aria-label="이 수업에 바로 쓸 수 있는 엽쌤 에듀테크 도구">
      <div className="preview-header">
        <div>
          <span className="ys-eco-badge">엽쌤스쿨 생태계 연동</span>
          <h2>이 수업에 바로 쓸 수 있는 엽쌤 에듀테크 도구</h2>
          <p className="muted">{gradeLabel(p)} {p.subject} 수업의 동기유발·모둠활동·정리 단계에 즉시 투입할 수 있는 웹앱과 100종 배움게임입니다.</p>
        </div>
        <a href="https://ysschool.vercel.app/showcase" target="_blank" rel="noopener noreferrer" className="text-link">
          엽쌤스쿨 전체 도구 보기 <ArrowUpRight size={15} />
        </a>
      </div>
      <div className="ys-tools-grid">
        {ysTools.map(tool => (
          <a key={tool.id} href={tool.url} target="_blank" rel="noopener noreferrer" className="ys-tool-card">
            <div className="ys-tool-top">
              <span className="ys-tool-emoji" aria-hidden="true">{tool.emoji}</span>
              <span className="ys-tool-badge">{tool.badge}</span>
              <ArrowUpRight size={15} className="ys-tool-arrow" />
            </div>
            <strong>{tool.name}</strong>
            <p>{tool.desc}</p>
            <div className="ys-tool-tip">💡 {tool.tip}</div>
          </a>
        ))}
      </div>
    </section>
  </article><aside className="download-panel"><div className="download-file"><FileText size={30} /><strong>수업 자료 파일</strong><span>{p.fileFormat} · {(p.fileSize / 1024 ** 2).toFixed(2)}MiB · {p.materialType}</span></div><button className="button primary" disabled={busy || fileState !== 'ready'} onClick={download}><Download size={18} />{busy ? '원본 확인 중…' : fileState === 'checking' ? '파일 확인 중…' : '원본 다운로드'}</button><button type="button" className={`share-link-btn ${linkCopied ? 'copied' : ''}`} onClick={copyShareLink}>{linkCopied ? <><Check size={15} /> 지도안 링크 복사됨!</> : <><Share2 size={15} /> 지도안 링크 공유</>}</button>{fileState === 'missing' && <p role="alert" className="error-text">파일이 없거나 접근할 수 없어 다운로드할 수 없습니다.</p>}{downloadError && <p role="alert" className="error-text">{downloadError}</p>}
    <div className="trust-box"><div className="trust-head"><ShieldCheck size={17} /><strong>선생님 안심 이용 보증</strong></div><ul><li><span>✓</span> 학생 얼굴·실명 등 개인정보 비식별 완료</li><li><span>✓</span> 출처 기관의 수업 활용 및 재배포 허락 확인</li><li><span>✓</span> 원본 파일 변조 방지 SHA-256 검증</li></ul></div>
    <dl><dt>원본 파일명</dt><dd>{p.originalFileName}</dd><dt>수업 실시·원 등록일</dt><dd>{getLessonDate(p) && getLessonDate(p) !== '2020-01-01' ? getLessonDate(p).replace(/-/g, '. ') : new Date(p.publishedAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</dd><dt>자료실 게시일</dt><dd>{new Date(p.publishedAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</dd><dt>작성자 공개 정보</dt><dd>{p.author || '비공개'}</dd><dt>출처</dt><dd>{/^https:\/\//.test(p.source) ? <a href={p.source} target="_blank" rel="noopener noreferrer">원본 게시글 보기</a> : p.source || '제공되지 않음'}</dd><dt>이용 조건</dt><dd>{p.license}</dd></dl><p className="download-note"><ShieldCheck size={16} /> 명시된 이용 조건을 확인하고 활용해주세요.</p>
  </aside></div>{related.length > 0 && <section className="section"><div className="section-heading"><h2>함께 살펴볼 지도안</h2></div><div className="card-grid">{related.map(p => <PlanCard key={p.id} plan={p} />)}</div></section>}</div>;
}

