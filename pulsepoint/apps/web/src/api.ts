const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000/api/v1';

export type FeedbackItem = {
  id: string;
  type: string;
  message: string | null;
  rating: number | null;
  submitterEmail?: string | null;
  submitterDisplayName?: string | null;
  status: string;
  createdAt?: string;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  const body = await response.json().catch(() => undefined);
  if (!response.ok) throw new Error(body?.error?.message ?? 'Request failed');
  return body as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: { email: string; role: 'admin' | 'member' } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  listFeedback: (query = '') => request<{ items: FeedbackItem[]; total: number }>(`/feedback${query}`),
  getFeedback: (id: string) => request<FeedbackItem & { notes: Array<{ id: string; body: string; authorEmail: string }> }>(`/feedback/${id}`),
  patchFeedback: (id: string, payload: { status?: string; assigneeMembershipId?: string | null }) =>
    request(`/feedback/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  addNote: (id: string, body: string) =>
    request(`/feedback/${id}/notes`, { method: 'POST', body: JSON.stringify({ body }) }),
  stats: () =>
    request<{ byStatus: Array<{ status: string; count: number }>; byType: Array<{ type: string; count: number }>; avgRating: number | null }>('/stats'),
  settings: () => request<{ accentColor: string; promptText: string; enabledTypes: string[] }>('/settings')
};
