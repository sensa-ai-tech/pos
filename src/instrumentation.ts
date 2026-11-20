import { getSessionSecret } from '@/lib/session';

// Fail fast at server start when SESSION_SECRET is missing or too short.
export function register() {
  getSessionSecret();
}
