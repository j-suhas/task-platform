import { NestFactory } from '@nestjs/core';
import { ReminderWorkerModule } from './reminder-worker.module';

async function bootstrap() {
  const app = await NestFactory.create(ReminderWorkerModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
