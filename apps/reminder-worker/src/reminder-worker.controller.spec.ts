import { Test, TestingModule } from '@nestjs/testing';
import { ReminderWorkerController } from './reminder-worker.controller';
import { ReminderWorkerService } from './reminder-worker.service';

describe('ReminderWorkerController', () => {
  let reminderWorkerController: ReminderWorkerController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ReminderWorkerController],
      providers: [ReminderWorkerService],
    }).compile();

    reminderWorkerController = app.get<ReminderWorkerController>(ReminderWorkerController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(reminderWorkerController.getHello()).toBe('Hello World!');
    });
  });
});
