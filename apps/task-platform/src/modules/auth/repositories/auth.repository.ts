import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/common';
import { RefreshToken, User } from '@prisma/client';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  createUser(data: {
    email: string;
    name: string;
    passwordHash: string;
  }): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async createRefreshToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.refreshToken.create({
      data: { userId, token: tokenHash, expiresAt },
    });
  }

  findRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({
      where: { token: tokenHash },
    });
  }

  async deleteRefreshToken(tokenHash: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { token: tokenHash },
    });
  }

  async upsertFcmToken(
    userId: string,
    deviceId: string,
    token: string,
  ): Promise<void> {
    await this.prisma.fcmToken.upsert({
      where: { userId_deviceId: { userId, deviceId } },
      create: { userId, deviceId, token },
      update: { token },
    });
  }

  async deleteFcmToken(userId: string, deviceId: string): Promise<void> {
    await this.prisma.fcmToken.deleteMany({ where: { userId, deviceId } });
  }
}
