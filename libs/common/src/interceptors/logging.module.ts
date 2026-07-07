import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { AppConfigModule } from '../config/config.module';
import { AppConfigService } from '../config/app-config.service';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (configService: AppConfigService) => ({
        pinoHttp: {
          level: configService.nodeEnv === 'production' ? 'info' : 'debug',
          autoLogging: false,
          genReqId: (req: Request, res: Response) => {
            const header = req.headers['x-correlation-id'];
            const correlationId =
              typeof header === 'string' && header.length > 0
                ? header
                : randomUUID();
            res.setHeader('X-Correlation-ID', correlationId);
            return correlationId;
          },
        },
      }),
    }),
  ],
})
export class LoggingModule {}
