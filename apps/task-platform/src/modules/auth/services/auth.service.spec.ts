import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '@prisma/client';
import { AuthService } from './auth.service';
import { AuthRepository } from '../repositories/auth.repository';
import { AppConfigService } from '@app/common';

jest.mock('bcryptjs');

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: 'hashed-password',
    digestTime: '07:00',
    timezone: 'Asia/Kolkata',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let repository: jest.Mocked<AuthRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let appConfigService: jest.Mocked<AppConfigService>;

  beforeEach(() => {
    repository = {
      findUserByEmail: jest.fn(),
      findUserById: jest.fn(),
      createUser: jest.fn(),
      createRefreshToken: jest.fn(),
      findRefreshToken: jest.fn(),
      deleteRefreshToken: jest.fn(),
      upsertFcmToken: jest.fn(),
      deleteFcmToken: jest.fn(),
    } as unknown as jest.Mocked<AuthRepository>;

    jwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    appConfigService = {
      jwtSecret: 'access-secret',
      jwtRefreshSecret: 'refresh-secret',
    } as unknown as jest.Mocked<AppConfigService>;

    service = new AuthService(repository, jwtService, appConfigService);

    jest.clearAllMocks();
  });

  describe('register', () => {
    it('creates a user and returns it without passwordHash', async () => {
      repository.findUserByEmail.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashed-password' as never);
      repository.createUser.mockResolvedValue(makeUser());

      const result = await service.register({
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
      });

      expect(result).not.toHaveProperty('passwordHash');
      expect(repository.createUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashed-password',
      });
    });

    it('throws ConflictException when the email is already taken', async () => {
      repository.findUserByEmail.mockResolvedValue(makeUser());

      await expect(
        service.register({
          email: 'test@example.com',
          name: 'Test User',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
      expect(repository.createUser).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns an access and refresh token on valid credentials', async () => {
      repository.findUserByEmail.mockResolvedValue(makeUser());
      mockedBcrypt.compare.mockResolvedValue(true as never);
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        1,
        { sub: 'user-1', email: 'test@example.com' },
        { secret: 'access-secret', expiresIn: '15m' },
      );
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        2,
        { sub: 'user-1' },
        { secret: 'refresh-secret', expiresIn: '30d' },
      );
      expect(repository.createRefreshToken).toHaveBeenCalledWith(
        'user-1',
        expect.any(String),
        expect.any(Date),
      );
    });

    it('throws UnauthorizedException when the email is unknown', async () => {
      repository.findUserByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'unknown@example.com', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the password does not match', async () => {
      repository.findUserByEmail.mockResolvedValue(makeUser());
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token and issues a new pair', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' });
      repository.findRefreshToken.mockResolvedValue({
        id: 'rt-1',
        token: 'hashed',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        createdAt: new Date(),
      });
      repository.findUserById.mockResolvedValue(makeUser());
      jwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');

      const result = await service.refresh('old-refresh-token');

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
      expect(repository.deleteRefreshToken).toHaveBeenCalledWith(
        expect.any(String),
      );
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('old-refresh-token', {
        secret: 'refresh-secret',
      });
    });

    it('throws UnauthorizedException when the JWT signature is invalid', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('bad signature'));

      await expect(service.refresh('garbage-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(repository.findRefreshToken).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the token was already rotated', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' });
      repository.findRefreshToken.mockResolvedValue(null);

      await expect(service.refresh('reused-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(repository.deleteRefreshToken).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the stored token has expired', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' });
      repository.findRefreshToken.mockResolvedValue({
        id: 'rt-1',
        token: 'hashed',
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
      });

      await expect(service.refresh('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(repository.deleteRefreshToken).toHaveBeenCalledWith(
        expect.any(String),
      );
      expect(repository.findUserById).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('deletes the refresh token', async () => {
      await service.logout('some-refresh-token');

      expect(repository.deleteRefreshToken).toHaveBeenCalledWith(
        expect.any(String),
      );
    });
  });
});
