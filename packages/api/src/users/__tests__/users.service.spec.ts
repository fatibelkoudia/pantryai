import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersService } from '../users.service.js';

const mockUser = {
  id: 'user-uuid-1',
  email: 'tima@example.com',
  name: 'Tima',
  avatarId: null,
  onboardingCompletedAt: null,
  passwordHash: '$2b$12$hashedpassword',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const mockSettings = {
  userId: 'user-uuid-1',
  locale: 'en',
  recipeMinMatchedItems: 1,
  recipeMatchThreshold: 0.7,
  expiringSoonDays: 3,
  lowStockThreshold: 1,
  defaultStockLocation: 'PANTRY',
  updatedAt: new Date(),
};

const mockPrismaService = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  userSettings: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
};

vi.mock('bcrypt', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
}));

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UsersService(mockPrismaService as never);
    mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
  });

  describe('updateProfile', () => {
    it('updates name and avatar and returns the profile', async () => {
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        name: 'Fatima',
        avatarId: 'tomato',
      });

      const result = await service.updateProfile('user-uuid-1', {
        name: 'Fatima',
        avatarId: 'tomato',
      });

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: { name: 'Fatima', avatarId: 'tomato' },
      });
      expect(result.name).toBe('Fatima');
      expect(result.avatarId).toBe('tomato');
      // never leak the hash in the response
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('rejects an email already used by another account', async () => {
      // first call finds the caller, second call finds someone on the new email
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce({ ...mockUser, id: 'someone-else' });

      await expect(
        service.updateProfile('user-uuid-1', { email: 'taken@example.com' }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('skips the uniqueness check when the email did not change', async () => {
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      await service.updateProfile('user-uuid-1', { email: 'tima@example.com' });

      // only the initial "does the caller exist" lookup, no email lookup
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException for a deleted account', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ ...mockUser, deletedAt: new Date() });

      await expect(service.updateProfile('user-uuid-1', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('completeOnboarding', () => {
    it('stamps the completion date when it was never set', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        onboardingCompletedAt: new Date(),
      });

      const result = await service.completeOnboarding('user-uuid-1');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: { onboardingCompletedAt: expect.any(Date) },
      });
      expect(result.onboardingCompletedAt).toBeInstanceOf(Date);
    });

    it('is idempotent: does not overwrite an existing completion date', async () => {
      const alreadyDone = new Date('2026-01-01T00:00:00.000Z');
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        onboardingCompletedAt: alreadyDone,
      });

      const result = await service.completeOnboarding('user-uuid-1');

      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
      expect(result.onboardingCompletedAt).toBe(alreadyDone);
    });

    it('throws NotFoundException for a deleted account', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ ...mockUser, deletedAt: new Date() });

      await expect(service.completeOnboarding('user-uuid-1')).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('rejects a wrong current password with a 401', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(
        service.changePassword('user-uuid-1', {
          currentPassword: 'wrong',
          newPassword: 'newpassword1',
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('hashes and stores the new password when the current one checks out', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(bcrypt.hash).mockResolvedValue('new-hash' as never);

      await service.changePassword('user-uuid-1', {
        currentPassword: 'oldpassword1',
        newPassword: 'newpassword1',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword1', 12);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: { passwordHash: 'new-hash' },
      });
    });
  });

  describe('settings', () => {
    it('creates the row with defaults on first read', async () => {
      mockPrismaService.userSettings.upsert.mockResolvedValue(mockSettings);

      const result = await service.getSettings('user-uuid-1');

      expect(mockPrismaService.userSettings.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1' },
        create: { userId: 'user-uuid-1' },
        update: {},
      });
      expect(result.recipeMatchThreshold).toBeCloseTo(0.7);
    });

    it('applies a partial update on top of the defaults', async () => {
      mockPrismaService.userSettings.upsert.mockResolvedValue({
        ...mockSettings,
        recipeMinMatchedItems: 3,
      });

      await service.updateSettings('user-uuid-1', { recipeMinMatchedItems: 3 });

      expect(mockPrismaService.userSettings.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1' },
        create: { userId: 'user-uuid-1', recipeMinMatchedItems: 3 },
        update: { recipeMinMatchedItems: 3 },
      });
    });

    it('refuses settings access for a deleted account', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ ...mockUser, deletedAt: new Date() });

      await expect(service.getSettings('user-uuid-1')).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.userSettings.upsert).not.toHaveBeenCalled();
    });
  });
});
