import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Upload from '../src/pages/Upload';
import { recordFixture } from './fixtures.mjs';
import { createSubmission } from '../src/lib/submission';

vi.mock('../src/lib/parsers/analyze', () => ({ analyzeFile: vi.fn(async (file: File) => ({ plan: recordFixture(new TextEncoder().encode(file.name), { title: file.name, originalFileName: file.name }), confidence: '확인 필요' })) }));
vi.mock('../src/lib/submission', () => ({ createSubmission: vi.fn() }));
vi.mock('../src/lib/download', () => ({ saveBlob: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('edits each file independently, preserves Enter and locks edits during ZIP creation', async () => {
  const user = userEvent.setup();
  render(<Upload publishedPlans={[]} />);
  await user.upload(screen.getByLabelText('지도안 파일 선택'), [new File(['first'], 'first.hwpx'), new File(['second'], 'second.hwpx')]);
  await waitFor(() => expect(screen.getByRole('button', { name: 'second.hwpx 분류 수정' }).hasAttribute('disabled')).toBe(false));
  await user.click(screen.getByRole('button', { name: 'first.hwpx 분류 수정' }));
  await user.clear(screen.getByLabelText('자료 제목')); await user.type(screen.getByLabelText('자료 제목'), '첫 파일 수정');
  const textarea = screen.getByLabelText('학습 목표 (한 줄에 하나)') as HTMLTextAreaElement;
  await user.clear(textarea); await user.type(textarea, '첫 목표{Enter}'); expect(textarea.value).toBe('첫 목표\n');
  await user.type(textarea, '두 번째 목표'); expect(textarea.value).toBe('첫 목표\n두 번째 목표');
  await user.click(screen.getByRole('button', { name: 'second.hwpx 분류 수정' }));
  expect((screen.getByLabelText('자료 제목') as HTMLInputElement).value).toBe('second.hwpx');
  await user.click(screen.getByRole('button', { name: 'first.hwpx 분류 수정' }));
  expect((screen.getByLabelText('자료 제목') as HTMLInputElement).value).toBe('첫 파일 수정');
  let finish!: (value: { blob: Blob; submissionId: string }) => void;
  vi.mocked(createSubmission).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const privacy = screen.getByLabelText(/학생 이름, 연락처, 사진 등 개인정보가/);
  await user.click(privacy); await user.click(screen.getByLabelText(/저작권 및 배포 권한을/));
  await user.click(screen.getByRole('button', { name: '관리자 제출용 ZIP 다운로드' }));
  expect((screen.getByRole('group', { name: '분류 수정' }) as HTMLFieldSetElement).disabled).toBe(true);
  expect((privacy as HTMLInputElement).disabled).toBe(true);
  await act(async () => finish({ blob: new Blob(['test']), submissionId: 'test' }));
  expect((screen.getByRole('group', { name: '분류 수정' }) as HTMLFieldSetElement).disabled).toBe(false);
});
