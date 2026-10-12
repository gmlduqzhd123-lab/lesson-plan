import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, BookOpen, Check, Eye, EyeOff, KeyRound, LockKeyhole } from 'lucide-react';
import type { useCatalog } from '../hooks/useCatalog';
import { hasAccessSession, saveAccessSession, verifyAccessPassword } from '../lib/access';
import '../access-gate.css';

const notices = [
  { title: '재배포 금지', paragraphs: ['이 자료실에서 제공하는 지도안은 재배포할 수 없습니다. 원본 파일뿐 아니라 수정·편집한 자료도 다른 사람에게 전달하거나 공유하지 마세요.', '웹사이트, 카페, 블로그, SNS, 공유 드라이브 등에 다시 게시하거나 업로드하는 행위도 금지합니다.'] },
  { title: '상업적 이용 금지', paragraphs: ['지도안을 판매하거나 유료 자료집, 유료 강의, 유료 서비스 등 상업적인 수단으로 이용할 수 없습니다.', '자료를 수정·편집하거나 일부만 발췌하더라도, 수익을 얻기 위한 목적으로 활용하는 것은 금지합니다.'] },
  { title: '수업 및 지도안 작성 참고용으로만 사용', paragraphs: ['자료는 오로지 수업 목적 및 공개 수업 지도안 작성 시 참고 자료로만 사용해야 합니다.', '선생님의 학급과 학생, 교육과정에 맞게 수업을 준비하는 데 참고해주세요. 참고용으로 제공된 지도안을 자신의 결과물인 것처럼 그대로 제출하거나 발표하지 마세요.'] },
];

