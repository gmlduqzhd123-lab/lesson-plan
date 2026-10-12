import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AccessGate from '../src/components/AccessGate';
import { ACCESS_SESSION_KEY, hasAccessSession, verifyAccessPassword } from '../src/lib/access';

const configuredPassword = String.fromCharCode(121, 115, 48, 50, 48, 52);
const catalog = { plans: [], loading: false, error: '', retry: vi.fn() };
beforeEach(() => { sessionStorage.clear(); vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('TextEncoder', TextEncoder); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function confirmNotice() {
  fireEvent.click(screen.getByRole('tab', { name: /유의 사항/ }));
  const reader = screen.getByRole('region', { name: '유의 사항 전문' });
  Object.defineProperties(reader, { clientHeight: { value: 270, configurable: true }, scrollHeight: { value: 1000, configurable: true }, scrollTop: { value: 730, configurable: true } });
  fireEvent.scroll(reader);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: '확인하고 비밀번호 입력하기' }));
}

it('requires visiting the notice, reaching its end and agreeing before password entry', () => {
  render(<AccessGate catalog={catalog}><p>protected screen</p></AccessGate>);
  expect((screen.getByLabelText('비밀번호') as HTMLInputElement).disabled).toBe(true);
  expect(screen.queryByText('protected screen')).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: /유의 사항/ }));
  expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
  const reader = screen.getByRole('region', { name: '유의 사항 전문' });
  Object.defineProperties(reader, { clientHeight: { value: 270 }, scrollHeight: { value: 1000 }, scrollTop: { value: 400, configurable: true } });
  fireEvent.scroll(reader);
  expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
  Object.defineProperty(reader, 'scrollTop', { value: 730 }); fireEvent.scroll(reader);
  expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(false);
  expect((screen.getByRole('button', { name: '확인하고 비밀번호 입력하기' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: '확인하고 비밀번호 입력하기' }));
  expect((screen.getByLabelText('비밀번호') as HTMLInputElement).disabled).toBe(false);
  fireEvent.click(screen.getByRole('tab', { name: /유의 사항/ }));
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('tab', { name: '자료실 입장' }));
  expect((screen.getByLabelText('비밀번호') as HTMLInputElement).disabled).toBe(true);
});

it('rejects a wrong password and admits the configured password after consent, without storing it', async () => {
  render(<AccessGate catalog={catalog}><p>protected screen</p></AccessGate>);
  confirmNotice();
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'wrong' } });
  fireEvent.click(screen.getByRole('button', { name: '자료실 입장하기' }));
  await waitFor(() => expect(screen.getByText(/비밀번호가 맞지 않습니다/)).toBeTruthy());
  expect(hasAccessSession()).toBe(false); expect(screen.queryByText('protected screen')).toBeNull();
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: configuredPassword } });
  fireEvent.click(screen.getByRole('button', { name: '자료실 입장하기' }));
  await waitFor(() => expect(screen.getByText('protected screen')).toBeTruthy());
  expect(hasAccessSession()).toBe(true);
  expect(sessionStorage.getItem(ACCESS_SESSION_KEY)).not.toContain(configuredPassword);
  cleanup(); render(<AccessGate catalog={catalog}><p>same tab</p></AccessGate>);
  expect(screen.getByText('same tab')).toBeTruthy();
  sessionStorage.clear(); cleanup(); render(<AccessGate catalog={catalog}><p>fresh tab</p></AccessGate>);
  expect(screen.queryByText('fresh tab')).toBeNull();
});

it('does not admit when hashing fails, and admits in memory when session storage is unavailable', async () => {
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  render(<AccessGate catalog={catalog}><p>admitted</p></AccessGate>); confirmNotice();
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: configuredPassword } });
  vi.stubGlobal('crypto', {});
  fireEvent.click(screen.getByRole('button', { name: '자료실 입장하기' }));
  await waitFor(() => expect(screen.getByText(/확인을 완료하지 못했습니다/)).toBeTruthy());
  expect(screen.queryByText('admitted')).toBeNull();
  vi.stubGlobal('crypto', webcrypto); fireEvent.click(screen.getByRole('button', { name: '자료실 입장하기' }));
  await waitFor(() => expect(screen.getByText('admitted')).toBeTruthy());
  expect(storage).toHaveBeenCalled(); expect(hasAccessSession()).toBe(false);
});

it('shows catalog loading and error independently from a valid zero count and supports retry', () => {
  const { rerender } = render(<AccessGate catalog={{ ...catalog, loading: true }}>child</AccessGate>);
  expect(screen.getByText('불러오는 중')).toBeTruthy();
  rerender(<AccessGate catalog={{ ...catalog, error: 'network' }}>child</AccessGate>);
  fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' })); expect(catalog.retry).toHaveBeenCalled();
  expect(screen.queryByText('불러오는 중')).toBeNull();
  rerender(<AccessGate catalog={catalog}>child</AccessGate>);
  expect(screen.getByText('0')).toBeTruthy();
});

it('verifies the exact password including whitespace and case', async () => {
  expect(await verifyAccessPassword(configuredPassword)).toBe(true);
  expect(await verifyAccessPassword(configuredPassword.toUpperCase())).toBe(false);
  expect(await verifyAccessPassword(` ${configuredPassword}`)).toBe(false);
});
