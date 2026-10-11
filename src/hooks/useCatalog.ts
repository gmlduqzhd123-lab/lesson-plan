import { useEffect, useState } from 'react';
import { PlanSchema } from '../../shared/schema.mjs';
import type { Plan } from '../types';

export function useCatalog() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    fetch(`${import.meta.env.BASE_URL}catalog/index.json`, { signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(`자료 목록을 가져오지 못했습니다 (${response.status}).`); return response.json(); })
      .then(data => {
        const parsed = PlanSchema.array().max(10000).parse(data);
        if (parsed.some(p => p.status !== 'approved') || new Set(parsed.map(p => p.id)).size !== parsed.length || new Set(parsed.map(p => p.sha256)).size !== parsed.length) throw new Error('공개 자료 목록의 승인 상태·중복 검증에 실패했습니다.');
        setPlans(parsed);
      }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '목록 오류'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  return { plans, loading, error, retry: () => setAttempt(n => n + 1) };
}
