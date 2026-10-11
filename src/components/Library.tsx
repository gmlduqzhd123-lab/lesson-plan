import { ArrowRight, BookOpen, FileText, SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Plan } from '../types';

export const gradeLabel = (p: Plan) => p.educationLevel === '유아' ? '유아' : p.grades.length ? p.grades.map(g => `${g}학년`).join(' · ') : p.gradeBand || '학년 미분류';
export function PlanCard({ plan: p }: { plan: Plan }) {
  return <Link className="plan-card" to={`/library/${p.id}`}>
    <div className="card-top"><span className="tag blue">{gradeLabel(p)}</span><span className="tag mint">{p.subject}</span><span className="format">{p.fileFormat}</span></div>
    {p.materialType === '수업 보조자료' && <span className="tag">수업 보조자료</span>}
    <div className="card-icon"><FileText size={24} /></div><h3>{p.title}</h3>
    <p>{p.unit || '단원 미분류'}{p.lessonNumber ? ` · ${p.lessonNumber}` : ''}</p><p className="card-topic">{p.topic || '학습 주제는 상세정보에서 확인하세요.'}</p>
    <div className="card-footer"><span>{new Date(p.publishedAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</span><span>자료 보기 <ArrowRight size={16} /></span></div>
  </Link>;
}
export function EmptyState({ filtered = false }: { filtered?: boolean }) {
  return <div className="empty-state"><div className="empty-icon">{filtered ? <SearchX size={32} /> : <BookOpen size={32} />}</div>
    <h3>{filtered ? '조건에 맞는 지도안이 없어요' : '첫 번째 수업 자료를 기다리고 있어요'}</h3>
    <p>{filtered ? '검색어를 줄이거나 다른 학년과 교과를 선택해보세요.' : '검토와 승인을 마친 지도안이 이곳에 공개됩니다.\n선생님의 수업 경험으로 함께 채워주세요.'}</p>
    {!filtered && <Link to="/upload" className="button secondary">지도안 분석·제출 <ArrowRight size={16} /></Link>}
  </div>;
}
export function CatalogStatus({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  return loading ? <div className="status" role="status"><span className="spinner" /> 자료 목록을 불러오고 있어요.</div> : error ? <div className="alert" role="alert"><strong>자료 목록을 불러오지 못했어요.</strong><p>{error}</p><button className="button secondary" onClick={retry}>다시 시도</button></div> : null;
}
