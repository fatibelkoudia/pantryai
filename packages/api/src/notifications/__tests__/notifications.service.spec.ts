import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsService } from '../notifications.service.js';

const mockPrismaService = {
  stockItem: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  userDevice: {
    findMany: vi.fn(),
  },
};

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: 'stock-1',
    userId: 'user-1',
    product: { name: 'Greek Yogurt' },
    ...overrides,
  };
}

function device(overrides: Record<string, unknown> = {}) {
  return {
    id: 'device-1',
    userId: 'user-1',
    expoPushToken: 'ExponentPushToken[aaa]',
    platform: 'ios',
    ...overrides,
  };
}

describe('NotificationsService', () => {
  let service: NotificationsService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) });
    vi.stubGlobal('fetch', fetchMock);
    service = new NotificationsService(mockPrismaService as never);
  });

  it('queries only items expiring within 3 days, not yet notified, not soft-deleted', async () => {
    mockPrismaService.stockItem.findMany.mockResolvedValue([]);

    await service.checkExpiringItems();

    const where = mockPrismaService.stockItem.findMany.mock.calls[0]![0].where;
    expect(where).toMatchObject({
      deletedAt: null,
      expirationNotifiedAt: null,
      expirationDate: expect.objectContaining({ not: null }),
    });
    // the upper bound is roughly 3 days out
    const lte = where.expirationDate.lte as Date;
    const diffDays = (lte.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeGreaterThan(2.9);
    expect(diffDays).toBeLessThan(3.1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends exactly one push and stamps the item when one item + one device exist', async () => {
    mockPrismaService.stockItem.findMany.mockResolvedValue([item()]);
    mockPrismaService.userDevice.findMany.mockResolvedValue([device()]);

    await service.checkExpiringItems();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://exp.host/--/api/v2/push/send');
    const payload = JSON.parse(init.body);
    expect(payload).toHaveLength(1);
    expect(payload[0].to).toBe('ExponentPushToken[aaa]');
    expect(payload[0].title).toBe('Food expiring soon');

    expect(mockPrismaService.stockItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['stock-1'] } },
      data: { expirationNotifiedAt: expect.any(Date) },
    });
  });

  it('sends one push per registered device (acceptance criterion)', async () => {
    mockPrismaService.stockItem.findMany.mockResolvedValue([item()]);
    mockPrismaService.userDevice.findMany.mockResolvedValue([
      device({ id: 'device-1', expoPushToken: 'ExponentPushToken[aaa]' }),
      device({ id: 'device-2', expoPushToken: 'ExponentPushToken[bbb]' }),
    ]);

    await service.checkExpiringItems();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(payload.map((m: { to: string }) => m.to)).toEqual([
      'ExponentPushToken[aaa]',
      'ExponentPushToken[bbb]',
    ]);
  });

  it('does not notify or stamp a user with no devices', async () => {
    mockPrismaService.stockItem.findMany.mockResolvedValue([item()]);
    mockPrismaService.userDevice.findMany.mockResolvedValue([]);

    await service.checkExpiringItems();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockPrismaService.stockItem.updateMany).not.toHaveBeenCalled();
  });

  it('does nothing when there are no expiring items', async () => {
    mockPrismaService.stockItem.findMany.mockResolvedValue([]);

    await service.checkExpiringItems();

    expect(mockPrismaService.userDevice.findMany).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
