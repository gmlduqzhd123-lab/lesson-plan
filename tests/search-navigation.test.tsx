import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { canonicalizeQuery, searchPlans, searchSuggestions, relaxedSearches } from '../src/lib/search';
import SearchBox from '../src/components/SearchBox';
import LibraryPage from '../src/pages/LibraryPage';
import { recordFixture } from './fixtures.mjs';
import type { Plan } from '../src/types';
afterEach(cleanup);
const p = recordFixture(new Uint8Array([1]), { status: 'approved', title: '분수 수업', grades: [5], subject: '수학', unit: '분수의 덧셈', normalizedUnit: '분수의덧셈', topic: '분수 더하기', standards: ['[6수01-08]'], keywords: ['분수'] }) as Plan;
const filters = { query: '', grade: '', subject: '', unit: '', sort: 'latest' };
it('recognizes grade expressions and subject suffixes without changing explicit filters or standards', () => {
  for (const query of ['오학년 수학','초5 수학','초등학교 5 학년 수학과','다섯학년 수학']) expect(searchPlans([p], { ...filters, query })).toEqual([p]);
  expect(canonicalizeQuery('[6수01-08]')).toBe('[6수01-08]');
  expect(searchPlans([p], { ...filters, query: '초5 수학', grade: '6' })).toEqual([]);
});
it('suggests actual catalog units, standards and contextual completions, deduplicating them', () => {
  expect(searchSuggestions([p, p], '분수').map(s => s.value)).toContain('분수의 덧셈');
  expect(searchSuggestions([p], '5학년 수학 분').map(s => s.value)).toContain('5학년 수학 분수의 덧셈');
  expect(searchSuggestions([p], '[6수').map(s => s.value)).toContain('[6수01-08]');
  expect(searchSuggestions([], '분수')).toEqual([]);
  expect(searchSuggestions([p], '없는단원')).toEqual([]);
});
it('suggests filter relaxation only with real results while preserving other conditions', () => {
  const choices = relaxedSearches([p], { ...filters, query: '분수', grade: '6', subject: '수학' });
  expect(choices).toContainEqual(expect.objectContaining({ label: '학년 조건 풀기', count: 1 }));
  expect(choices[0].filters.subject).toBe('수학');
  expect(relaxedSearches([p], { ...filters, query: '없는단원', grade: '6' })).toEqual([]);
});
it('supports keyboard completion and Escape without accepting composing Hangul', () => {
  const search = vi.fn(); render(<SearchBox plans={[p]} onSearch={search} label="검색" placeholder="검색" />);
  const input = screen.getByRole('combobox'); fireEvent.focus(input); fireEvent.change(input, { target: { value: '분수' } });
  fireEvent.keyDown(input, { key: 'ArrowDown' }); expect(input.getAttribute('aria-activedescendant')).toBeTruthy();
  const chosen = screen.getAllByRole('option')[0].textContent!.replace('자료 기반 추천', '');
  fireEvent.submit(input.closest('form')!); expect(search).toHaveBeenLastCalledWith(chosen);
  fireEvent.focus(input); fireEvent.keyDown(input, { key: 'Escape' }); expect(input.getAttribute('aria-expanded')).toBe('false');
  fireEvent.compositionStart(input); fireEvent.change(input, { target: { value: '분' } }); fireEvent.submit(input.closest('form')!); expect(search).toHaveBeenCalledTimes(1);
});
it('keeps selection when mobile filters are toggled and offers a shared bottom download action', () => {
  render(<MemoryRouter><LibraryPage plans={[p]} loading={false} error="" retry={vi.fn()} /></MemoryRouter>);
  const toggle = screen.getByRole('button', { name: '필터 열기' }); expect(toggle.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(toggle); expect(screen.getByRole('button', { name: '필터 접기' }).getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(screen.getByRole('checkbox')); expect(screen.getByRole('button', { name: '원본 받기' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '필터 접기' })); expect(screen.getByText('선택한 자료 1개')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '선택 해제' })); expect(screen.queryByRole('button', { name: '원본 받기' })).toBeNull();
});
