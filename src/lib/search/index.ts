import { normalize } from '../../../shared/schema.mjs';
import type { Plan } from '../../types';
export type Filters = { query: string; grade: string; subject: string; unit: string; sort: string };
export function searchPlans(plans: Plan[], f: Filters) {
  const terms = f.query.trim().split(/\s+/).filter(Boolean).map(normalize);
  const compact = normalize(f.query);
  const result = plans.filter(p => {
    const hay = normalize([p.title, p.grades.map(g => `${g}학년`).join(' '), p.gradeBand, p.subject, p.unit, p.topic, ...p.objectives, ...p.standards, ...p.keywords].join(' '));
    return (!terms.length || hay.includes(compact) || terms.every(t => hay.includes(t))) && (!f.grade || p.grades.includes(Number(f.grade))) && (!f.subject || p.subject === f.subject) && (!f.unit || p.normalizedUnit === normalize(f.unit));
  });
  return result.sort((a, b) => f.sort === 'title' ? a.title.localeCompare(b.title, 'ko') : f.sort === 'grade' ? (a.grades[0] ?? 9) - (b.grades[0] ?? 9) || a.title.localeCompare(b.title, 'ko') : f.sort === 'subject' ? a.subject.localeCompare(b.subject, 'ko') || a.title.localeCompare(b.title, 'ko') : b.publishedAt.localeCompare(a.publishedAt));
}
