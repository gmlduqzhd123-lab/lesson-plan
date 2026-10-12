// Older browsers may provide Web Crypto without crypto.randomUUID.
// Both draft keys and submission manifest IDs need a secure UUID v4.
export function createUuid(): string {
  const source = globalThis.crypto;
  if (!source?.getRandomValues) throw new Error('파일 처리를 시작하지 못했습니다. 최신 브라우저에서 HTTPS 주소로 다시 접속해주세요.');
  if (typeof source.randomUUID === 'function') return source.randomUUID();
  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
