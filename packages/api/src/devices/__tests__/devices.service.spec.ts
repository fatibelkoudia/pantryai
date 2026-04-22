import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DevicesService } from '../devices.service.js';

const mockPrismaService = {
  userDevice: {
    upsert: vi.fn(),
  },
};

describe('DevicesService', () => {
  let service: DevicesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DevicesService(mockPrismaService as never);
  });

  it('upserts the device keyed on the push token', async () => {
    const device = {
      id: 'device-1',
      userId: 'user-1',
      expoPushToken: 'ExponentPushToken[aaa]',
      platform: 'ios',
    };
    mockPrismaService.userDevice.upsert.mockResolvedValue(device);

    const result = await service.register('user-1', {
      expoPushToken: 'ExponentPushToken[aaa]',
      platform: 'ios',
    });

    expect(result).toEqual(device);
    expect(mockPrismaService.userDevice.upsert).toHaveBeenCalledWith({
      where: { expoPushToken: 'ExponentPushToken[aaa]' },
      update: { userId: 'user-1', platform: 'ios' },
      create: { userId: 'user-1', expoPushToken: 'ExponentPushToken[aaa]', platform: 'ios' },
    });
  });
});
