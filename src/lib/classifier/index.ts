import { normalize, SUBJECTS } from '../../../shared/schema.mjs';
import type { Classification, Plan } from '../../types';

const labels = ['교과', '과목', '학년', '대상', '단원명', '단원', '차시', '학습 주제', '학습주제', '주제', '학습 목표', '학습목표', '성취기준', '교육과정', '교수학습모형', '수업모형', '수업 시간', '수업시간'];
function field(text: string, names: string[]): string {
  for (const line of text.split('\n')) {
    const cells = line.split('\t').map(s => s.trim());
    for (let i = 0; i < cells.length - 1; i++) {
      if (names.some(name => normalize(cells[i].replace(/[:：]$/, '')) === normalize(name))) return cells[i + 1].slice(0, 500);
    }
    for (const name of names) {
      const match = line.match(new RegExp(`^\\s*${name.replace(/ /g, '\\s*')}\\s*(?:[:：]|\\t)\\s*(.+)$`));
      if (match) {
        let value = match[1];
        for (const label of labels) value = value.split(new RegExp(`\\t${label}\\s*(?:\\t|[:：])`))[0];
        return value.trim().slice(0, 500);
      }
    }
  }
  return '';
}
function gradeInfo(text: string) {
  const band = text.match(/([1-6])\s*(?:[~～\-·ㆍ]|,|와|과|및)\s*([1-6])\s*학년(?:군)?/);
  if (band) return { grades: [] as number[], gradeBand: `${band[1]}~${band[2]}학년군` };
  const single = text.match(/([1-6])\s*학년(?!군)/);
  return { grades: single ? [Number(single[1])] : [], gradeBand: '' };
}
function subjectInfo(text: string) { return SUBJECTS.filter(s => s !== '기타').sort((a, b) => b.length - a.length).find(s => new RegExp(`(?:^|[^가-힣A-Za-z]|학년)${s.replace(/ /g, '\\s*')}(?:과|교과)?(?=$|[^가-힣A-Za-z])`).test(text)) ?? ''; }
const standardSubjects: Record<string, string> = { 국: '국어', 수: '수학', 사: '사회', 과: '과학', 영: '영어', 도: '도덕', 체: '체육', 음: '음악', 미: '미술', 실: '실과', 바: '통합교과', 슬: '통합교과', 즐: '통합교과' };
export function classify(text: string, filename: string): Classification {
  const evidence: string[] = [];
  const titleLine = text.split('\n').find(l => /교수.?학습.?과정안|수업.?지도안/.test(l)) ?? '';
  const gradeField = field(text, ['학년', '대상']);
  let info = gradeInfo(gradeField);
  if (info.grades.length || info.gradeBand) evidence.push(`문서 학년 필드: ${gradeField}`);
  else {
    info = gradeInfo(titleLine);
    if (info.grades.length || info.gradeBand) evidence.push(`문서 제목: ${titleLine}`);
    else { info = gradeInfo(filename); if (info.grades.length || info.gradeBand) evidence.push(`파일명에서 학년 추정: ${filename}`); }
  }
  const standards = [...new Set(text.match(/\[\s*\d{1,2}[가-힣]{1,4}\d{2}-\d{2}\s*\]/g) ?? [])];
  let subject = subjectInfo(field(text, ['교과', '과목']));
  if (subject) evidence.push(`문서 교과 필드: ${subject}`);
  else {
    subject = subjectInfo(titleLine);
    if (subject) evidence.push(`문서 제목에서 교과 추출: ${subject}`);
    else {
      subject = subjectInfo(filename);
      if (subject) evidence.push(`파일명에서 교과 추정: ${subject}`);
      else {
        const code = standards[0]?.match(/\d+([가-힣]+)\d/);
        subject = (code ? standardSubjects[code[1]] : '') || subjectInfo(text);
        if (subject) evidence.push(`성취기준 또는 본문 키워드에서 교과 추정: ${subject}`);
      }
    }
  }
  const unit = field(text, ['단원명', '단원']);
  const topic = field(text, ['학습 주제', '학습주제', '주제']);
  const objective = field(text, ['학습 목표', '학습목표']);
  const values: Partial<Plan> = {
    title: filename.replace(/\.(hwpx?|HWPX?)$/i, '').slice(0, 200), ...info, subject: subject || '기타', unit, normalizedUnit: normalize(unit),
    lessonNumber: field(text, ['차시']), topic, objectives: objective ? [objective] : [], standards,
    curriculum: field(text, ['교육과정']), teachingModel: field(text, ['교수학습모형', '수업모형']),
    duration: field(text, ['수업 시간', '수업시간']), keywords: [],
  };
  const explicit = !!gradeField && !!field(text, ['교과', '과목']) && info.grades.length > 0;
  const confidence = explicit && unit ? '높음' : (text && info.grades.length && subject && unit ? '보통' : '확인 필요');
  if (info.gradeBand) evidence.push('학년군은 적용 범위입니다. 실제 수업 학년은 직접 선택해주세요.');
  if (!values.curriculum) evidence.push('교육과정은 확인되지 않아 빈 값으로 유지했습니다.');
  return { values, confidence, evidence };
}
