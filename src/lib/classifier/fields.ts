import { normalize } from '../../../shared/schema.mjs';

export const labels = ['교과', '과목', '학년', '대상', '단원명', '단원', '차시', '학습주제', '주제', '학습목표', '성취기준', '교육과정', '교수학습모형', '수업모형', '수업시간'];
export function isFieldLabel(value: string) { return labels.includes(normalize(value.replace(/[:：]\s*$/, ''))); }
