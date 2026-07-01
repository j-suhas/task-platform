import { Module } from '@nestjs/common';
import { ReminderWorkerController } from './reminder-worker.controller';
import { ReminderWorkerService } from './reminder-worker.service';

@Module({
  imports: [],
  controllers: [ReminderWorkerController],
  providers: [ReminderWorkerService],
})
export class ReminderWorkerModule {}
