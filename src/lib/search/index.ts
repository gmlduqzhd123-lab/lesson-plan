import { normalize } from '../../../shared/schema.mjs';
import type { Plan } from '../../types';
export type Filters = { query: string; grade: string; subject: string; unit: string; sort: string; materialType?: string; teachingModel?: string };
export const matchesGrade = (p: Plan, grade: string) => !grade || (grade === '유아' ? p.educationLevel === '유아' : p.grades.includes(Number(grade)));
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
  const terms = f.query.trim().split(/\s+/).filter(Boolean).map(normalize);
  const compact = normalize(f.query);
  const modelCore = f.teachingModel ? normalize(f.teachingModel).replace(/(학습|수업|모형|법)+$/g, '') : '';
  const result = plans.filter(p => {
    const hay = normalize([p.title, p.grades.map(g => `${g}학년`).join(' '), p.gradeBand, p.educationLevel, p.materialType, p.subject, p.teachingModel, p.unit, p.topic, p.author, ...p.objectives, ...p.standards, ...p.keywords].join(' '));
    const matchesModel = !f.teachingModel || p.teachingModel === f.teachingModel || (modelCore && (normalize(p.teachingModel).includes(modelCore) || hay.includes(modelCore)));
    return (!terms.length || hay.includes(compact) || terms.every(t => hay.includes(t))) && matchesGrade(p, f.grade) && (!f.subject || p.subject === f.subject) && (!f.unit || p.normalizedUnit === normalize(f.unit)) && (!f.materialType || p.materialType === f.materialType) && matchesModel;
  });
  return result.sort((a, b) => f.sort === 'title' ? a.title.localeCompare(b.title, 'ko') : f.sort === 'grade' ? (a.grades[0] ?? 9) - (b.grades[0] ?? 9) || a.title.localeCompare(b.title, 'ko') : f.sort === 'subject' ? a.subject.localeCompare(b.subject, 'ko') || a.title.localeCompare(b.title, 'ko') : getLessonDate(b).localeCompare(getLessonDate(a)) || b.publishedAt.localeCompare(a.publishedAt));
}
