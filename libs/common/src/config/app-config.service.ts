import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get databaseUrl(): string {
    return this.configService.getOrThrow<string>('DATABASE_URL');
  }

  get redisUrl(): string {
    return this.configService.getOrThrow<string>('REDIS_URL');
  }

  get jwtSecret(): string {
    return this.configService.getOrThrow<string>('JWT_SECRET');
  }

  get jwtRefreshSecret(): string {
    return this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  get fcmProjectId(): string {
    return this.configService.getOrThrow<string>('FCM_PROJECT_ID');
  }

  get fcmClientEmail(): string {
    return this.configService.getOrThrow<string>('FCM_CLIENT_EMAIL');
  }

  get fcmPrivateKey(): string {
    return this.configService.getOrThrow<string>('FCM_PRIVATE_KEY');
  }

  get sentryDsn(): string {
    return this.configService.getOrThrow<string>('SENTRY_DSN');
  }

  get nodeEnv(): string {
    return this.configService.getOrThrow<string>('NODE_ENV');
  }

  get port(): number {
    return this.configService.getOrThrow<number>('PORT');
  }
}
