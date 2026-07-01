import { Injectable } from '@nestjs/common';

@Injectable()
export class ReminderWorkerService {
  getHello(): string {
    return 'Hello World!';
  }
}
