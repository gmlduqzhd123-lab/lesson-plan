import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AccessGate, { useAccessGate } from '../src/components/AccessGate';
import Detail from '../src/pages/Detail';
import LibraryPage from '../src/pages/LibraryPage';
import { buildAiPrompt, buildLessonSections, getRecommendedYsTools } from '../src/lib/lesson-insights';
import { extractStandardStats, searchPlans } from '../src/lib/search';
import { recordFixture } from './fixtures.mjs';
import type { Plan } from '../src/types';

const configuredPassword = String.fromCharCode(121, 115, 48, 50, 48, 52);

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('TextEncoder', TextEncoder);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('Idea #1: supports browse-first mode and opens on-demand authentication modal when a protected action is triggered', async () => {
  const onAction = vi.fn();
  function BrowseProbe() {
    const { admitted, requireAccess } = useAccessGate();
    return (
      <div>
        <span>상태:{admitted ? '인증됨' : '미인증'}</span>
        <button type="button" onClick={() => requireAccess(onAction)}>보호 작업 실행</button>
      </div>
    );
  }
  const catalog = { plans: [], loading: false, error: '', retry: vi.fn() };
  render(
    <AccessGate catalog={catalog} allowBrowse>
      <BrowseProbe />
    </AccessGate>,
  );

  // Immediately visible without hitting a wall
  expect(screen.getByText('상태:미인증')).toBeTruthy();
  expect(screen.queryByRole('dialog')).toBeNull();

  // Triggering protected action opens modal
  fireEvent.click(screen.getByRole('button', { name: '보호 작업 실행' }));
  expect(screen.getByRole('dialog', { name: '자료실 이용 인증' })).toBeTruthy();
  expect(onAction).not.toHaveBeenCalled();

  // Complete notice + password in modal
  fireEvent.click(screen.getByRole('tab', { name: /유의 사항/ }));
  const reader = screen.getByRole('region', { name: '유의 사항 전문' });
  Object.defineProperties(reader, {
    clientHeight: { value: 270, configurable: true },
    scrollHeight: { value: 1000, configurable: true },
    scrollTop: { value: 730, configurable: true },
  });
  fireEvent.scroll(reader);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: '확인하고 비밀번호 입력하기' }));
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: configuredPassword } });
  fireEvent.click(screen.getByRole('button', { name: '자료실 입장하기' }));

  await waitFor(() => expect(screen.getByText('상태:인증됨')).toBeTruthy());
  await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
});

it('Idea #3 & #4 & #10: builds structured lesson stages, AI reconstruction prompt, and matched YsSchool tools on Detail page', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));

  const mathPlan = recordFixture(new Uint8Array([1, 2, 3]), {
    status: 'approved',
    title: '5학년 분수의 덧셈 공개수업',
    grades: [5],
    subject: '수학',
    unit: '5. 분수의 덧셈과 뺄셈',
    normalizedUnit: '5.분수의덧셈과뺄셈',
    topic: '이분모 분수의 덧셈 원리 알기',
    standards: ['[6수01-08]'],
    teachingModel: '원리탐구학습',
    previewText: '',
    publishedAt: '2026-10-12T00:00:00Z',
  }) as Plan;

  const flow = buildLessonSections(mathPlan);
  expect(flow.stages).toHaveLength(3);
  expect(flow.stages.map(s => s.badge)).toEqual(['도입', '전개', '정리·평가']);

  const prompt = buildAiPrompt(mathPlan, {
    studentCount: 26,
    groupSize: 4,
    durationMinutes: 40,
    focusMode: '에듀테크·디지털 활용',
  });
  expect(prompt).toContain('총 26명');
  expect(prompt).toContain('[6수01-08]');
  expect(prompt).toContain('원리탐구학습');

  const tools = getRecommendedYsTools(mathPlan);
  expect(tools).toHaveLength(3);
  expect(tools[0].id).toBe('math-survival');

  render(
    <MemoryRouter initialEntries={[`/library/${mathPlan.id}`]}>
      <Routes>
        <Route path="/library/:id" element={<Detail plans={[mathPlan]} loading={false} error="" retry={vi.fn()} />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(screen.getByRole('heading', { name: '도입 · 전개 · 정리 수업 흐름 뷰어' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /도입 복사/ }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('[도입 - 동기유발 및 학습문제 확인')));

  fireEvent.click(screen.getByRole('button', { name: /AI 재구성 프롬프트 복사/ }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('본시 교수학습과정안')));

  expect(screen.getByRole('heading', { name: '이 수업에 바로 쓸 수 있는 엽쌤 에듀테크 도구' })).toBeTruthy();
  expect(screen.getByText('매쓰 서바이벌 (Math Survival)')).toBeTruthy();
});

it('Idea #7: extracts achievement standard statistics and filters catalog by standard code in LibraryPage', () => {
  const p1 = recordFixture(new Uint8Array([10]), {
    status: 'approved',
    title: '국어 토의 수업 A',
    grades: [6],
    subject: '국어',
    standards: ['[6국01-02]', '[6국01-03]'],
    publishedAt: '2026-10-12T00:00:00Z',
  }) as Plan;
  const p2 = recordFixture(new Uint8Array([20]), {
    status: 'approved',
    title: '국어 토의 수업 B',
    grades: [6],
    subject: '국어',
    standards: ['[6국01-02]'],
    publishedAt: '2026-10-12T00:00:00Z',
  }) as Plan;

  const stats = extractStandardStats([p1, p2], { grade: '6', subject: '국어' });
  expect(stats[0]).toMatchObject({ code: '[6국01-02]', count: 2 });
  expect(stats[1]).toMatchObject({ code: '[6국01-03]', count: 1 });

  expect(searchPlans([p1, p2], { query: '', grade: '', subject: '', unit: '', sort: 'latest', standard: '[6국01-03]' })).toEqual([p1]);

  render(
    <MemoryRouter initialEntries={['/library']}>
      <LibraryPage plans={[p1, p2]} loading={false} error="" retry={vi.fn()} />
    </MemoryRouter>,
  );

  expect(screen.getByText(/성취기준 코드·핵심어 사전 탐색기/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /\[6국01-03\]/ }));
  expect(screen.getByText(/성취기준 비교 뷰: \[6국01-03\]/)).toBeTruthy();
  expect(screen.getByRole('heading', { name: '국어 토의 수업 A' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: '국어 토의 수업 B' })).toBeNull();
});
