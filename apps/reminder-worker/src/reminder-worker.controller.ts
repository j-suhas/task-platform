import { Controller, Get } from '@nestjs/common';
import { ReminderWorkerService } from './reminder-worker.service';

@Controller()
export class ReminderWorkerController {
  constructor(private readonly reminderWorkerService: ReminderWorkerService) {}

  @Get()
  getHello(): string {
    return this.reminderWorkerService.getHello();
  }
}
