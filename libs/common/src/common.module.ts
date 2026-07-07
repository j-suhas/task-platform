import { Module } from '@nestjs/common';
import { AppConfigModule } from './config';
import { PrismaModule } from './prisma';
import { LoggingModule } from './interceptors';
import { HealthModule } from './health';

@Module({
  imports: [AppConfigModule, PrismaModule, LoggingModule, HealthModule],
  exports: [AppConfigModule, PrismaModule],
})
export class CommonModule {}
