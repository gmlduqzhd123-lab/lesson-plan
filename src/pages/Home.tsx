import SearchBox from '../components/SearchBox';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Check, FileText, ShieldCheck, Sparkles } from 'lucide-react';
import { SUBJECTS } from '../../shared/schema.mjs';
import { PlanCard, EmptyState, CatalogStatus } from '../components/Library';
import { getLessonDate } from '../lib/search';
import type { Plan } from '../types';

const GRADES: { grade: number | '유아'; label: string; numberLabel: string; deco: string; className: string }[] = [
  { grade: '유아', label: '유아', numberLabel: '00', deco: '☘', className: 'grade-0' },
  { grade: 1, label: '1학년', numberLabel: '01', deco: '◒', className: 'grade-1' },
  { grade: 2, label: '2학년', numberLabel: '02', deco: '✿', className: 'grade-2' },
  { grade: 3, label: '3학년', numberLabel: '03', deco: '◆', className: 'grade-3' },
  { grade: 4, label: '4학년', numberLabel: '04', deco: '✦', className: 'grade-4' },
  { grade: 5, label: '5학년', numberLabel: '05', deco: '◈', className: 'grade-5' },
  { grade: 6, label: '6학년', numberLabel: '06', deco: '◉', className: 'grade-6' },
];

type Props = { plans: Plan[]; loading: boolean; error: string; retry: () => void };
export default function Home(props: Props) {
  const navigate = useNavigate();

  return <>
    <section className="hero"><div className="container hero-inner"><div className="hero-copy">
      <span className="eyebrow"><span className="tiny-dot" /> 선생님을 위한 수업 자료 공간</span>
      <h1>선생님의 수업 준비를<br /><span>더 가볍게</span></h1>
      <p>학년과 교과, 단원만 선택하세요.<br />필요한 교수학습과정안을 한눈에 찾아보세요.</p>
      <SearchBox plans={props.plans} onSearch={query => navigate(`/library?q=${encodeURIComponent(query)}`)} label="지도안 통합 검색" placeholder="어떤 수업을 준비하고 계세요?" className="hero-search" />
      <div className="search-hints"><span>이렇게 찾아보세요</span>{['5학년 체육', '분수', '놀이중심', '토의·토론', '성취기준'].map(s => <button key={s} onClick={() => navigate(`/library?q=${encodeURIComponent(s)}`)}>{s}</button>)}</div>
    </div>
    <div className="hero-art" aria-hidden="true"><div className="art-orbit" /><span className="art-spark spark-one">✦</span><span className="art-spark spark-two">✦</span><div className="floating-label"><ShieldCheck size={18} /> 안전하게 나누는 수업</div><div className="notebook"><div className="binding">{Array.from({ length: 6 }, (_, i) => <i key={i} />)}</div><span className="notebook-label">LESSON NOTE</span><div className="book-symbol"><BookOpen size={39} strokeWidth={1.6} /></div><strong>함께 만드는<br />좋은 수업</strong><div className="notebook-line" /><div className="notebook-line short" /><span className="notebook-dot" /></div><div className="small-note"><Check size={17} /><span>수업 준비 완료!</span><div /><div /></div><div className="mint-dot" /></div>
    </div></section>
    <div className="container">
      <div className="stats-strip"><div><span className="stat-icon"><BookOpen size={21} /></span><span>공개 지도안 <strong>{props.loading || props.error ? '—' : props.plans.length}<small>개</small></strong></span></div><p className="stats-trust" style={{ display: 'none' }}><ShieldCheck size={15} /> 개인정보 비식별 100% 검토 완료</p><Link to="/upload">지도안 제출 (준비 중) <ArrowRight size={17} /></Link></div>
      <section className="section"><div className="section-heading"><div><span className="overline">FIND YOUR CLASS</span><h2>우리 반 수업, 여기서 시작해요</h2><p>학년을 선택하고 필요한 자료를 찾아보세요.</p></div><Link className="text-link" to="/library">전체 자료실 <ArrowRight size={16} /></Link></div>
        <div className="grade-grid">{GRADES.map(g => <Link key={g.grade} className={`grade-card ${g.className}`} to={`/library?grade=${encodeURIComponent(g.grade)}`}><span className="grade-number">{g.numberLabel}</span><span className="grade-decoration">{g.deco}</span><strong>{g.label}</strong><span>지도안 찾아보기 <ArrowRight size={14} /></span></Link>)}</div>
        <div className="subject-row"><strong>교과로 찾기</strong><div>{SUBJECTS.map(s => <Link key={s} to={`/library?subject=${encodeURIComponent(s)}`}>{s}</Link>)}</div></div>
      </section>
      <section className="section latest"><div className="section-heading"><div><span className="overline">LESSON PLAN LIBRARY</span><h2>새로 만나는 수업 아이디어</h2><p>선생님들이 나눈 최신 교수학습과정안을 확인하세요.</p></div><Link className="text-link" to="/library">더 보기 <ArrowRight size={16} /></Link></div>
        <CatalogStatus {...props} />{!props.loading && !props.error && (props.plans.length ? <div className="card-grid">{[...props.plans].sort((a, b) => getLessonDate(b).localeCompare(getLessonDate(a)) || b.publishedAt.localeCompare(a.publishedAt)).slice(0, 6).map(p => <PlanCard key={p.id} plan={p} />)}</div> : <EmptyState />)}
      </section>
      <section className="share-banner"><span className="share-symbol"><FileText size={32} /><Sparkles size={20} /></span><div><span className="overline">BETTER TOGETHER</span><h2>선생님의 좋은 수업을 나눠주세요</h2><p>지도안 분석 및 제출 기능은 준비 중입니다.</p></div><Link className="button primary" to="/upload">지도안 분석·제출 <ArrowRight size={17} /></Link></section>
    </div>
  </>;
}
