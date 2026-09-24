import { createClient } from '@supabase/supabase-js';
export const evaluationAPI = (process.env.NEXT_PUBLIC_EVALUATION_API_URL || '').replace(/\/$/, '');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
let client: ReturnType<typeof createClient> | null = null;
export function evaluationAuth() {
  if (!client && url && key) client = createClient(url, key);
  return client;
}
export async function evaluationRequest(path: string, options: RequestInit = {}, publicOK = false) {
  const session = (await evaluationAuth()?.auth.getSession())?.data.session;
  if (!session && !publicOK) throw new Error('Please log in to continue.');
  const response = await fetch(evaluationAPI + path, { ...options, cache: 'no-store', headers: {
    'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}), ...options.headers,
  } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === 'string' ? body.detail : `Request failed (${response.status}).`);
  }
  return response;
}
export type EvaluationJob = {
  id: string; name: string; state: string; stage: string; engine: string; has_artifacts: boolean;
  error_code: string | null; visibility: 'private' | 'public'; constitution: string;
  models_count: number; scenario_count: number; created_at: number; funding: string;
};
