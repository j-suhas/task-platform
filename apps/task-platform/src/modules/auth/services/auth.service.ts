import { createHash } from 'crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '@app/common';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthRepository } from '../repositories/auth.repository';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import {
  ACCESS_TOKEN_TTL,
  BCRYPT_ROUNDS,
  REFRESH_TOKEN_TTL,
  REFRESH_TOKEN_TTL_MS,
} from '../auth.constants';

type SanitizedUser = Omit<User, 'passwordHash'>;

interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly appConfigService: AppConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<SanitizedUser> {
    const existing = await this.authRepository.findUserByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.authRepository.createUser({
      email: dto.email,
      name: dto.name,
      passwordHash,
    });

    return this.sanitize(user);
  }

  async login(dto: LoginDto): Promise<AuthTokenPair> {
    const user = await this.authRepository.findUserByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      { secret: this.appConfigService.jwtSecret, expiresIn: ACCESS_TOKEN_TTL },
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id },
      {
        secret: this.appConfigService.jwtRefreshSecret,
        expiresIn: REFRESH_TOKEN_TTL,
      },
    );

    await this.authRepository.createRefreshToken(
      user.id,
      this.hashToken(refreshToken),
      new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    );

    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string): Promise<AuthTokenPair> {
    let payload: { sub: string };
    try {
      payload = await this.jwtService.verifyAsync<{ sub: string }>(
        refreshToken,
        { secret: this.appConfigService.jwtRefreshSecret },
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.authRepository.findRefreshToken(tokenHash);
    if (!stored) {
      throw new UnauthorizedException('Refresh token already used or unknown');
    }

    // TODO: concurrent refresh requests for the same token aren't mutex-protected.
    // A Redis-based lock keyed on the token hash is the intended post-MVP hardening.
    await this.authRepository.deleteRefreshToken(tokenHash);

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const user = await this.authRepository.findUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      { secret: this.appConfigService.jwtSecret, expiresIn: ACCESS_TOKEN_TTL },
    );

    const newRefreshToken = await this.jwtService.signAsync(
      { sub: user.id },
      {
        secret: this.appConfigService.jwtRefreshSecret,
        expiresIn: REFRESH_TOKEN_TTL,
      },
    );

    await this.authRepository.createRefreshToken(
      user.id,
      this.hashToken(newRefreshToken),
      new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    );

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.authRepository.deleteRefreshToken(this.hashToken(refreshToken));
  }

  async registerFcmToken(
    userId: string,
    deviceId: string,
    token: string,
  ): Promise<void> {
    await this.authRepository.upsertFcmToken(userId, deviceId, token);
  }

  async removeFcmToken(userId: string, deviceId: string): Promise<void> {
    await this.authRepository.deleteFcmToken(userId, deviceId);
  }

  async getCurrentUser(userId: string): Promise<SanitizedUser> {
    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.sanitize(user);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private sanitize(user: User): SanitizedUser {
    const sanitized: Partial<User> = { ...user };
    delete sanitized.passwordHash;
    return sanitized as SanitizedUser;
  }
}
