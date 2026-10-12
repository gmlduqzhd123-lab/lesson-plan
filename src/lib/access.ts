// GitHub Pages UI gate only: public files remain reachable by their direct URLs.
const SALT = 'c21316361981661ade6843d32d40be8b';
const DIGEST = 'ded3667bb8b02b71c9c00b0e3ce77a7762c0e9d3d43e59adac6c4cdcb5ced584';
export const ACCESS_SESSION_KEY = 'lesson-plan:access:notice-2026-10-12:v1';

export async function verifyAccessPassword(password: string): Promise<boolean> {
  const bytes = new TextEncoder().encode(`${SALT}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') === DIGEST;
}

export function hasAccessSession(): boolean {
  try { return sessionStorage.getItem(ACCESS_SESSION_KEY) === DIGEST; }
  catch { return false; }
}

export function saveAccessSession(): void {
  // Store a versioned UI acknowledgment, never the entered password.
  try { sessionStorage.setItem(ACCESS_SESSION_KEY, DIGEST); }
  catch { /* Storage may be unavailable. In-memory admission still works. */ }
}
