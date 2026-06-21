import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth.service.js';

const mockUser = {
  id: 'user-uuid-1',
  email: 'tima@example.com',
  name: 'Tima',
  passwordHash: '$2b$12$hashedpassword',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const mockPrismaService = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  stockItem: {
    deleteMany: vi.fn(),
  },
  ocrJob: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

const mockJwtService = {
  sign: vi.fn(),
  verify: vi.fn(),
};

const mockStorageService = {
  deleteObject: vi.fn(),
};

vi.mock('bcrypt', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env['JWT_SECRET'] = 'test-secret';
    process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret';

    service = new AuthService(
      mockPrismaService as never,
      mockJwtService as unknown as JwtService,
      mockStorageService as never,
    );
  });

  describe('register', () => {
    it('creates a user and returns tokens', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashedpw' as never);
      mockJwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');

      const result = await service.register({
        email: 'tima@example.com',
        password: 'password123',
        name: 'Tima',
      });

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'tima@example.com' },
      });
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: 'tima@example.com',
          name: 'Tima',
          passwordHash: 'hashedpw',
        },
      });
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
      });
    });

    it('throws ConflictException when email is already in use', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.register({ email: 'tima@example.com', password: 'password123' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('returns tokens when credentials are valid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      mockJwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');

      const result = await service.login({
        email: 'tima@example.com',
        password: 'password123',
      });

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user.email).toBe('tima@example.com');
    });

    it('throws UnauthorizedException when password is invalid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(
        service.login({ email: 'tima@example.com', password: 'wrongpass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user is not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'unknown@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('returns a new access token when refresh token is valid', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-uuid-1',
        email: 'tima@example.com',
        type: 'refresh',
      });
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('new-access-token');

      const result = await service.refresh('valid-refresh-token');

      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-refresh-token', {
        secret: 'test-refresh-secret',
      });
      expect(result.accessToken).toBe('new-access-token');
    });

    it('throws UnauthorizedException when refresh token is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.refresh('invalid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when token type is not refresh', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-uuid-1',
        email: 'tima@example.com',
        type: 'access',
      });

      await expect(service.refresh('access-token-used-as-refresh')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when the account was deleted', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-uuid-1',
        email: 'tima@example.com',
        type: 'refresh',
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        deletedAt: new Date(),
      });

      await expect(service.refresh('valid-refresh-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getMe', () => {
    it('returns the user without the password hash', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getMe('user-uuid-1');

      expect(result).toEqual({ id: 'user-uuid-1', email: 'tima@example.com', name: 'Tima' });
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('throws NotFoundException when the user is deleted', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        deletedAt: new Date(),
      });

      await expect(service.getMe('user-uuid-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteAccount', () => {
    it('cascades deletion and anonymizes the user (RGPD Article 17)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.ocrJob.findMany.mockResolvedValue([
        { imageKey: 'receipts/user-uuid-1/job-1.jpg' },
      ]);
      mockPrismaService.$transaction.mockResolvedValue([]);
      mockStorageService.deleteObject.mockResolvedValue(undefined);

      await service.deleteAccount('user-uuid-1');

      expect(mockPrismaService.stockItem.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1' },
      });
      expect(mockPrismaService.ocrJob.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1' },
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
          email: 'deleted-user-uuid-1@anonymized.invalid',
          name: null,
          passwordHash: '!deleted',
        }),
      });
      expect(mockStorageService.deleteObject).toHaveBeenCalledWith(
        'receipts/user-uuid-1/job-1.jpg',
      );
    });

    it('throws NotFoundException when the user is already deleted', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        deletedAt: new Date(),
      });

      await expect(service.deleteAccount('user-uuid-1')).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('still succeeds when R2 image deletion fails (best-effort cleanup)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.ocrJob.findMany.mockResolvedValue([
        { imageKey: 'receipts/user-uuid-1/job-1.jpg' },
      ]);
      mockPrismaService.$transaction.mockResolvedValue([]);
      mockStorageService.deleteObject.mockRejectedValue(new Error('R2 unavailable'));

      await expect(service.deleteAccount('user-uuid-1')).resolves.toBeUndefined();
    });
  });
});
