import type { Draft, Plan } from '../types';

export function reconcileDuplicates(drafts: Draft[], published: Plan[]): Draft[] {
  const seen = new Set(published.map(p => p.sha256));
  return drafts.map(d => {
    if (!d.plan || !['완료', '중복'].includes(d.state)) return d;
    const duplicate = seen.has(d.plan.sha256);
    seen.add(d.plan.sha256);
    const state = duplicate ? '중복' : '완료';
    if (d.state === state) return d;
    return { ...d, state, error: duplicate ? '선택 목록 또는 공개 자료실에 같은 원본이 있습니다. 이 행을 제거해주세요.' : undefined };
  });
}
