import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaModule } from '../prisma/prisma.module';
import { AppConfigModule } from '../config/config.module';
import { AppConfigService } from '../config/app-config.service';
import { HealthController } from './health.controller';
import { REDIS_CLIENT } from './redis-client.token';

@Module({
  imports: [PrismaModule, AppConfigModule],
  controllers: [HealthController],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: AppConfigService) =>
        new Redis(configService.redisUrl, { lazyConnect: true }),
      inject: [AppConfigService],
    },
  ],
})
export class HealthModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  onModuleDestroy() {
    this.redis.disconnect();
  }
}
