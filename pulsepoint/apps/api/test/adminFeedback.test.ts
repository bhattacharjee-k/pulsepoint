import { beforeEach, describe, expect, it } from 'vitest';
import { login, resetDb, type SeedState, useApi } from './helpers/db.js';

describe('admin feedback API', () => {
  const getApp = useApi();
  let seed: SeedState;

  beforeEach(async () => {
    seed = await resetDb();
  });

  it('lists only Alpha items with pagination and filters', async () => {
    const cookie = await login(getApp(), 'admin@alpha.com');
    const list = await getApp().inject({ method: 'GET', url: '/api/v1/feedback?limit=2&offset=0', headers: { cookie } });
    expect(list.statusCode).toBe(200);
    const body = list.json<{ items: Array<{ message: string }>; total: number }>();
    expect(body.total).toBe(3);
    expect(body.items).toHaveLength(2);
    expect(body.items.every((item) => item.message?.startsWith('Alpha') || item.message === null)).toBe(true);

    const status = await getApp().inject({ method: 'GET', url: '/api/v1/feedback?status=open', headers: { cookie } });
    expect(status.json<{ total: number }>().total).toBe(1);

    const type = await getApp().inject({ method: 'GET', url: '/api/v1/feedback?type=feature', headers: { cookie } });
    expect(type.json<{ total: number }>().total).toBe(1);
  });

  it('patches own tenant feedback and hides cross-tenant ids', async () => {
    const cookie = await login(getApp(), 'admin@alpha.com');
    const updated = await getApp().inject({
      method: 'PATCH',
      url: `/api/v1/feedback/${seed.alphaFeedbackId}`,
      headers: { cookie },
      payload: { status: 'resolved' }
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json<{ status: string }>().status).toBe('resolved');

    const crossTenant = await getApp().inject({
      method: 'PATCH',
      url: `/api/v1/feedback/${seed.deltaFeedbackId}`,
      headers: { cookie },
      payload: { status: 'resolved' }
    });
    expect(crossTenant.statusCode).toBe(404);
  });

  it('gates settings to admins', async () => {
    const memberCookie = await login(getApp(), 'member@alpha.com');
    const member = await getApp().inject({ method: 'GET', url: '/api/v1/settings', headers: { cookie: memberCookie } });
    expect(member.statusCode).toBe(403);

    const adminCookie = await login(getApp(), 'admin@alpha.com');
    const admin = await getApp().inject({ method: 'GET', url: '/api/v1/settings', headers: { cookie: adminCookie } });
    expect(admin.statusCode).toBe(200);
  });

  it('returns tenant-scoped stats', async () => {
    const cookie = await login(getApp(), 'admin@alpha.com');
    const response = await getApp().inject({ method: 'GET', url: '/api/v1/stats', headers: { cookie } });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ byStatus: Array<{ status: string; count: number }>; byType: Array<{ type: string; count: number }> }>();
    expect(body.byStatus.reduce((sum, row) => sum + row.count, 0)).toBe(3);
    expect(body.byType.find((row) => row.type === 'bug')?.count).toBe(1);
  });
});
