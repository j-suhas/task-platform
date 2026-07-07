import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import {
  CommonModule,
  GlobalExceptionFilter,
  LoggingInterceptor,
} from '@app/common';
import { ReminderWorkerController } from './reminder-worker.controller';
import { ReminderWorkerService } from './reminder-worker.service';

@Module({
  imports: [CommonModule],
  controllers: [ReminderWorkerController],
  providers: [
    ReminderWorkerService,
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class ReminderWorkerModule {}
