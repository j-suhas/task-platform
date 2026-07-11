import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from './redis-client.token';
import { Public } from '../decorators';

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Public()
  @Get('health')
  liveness() {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  async readiness(@Res({ passthrough: true }) res: Response) {
    const result = { status: 'ok', db: 'ok', redis: 'ok' };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      result.db = 'error';
      result.status = 'error';
    }

    try {
      const pong = await this.redis.ping();
      if (pong !== 'PONG') throw new Error('unexpected PING response');
    } catch {
      result.redis = 'error';
      result.status = 'error';
    }

    if (result.status === 'error') {
      res.status(503);
    }

    return result;
  }
}
