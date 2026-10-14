import { normalize } from '../../../shared/schema.mjs';
import type { Plan } from '../../types';
export type Filters = { query: string; grade: string; subject: string; unit: string; sort: string; materialType?: string; teachingModel?: string };
export const matchesGrade = (p: Plan, grade: string) => !grade || (grade === '유아' ? p.educationLevel === '유아' : p.grades.includes(Number(grade)));
export function canonicalizeQuery(query: string) {
  const grades: Record<string, string> = { 일: '1', 이: '2', 삼: '3', 사: '4', 오: '5', 육: '6', 한: '1', 두: '2', 세: '3', 네: '4', 다섯: '5', 여섯: '6' };
  return query.normalize('NFKC').trim()
    .replace(/(다섯|여섯|일|이|삼|사|오|육|한|두|세|네)\s*학년/g, (_, grade: string) => `${grades[grade]}학년`)
    .replace(/초(?:등(?:학교)?)?\s*([1-6])\s*(?:학년)?/g, '$1학년')
    .replace(/([1-6])\s*학년/g, '$1학년')
    .replace(/(국어|수학|사회|과학|영어|체육|음악|미술|실과|도덕)과(?=\s|$)/g, '$1')
    .replace(/\s+/g, ' ');
}

export function searchSuggestions(plans: Plan[], query: string) {
  const canonical = canonicalizeQuery(query), terms = canonical.split(/\s+/);
  if (normalize(canonical).length < 2) return [];
  const prefix = terms.length > 1 ? terms.slice(0, -1).join(' ') : '';
  const last = normalize(terms.at(-1) || '');
  const scoped = prefix ? searchPlans(plans, { query: prefix, grade: '', subject: '', unit: '', sort: 'latest' }) : plans;
  const choices = new Map<string, { value: string; count: number }>();
  for (const p of scoped) {
    const candidates = new Set([p.unit, p.topic, ...p.standards, ...p.keywords, ...p.grades.map(g => `${g}학년 ${p.subject}`)].filter(value => value && value.length >= 2 && value.length <= 80));
    const seen = new Set<string>();
    for (const candidate of candidates) {
      const value = normalize(candidate).includes(normalize(canonical)) ? candidate : prefix && normalize(candidate).includes(last) ? `${prefix} ${candidate}` : '';
      const key = normalize(value);
      if (!value || seen.has(key)) continue;
      seen.add(key); const previous = choices.get(key);
      choices.set(key, { value: previous?.value || value, count: (previous?.count || 0) + 1 });
    }
  }
  return [...choices.values()].sort((a, b) => Number(normalize(b.value).startsWith(normalize(canonical))) - Number(normalize(a.value).startsWith(normalize(canonical))) || b.count - a.count || a.value.length - b.value.length || a.value.localeCompare(b.value, 'ko')).slice(0, 6);
}

export function relaxedSearches(plans: Plan[], filters: Filters) {
  const suggestions: { label: string; filters: Filters; count: number }[] = [];
  const labels: Record<string, string> = { grade: '학년', subject: '교과', unit: '단원', teachingModel: '수업 모형', materialType: '자료 유형' };
  for (const field of ['unit', 'teachingModel', 'materialType', 'grade', 'subject'] as const) {
    if (!filters[field]) continue;
    const next = { ...filters, [field]: '', ...(['grade', 'subject'].includes(field) ? { unit: '' } : {}) };
    const count = searchPlans(plans, next).length;
    if (count) suggestions.push({ label: `${labels[field]} 조건 풀기`, filters: next, count });
  }
  const terms = canonicalizeQuery(filters.query).split(/\s+/);
  if (terms.length > 1) {
    const next = { ...filters, query: terms.slice(0, -1).join(' ') }, count = searchPlans(plans, next).length;
    if (count) suggestions.push({ label: `‘${next.query}’로 검색`, filters: next, count });
  }
  return suggestions.slice(0, 3);
}
export function getLessonDate(p: Plan): string {
  if (p.classificationNotes && p.classificationNotes.length) {
    for (const note of p.classificationNotes) {
      const m = note.match(/원 게시물 등록일:\s*(\d{4})\.(\d{2})\.(\d{2})/);
      if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    }
  }
  for (const kw of (p.keywords || [])) {
    const m = kw.match(/(202\d)년\s*게시/);
    if (m) return `${m[1]}-01-01`;
  }
  const tm = p.title.match(/(202[0-9])/);
  if (tm) return `${tm[1]}-01-01`;
  return p.publishedAt ? p.publishedAt.slice(0, 10) : '2020-01-01';
}

export function searchPlans(plans: Plan[], f: Filters) {
  const query = canonicalizeQuery(f.query);
  const terms = query.split(/\s+/).filter(Boolean).map(normalize);
  const compact = normalize(query);
  const modelCore = f.teachingModel ? normalize(f.teachingModel).replace(/(학습|수업|모형|법)+$/g, '') : '';
  const result = plans.filter(p => {
    const hay = normalize([p.title, p.grades.map(g => `${g}학년`).join(' '), p.gradeBand, p.educationLevel, p.materialType, p.subject, p.teachingModel, p.unit, p.topic, p.author, ...p.objectives, ...p.standards, ...p.keywords].join(' '));
    const matchesModel = !f.teachingModel || p.teachingModel === f.teachingModel || (modelCore && (normalize(p.teachingModel).includes(modelCore) || hay.includes(modelCore)));
    return (!terms.length || hay.includes(compact) || terms.every(t => hay.includes(t))) && matchesGrade(p, f.grade) && (!f.subject || p.subject === f.subject) && (!f.unit || p.normalizedUnit === normalize(f.unit)) && (!f.materialType || p.materialType === f.materialType) && matchesModel;
  });
  return result.sort((a, b) => f.sort === 'title' ? a.title.localeCompare(b.title, 'ko') : f.sort === 'grade' ? (a.grades[0] ?? 9) - (b.grades[0] ?? 9) || a.title.localeCompare(b.title, 'ko') : f.sort === 'subject' ? a.subject.localeCompare(b.subject, 'ko') || a.title.localeCompare(b.title, 'ko') : getLessonDate(b).localeCompare(getLessonDate(a)) || b.publishedAt.localeCompare(a.publishedAt));
}
