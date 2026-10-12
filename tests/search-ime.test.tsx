import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import LibraryPage from '../src/pages/LibraryPage';

afterEach(cleanup);
function LocationProbe() {
  const location = useLocation(), navigate = useNavigate();
  return <><output data-testid="location">{location.search}</output><button onClick={() => navigate('/library?q=분수')}>다른 검색 주소</button></>;
}
const props = { plans: [], loading: false, error: '', retry: vi.fn() };
function setup(initial = '/library?grade=5&q=') {
  render(<MemoryRouter initialEntries={[initial]}><LibraryPage {...props} /><LocationProbe /></MemoryRouter>);
  return screen.getByLabelText('자료 검색') as HTMLInputElement;
}

it('keeps Hangul composition local and commits only the completed text, preserving other filters', () => {
  const input = setup();
  const before = screen.getByTestId('location').textContent;
  fireEvent.compositionStart(input);
  for (const value of ['ㅍ', '프', '프로', '프로ㅈ', '프로제', '프로젝', '프로젝트']) {
    fireEvent.change(input, { target: { value } });
    expect(input.value).toBe(value);
    expect(screen.getByTestId('location').textContent).toBe(before);
  }
  fireEvent.compositionEnd(input, { data: '프로젝트' });
  let query = new URLSearchParams(screen.getByTestId('location').textContent!);
  expect(query.get('q')).toBe('프로젝트'); expect(query.get('grade')).toBe('5');
  // Browsers can emit a final input/change after compositionend.
  fireEvent.change(input, { target: { value: '프로젝트' } });
  expect(input.value).toBe('프로젝트');
  fireEvent.compositionStart(input);
  fireEvent.change(input, { target: { value: '프로젝트 ㅅ' } });
  expect(new URLSearchParams(screen.getByTestId('location').textContent!).get('q')).toBe('프로젝트');
  fireEvent.change(input, { target: { value: '프로젝트 수업' } }); fireEvent.compositionEnd(input, { data: '수업' });
  query = new URLSearchParams(screen.getByTestId('location').textContent!);
  expect(query.get('q')).toBe('프로젝트 수업');
});

it('supports ordinary input, clear, filter reset and external query navigation', () => {
  const input = setup('/library?q=기존');
  expect(input.value).toBe('기존');
  fireEvent.change(input, { target: { value: 'lesson 5' } });
  expect(new URLSearchParams(screen.getByTestId('location').textContent!).get('q')).toBe('lesson 5');
  fireEvent.click(screen.getByRole('button', { name: '검색어 지우기' }));
  expect(input.value).toBe(''); expect(new URLSearchParams(screen.getByTestId('location').textContent!).has('q')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: '다른 검색 주소' }));
  expect(input.value).toBe('분수');
  fireEvent.click(screen.getByRole('button', { name: '필터 초기화' })); expect(input.value).toBe('');
});