export default function AccessGate({ catalog, children }: { catalog: ReturnType<typeof useCatalog>; children: ReactNode }) {
  const [admitted, setAdmitted] = useState(hasAccessSession);
  const [tab, setTab] = useState<'entry' | 'notice'>('entry');
  const [readEnd, setReadEnd] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reader = useRef<HTMLDivElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const checkEnd = () => {
    const el = reader.current;
    if (el && el.clientHeight > 0 && el.scrollHeight - el.scrollTop - el.clientHeight <= 4) setReadEnd(true);
  };
  useEffect(() => {
    if (tab !== 'notice') return;
    checkEnd();
    const el = reader.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(checkEnd);
    observer.observe(el);
    return () => observer.disconnect();
  }, [tab]);
  useEffect(() => { if (confirmed && tab === 'entry') passwordInput.current?.focus(); }, [confirmed, tab]);

  async function enter(event: FormEvent) {
    event.preventDefault();
    if (!confirmed || !password || busy) return;
    setBusy(true); setError('');
    try {
      if (await verifyAccessPassword(password)) {
        saveAccessSession(); setPassword(''); setAdmitted(true);
      } else { setError('비밀번호가 맞지 않습니다. 다시 확인해주세요.'); passwordInput.current?.focus(); }
    } catch { setError('비밀번호 확인을 완료하지 못했습니다. 브라우저를 확인하고 다시 시도해주세요.'); }
    finally { setBusy(false); }
  }

  if (admitted) return children;
  return <main className="access-page"><div className="access-card">
    <section className="access-intro" aria-label="지도안 대백과 소개">
      <div className="access-brand"><span><BookOpen size={24} /></span><div><strong>지도안 대백과</strong><small>LESSON PLAN ENCYCLOPEDIA</small></div></div>
      <div className="access-invitation"><span className="access-eyebrow">선생님을 위한 작은 서재</span><h1>선생님의 수업에<br /><em>새로운 영감을</em></h1><p>차곡차곡 모은 지도안으로<br />내일의 수업을 준비해보세요.</p></div>
      <div className="access-count"><span>현재 공개된 지도안</span>
        {catalog.loading ? <strong role="status" className="access-count-state">불러오는 중</strong> : catalog.error ? <div role="alert"><p>자료 수를 불러오지 못했어요.</p><button onClick={catalog.retry}>다시 불러오기</button></div> : <strong>{catalog.plans.length.toLocaleString('ko-KR')}<small>개</small></strong>}
        <p>학년·교과·단원별로 찾아보세요.</p>
      </div><p className="access-signature">엽쌤과 함께 만드는 수업 자료실</p>
    </section>
    <section className="access-content" aria-label="자료실 입장">
      <div className="access-tabs" role="tablist" aria-label="입장 안내" onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 'entry' : event.key === 'End' ? 'notice' : tab === 'entry' ? 'notice' : 'entry';
        setTab(next); document.getElementById(`access-tab-${next}`)?.focus();
      }}>
        <button id="access-tab-entry" role="tab" aria-selected={tab === 'entry'} aria-controls="access-entry" tabIndex={tab === 'entry' ? 0 : -1} onClick={() => setTab('entry')}>자료실 입장</button>
        <button id="access-tab-notice" role="tab" aria-selected={tab === 'notice'} aria-controls="access-notice" tabIndex={tab === 'notice' ? 0 : -1} onClick={() => setTab('notice')}>유의 사항 <small>{confirmed ? '확인' : '필수'}</small></button>
      </div>
      <div id="access-entry" role="tabpanel" aria-labelledby="access-tab-entry" hidden={tab !== 'entry'}>
        <span className="access-key"><KeyRound size={25} /></span><h2>자료실에 오신 것을<br />환영합니다</h2><p className="access-description">입장 전, 자료 이용 약속을 먼저 확인해주세요.</p>
        <div className={`access-read-status ${confirmed ? 'is-confirmed' : ''}`} role="status">{confirmed ? <Check size={18} /> : <LockKeyhole size={18} />}<span>{confirmed ? '유의 사항을 확인했어요. 비밀번호를 입력해주세요.' : <>‘유의 사항’ 탭을 눌러 끝까지 읽으면<br />비밀번호를 입력할 수 있어요.</>}</span></div>
        <form onSubmit={enter}>
          <label className="access-password-label" htmlFor="access-password">비밀번호</label>
          <div className="access-password"><input ref={passwordInput} id="access-password" type={visible ? 'text' : 'password'} autoComplete="off" disabled={!confirmed || busy} value={password} onChange={event => { setPassword(event.target.value); setError(''); }} placeholder={confirmed ? '비밀번호를 입력해주세요' : '유의 사항 확인 후 입력 가능'} aria-describedby="access-help access-error" /><button type="button" disabled={!confirmed || busy} aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'} aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>
          <p id="access-help" className="access-help">비밀번호는 엽쌤에게 직접 문의해주세요</p><p id="access-error" className="access-error" role="alert">{error}</p>
          <button className="access-primary" disabled={!confirmed || !password || busy} type="submit">{busy ? '확인 중…' : '자료실 입장하기'}<ArrowRight size={18} /></button>
        </form>
      </div>
      <div id="access-notice" role="tabpanel" aria-labelledby="access-tab-notice" hidden={tab !== 'notice'}>
        <h2 className="access-notice-heading">유의 사항</h2><p className="access-description">아래 내용을 끝까지 읽고 이용 약속에 동의해주세요.</p>
        <div ref={reader} className="access-reader" tabIndex={0} role="region" aria-label="유의 사항 전문" onScroll={checkEnd}>
          {notices.map((notice, index) => <section key={notice.title}><small>0{index + 1}</small><h3>{notice.title}</h3>{notice.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</section>)}
          <div className="access-notice-end"><Check size={19} /><strong>유의 사항을 모두 확인했습니다.</strong><p>위 내용을 지키는 것에 동의한 후 입장해주세요.</p></div>
        </div>
        <p className="access-scroll-status" role="status">{readEnd ? '끝까지 확인했어요. 아래 이용 약속에 동의해주세요.' : '내용을 아래로 스크롤해 끝까지 확인해주세요.'}</p>
        <label className="access-agreement"><input type="checkbox" disabled={!readEnd} checked={agreed} onChange={event => { setAgreed(event.target.checked); if (!event.target.checked) { setConfirmed(false); setPassword(''); setError(''); } }} /><span>유의 사항을 모두 읽었으며, 내용을 준수하겠습니다.</span></label>
        <button className="access-primary" disabled={!readEnd || !agreed} onClick={() => { if (!readEnd || !agreed) return; setConfirmed(true); setTab('entry'); }}>확인하고 비밀번호 입력하기<ArrowRight size={18} /></button>
      </div>
    </section>
  </div></main>;
}
