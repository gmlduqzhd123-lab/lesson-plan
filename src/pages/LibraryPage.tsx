import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowUp, Compass, SlidersHorizontal, X } from 'lucide-react';
import { SUBJECTS, TEACHING_MODELS } from '../../shared/schema.mjs';
import { searchPlans, matchesGrade, canonicalizeQuery, relaxedSearches, extractStandardStats } from '../lib/search';
import { CatalogStatus, EmptyState, PlanCard } from '../components/Library';
import BatchDownload from '../components/BatchDownload';
import SearchBox from '../components/SearchBox';
import type { Plan } from '../types';

export default function LibraryPage(props: { plans: Plan[]; loading: boolean; error: string; retry: () => void }) {
  const [params, setParams] = useSearchParams();
  const urlQuery = params.get('q') || '';
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [stdExpanded, setStdExpanded] = useState(false);
  const [stdSearch, setStdSearch] = useState('');
  const filterKey = params.toString();
  const [display, setDisplay] = useState({ key: filterKey, count: 60 });
  const [showTopBtn, setShowTopBtn] = useState(false);
  const [selected, setSelected] = useState<Plan[]>([]);
  const [downloading, setDownloading] = useState(false);
  const selectedIds = new Set(selected.map(p => p.id));
  const toggleSelection = (p: Plan) => { if (!downloading) setSelected(previous => previous.some(item => item.id === p.id) ? previous.filter(item => item.id !== p.id) : [...previous, p]); };

  useEffect(() => {
    const onScroll = () => setShowTopBtn(window.scrollY > 350);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  if (display.key !== filterKey) setDisplay({ key: filterKey, count: 60 });
  const visibleCount = display.key === filterKey ? display.count : 60;
  const f = { query: params.get('q') || '', grade: params.get('grade') || '', subject: params.get('subject') || '', unit: params.get('unit') || '', sort: params.get('sort') || 'latest', materialType: params.get('materialType') || '', teachingModel: params.get('teachingModel') || '', standard: params.get('standard') || '' };
  const change = (key: string, value: string) => { if (key === 'q' && value === urlQuery) return; const next = new URLSearchParams(params); value ? next.set(key, value) : next.delete(key); if (key === 'grade' || key === 'subject') { next.delete('unit'); next.delete('standard'); } setParams(next, { replace: true }); };
  const result = searchPlans(props.plans, f);
  const suggestionPlans = useMemo(() => searchPlans(props.plans, { query: '', grade: params.get('grade') || '', subject: params.get('subject') || '', unit: params.get('unit') || '', sort: 'latest', teachingModel: params.get('teachingModel') || '', materialType: params.get('materialType') || '', standard: params.get('standard') || '' }), [props.plans, params.get('grade'), params.get('subject'), params.get('unit'), params.get('teachingModel'), params.get('materialType'), params.get('standard')]);
  const standardStats = useMemo(() => extractStandardStats(props.plans, { grade: f.grade, subject: f.subject, filterText: stdSearch }), [props.plans, f.grade, f.subject, stdSearch]);
  const filterCount = [f.grade, f.subject, f.unit, f.teachingModel, f.materialType, f.standard].filter(Boolean).length;
  const recovery = !props.loading && !props.error && !result.length ? relaxedSearches(props.plans, f) : [];
  const units = [...new Set(props.plans.filter(p => matchesGrade(p, f.grade) && (!f.subject || p.subject === f.subject)).map(p => p.unit).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
  const shownStandards = stdExpanded ? standardStats.slice(0, 48) : standardStats.slice(0, 10);
  return <div className={`container page library-page${selected.length ? ' has-selected' : ''}`}><div className="page-heading"><span className="overline">LIBRARY</span><h1>우리 수업에 딱 맞는 지도안</h1><p>학년부터 성취기준까지, 필요한 수업 자료를 찾아보세요.</p></div>
    <button className="mobile-filter-toggle button secondary" aria-expanded={filtersOpen} aria-controls="library-filters" onClick={() => setFiltersOpen(open => !open)}><SlidersHorizontal size={17} />{filtersOpen ? '필터 접기' : '필터 열기'}{filterCount > 0 && ` (${filterCount})`}</button>
    <div className="library-layout"><aside id="library-filters" className={`filters${filtersOpen ? ' is-expanded' : ''}`}><h2><SlidersHorizontal size={18} /> 상세 필터 <button aria-label="필터 초기화" onClick={() => { setStdSearch(''); setParams({}); }}>초기화</button></h2>
      <label>학년<select aria-label="학년" value={f.grade} onChange={e => change('grade', e.target.value)}><option value="">전체 학년</option><option value="유아">유아</option>{[1, 2, 3, 4, 5, 6].map(g => <option key={g} value={g}>{g}학년</option>)}</select></label>
      <label>교과<select aria-label="교과" value={f.subject} onChange={e => change('subject', e.target.value)}><option value="">전체 교과</option>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select></label>
      <label>수업 모형<select aria-label="수업 모형" value={f.teachingModel} onChange={e => change('teachingModel', e.target.value)}><option value="">전체 수업 모형</option>{TEACHING_MODELS.map(m => <option key={m} value={m}>{m}</option>)}</select></label>
      <label>단원<select aria-label="단원" value={f.unit} onChange={e => change('unit', e.target.value)}><option value="">전체 단원</option>{units.map(s => <option key={s}>{s}</option>)}</select></label>
      <label>자료 유형<select aria-label="자료 유형" value={f.materialType} onChange={e => change('materialType', e.target.value)}><option value="">전체 자료</option><option>지도안</option><option>수업 보조자료</option></select></label>
      <div className="filter-note">HWP · HWPX · PDF 파일을<br />로그인 없이 다운로드해요.</div>
    </aside><div className="results"><SearchBox value={urlQuery} plans={suggestionPlans} onSearch={value => change('q', value)} live label="자료 검색" placeholder="제목, 학습 주제, 성취기준으로 검색" className="library-search" />
      {f.query && canonicalizeQuery(f.query) !== f.query.trim() && <p className="search-translation">‘{canonicalizeQuery(f.query)}’ 표현으로 검색했어요.</p>}
      {(standardStats.length > 0 || stdSearch) && <section className="standard-explorer" aria-label="성취기준 사전 탐색기">
        <div className="standard-explorer-head">
          <div><strong><Compass size={16} /> 성취기준 코드·핵심어 사전 탐색기</strong><span>{f.grade || f.subject ? `${f.grade ? (f.grade === '유아' ? '유아 ' : `${f.grade}학년 `) : ''}${f.subject || ''} ` : ''}성취기준 <b>{standardStats.length}</b>개</span></div>
          <div className="standard-explorer-actions">
            {stdExpanded && <input type="search" value={stdSearch} onChange={e => setStdSearch(e.target.value)} placeholder="성취기준 코드·주제 필터 (예: [6국, 분수)" aria-label="성취기준 코드 필터" className="standard-filter-input" />}
            {standardStats.length > 10 && <button type="button" className="standard-toggle-btn" onClick={() => setStdExpanded(v => !v)}>{stdExpanded ? '간략히 보기' : `성취기준 사전 펼치기 (+${standardStats.length - 10})`}</button>}
          </div>
        </div>
        <div className="standard-badge-cloud">
          {shownStandards.map(item => {
            const active = f.standard === item.code;
            return <button type="button" key={item.code} className={`standard-chip${active ? ' is-active' : ''}`} onClick={() => change('standard', active ? '' : item.code)} title={`${item.subject} · ${item.sampleTopic}`}>
              <span className="standard-code">{item.code}</span>
              <span className="standard-count">{item.count}개</span>
            </button>;
          })}
          {!shownStandards.length && <span className="muted">일치하는 성취기준 코드가 없습니다.</span>}
        </div>
        {f.standard && <div className="standard-compare-banner" role="status">
          <div><strong>성취기준 비교 뷰: {f.standard}</strong><span>동일 성취기준을 다루는 <b>{result.length}개</b>의 지도안을 한눈에 비교하고 있습니다.</span></div>
          <button type="button" className="button secondary" onClick={() => change('standard', '')}>성취기준 필터 해제</button>
        </div>}
      </section>}
      {(f.grade || f.subject || f.teachingModel || f.unit || f.query || f.materialType || f.standard) && <div className="active-filters">{[['q', f.query], ['grade', f.grade && (f.grade === '유아' ? '유아' : `${f.grade}학년`)], ['subject', f.subject], ['teachingModel', f.teachingModel], ['unit', f.unit], ['materialType', f.materialType], ['standard', f.standard && `성취기준 ${f.standard}`]].filter(([, v]) => v).map(([k, v]) => <button key={k} onClick={() => change(k, '')}>{v}<X size={13} /></button>)}</div>}
      <div className="results-toolbar"><span>검색 결과 <strong>{props.loading || props.error ? '—' : result.length}</strong>개</span><select aria-label="정렬" value={f.sort} onChange={e => change('sort', e.target.value)}><option value="latest">최신순</option><option value="title">제목순</option><option value="grade">학년순</option><option value="subject">교과순</option></select></div>
      <BatchDownload visible={props.loading || props.error ? [] : result.slice(0, visibleCount)} results={props.loading || props.error ? [] : result} selected={selected} onChange={plans => { if (!downloading) setSelected(plans); }} onBusyChange={setDownloading} />
      <CatalogStatus {...props} />{!props.loading && !props.error && (result.length ? <><div className="card-grid library-cards">{result.slice(0, visibleCount).map(p => <PlanCard key={p.id} plan={p} selection={{ checked: selectedIds.has(p.id), disabled: downloading, toggle: () => toggleSelection(p) }} />)}</div>{result.length > visibleCount && <div className="results-toolbar"><span>{visibleCount} / {result.length}개 표시</span><button className="button secondary" onClick={() => setDisplay({ key: filterKey, count: visibleCount + 60 })}>자료 더 보기</button></div>}</> : <EmptyState filtered={props.plans.length > 0 || !!(f.query || f.grade || f.subject || f.teachingModel || f.unit || f.materialType || f.standard)} onReset={() => setParams({})} />)}
      {recovery.length > 0 && <section className="search-recovery" aria-label="검색 조건 완화 제안"><p>다음 조건으로 자료를 찾을 수 있어요.</p>{recovery.map(item => <button className="button secondary" key={item.label} onClick={() => { const next = new URLSearchParams(params); for (const key of ['q', 'grade', 'subject', 'unit', 'teachingModel', 'materialType', 'standard']) { const value = key === 'q' ? item.filters.query : item.filters[key as keyof typeof item.filters]; value ? next.set(key, value) : next.delete(key); } setParams(next, { replace: true }); }}>{item.label} · {item.count}개</button>)}</section>}
    </div></div>
    {showTopBtn && <button type="button" className="scroll-top-btn" onClick={scrollToTop} aria-label="맨 위로 이동"><ArrowUp size={18} /> 맨 위로</button>}
  </div>;
}

