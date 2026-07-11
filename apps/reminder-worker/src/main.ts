import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppConfigService } from '@app/common';
import { ReminderWorkerModule } from './reminder-worker.module';

async function bootstrap() {
  const app = await NestFactory.create(ReminderWorkerModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  const configService = app.get(AppConfigService);
  await app.listen(configService.port);
}
void bootstrap();
