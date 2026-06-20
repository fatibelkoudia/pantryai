import {
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OcrService } from '../ocr/ocr.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthResponseDto } from './dto/auth-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

const SALT_ROUNDS = 12;

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface RefreshPayload {
  sub: string;
  email: string;
  type: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => OcrService))
    private readonly ocrService: OcrService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email is already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name ?? null,
        passwordHash,
      },
    });

    const tokens = this.signTokens(user.id, user.email);

    return {
      ...tokens,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = this.signTokens(user.id, user.email);

    return {
      ...tokens,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  // Used by the clients to load the signed-in user again after a cold start, when
  // they only have a token back from the refresh cookie and not the user yet.
  async getMe(userId: string): Promise<AuthResponseDto['user']> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }
    return { id: user.id, email: user.email, name: user.name };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    const refreshSecret = process.env['JWT_REFRESH_SECRET'];
    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET environment variable is not set');
    }

    let payload: RefreshPayload;
    try {
      payload = this.jwtService.verify<RefreshPayload>(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Refresh tokens are stateless; reject if the account was deleted since issuance (RGPD)
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const accessToken = this.jwtService.sign(
      { sub: payload.sub, email: payload.email },
      { expiresIn: '15m' },
    );

    return { accessToken };
  }

  /**
   * RGPD Article 17 — right to erasure.
   * Hard deletes stock items and OCR jobs (food consumption data = PII),
   * removes any receipt images still in R2, then anonymizes and soft-deletes the user
   * so the row satisfies FK integrity without retaining personal data.
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    // Images for COMPLETED/FAILED jobs are already deleted by the OCR processor;
    // only unprocessed jobs can still have a live R2 object.
    const pendingJobs = await this.prisma.ocrJob.findMany({
      where: {
        userId,
        imageKey: { not: null },
        status: { in: ['PENDING', 'PROCESSING'] },
      },
      select: { imageKey: true },
    });

    await this.prisma.$transaction([
      this.prisma.stockItem.deleteMany({ where: { userId } }),
      this.prisma.ocrJob.deleteMany({ where: { userId } }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          email: `deleted-${userId}@anonymized.invalid`,
          name: null,
          passwordHash: '!deleted', // '!' prefix is never a valid bcrypt hash — login impossible
        },
      }),
    ]);

    await Promise.all(
      pendingJobs.map((job) =>
        job.imageKey
          ? this.ocrService.deleteImageFromR2(job.imageKey).catch(() => undefined)
          : Promise.resolve(),
      ),
    );
  }

  private signTokens(userId: string, email: string): TokenPair {
    const refreshSecret = process.env['JWT_REFRESH_SECRET'];
    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET environment variable is not set');
    }

    const accessToken = this.jwtService.sign({ sub: userId, email }, { expiresIn: '15m' });

    const refreshToken = this.jwtService.sign(
      { sub: userId, email, type: 'refresh' },
      { secret: refreshSecret, expiresIn: '7d' },
    );

    return { accessToken, refreshToken };
  }
}
