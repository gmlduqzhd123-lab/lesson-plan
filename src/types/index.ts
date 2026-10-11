import { z } from 'zod';
import { PlanSchema } from '../../shared/schema.mjs';
export type Plan = z.infer<typeof PlanSchema>;
export type Confidence = '높음' | '보통' | '확인 필요';
export type Classification = { values: Partial<Plan>; confidence: Confidence; evidence: string[] };
export type Draft = { key: string; file: File; state: '대기' | '분석 중' | '완료' | '실패' | '중복'; error?: string; warning?: string; plan?: Plan; confidence?: Confidence; evidence?: string[] };
