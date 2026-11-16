import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((error: unknown) => {
  Logger.error(
    'Application failed to start',
    error instanceof Error ? error.stack : String(error),
  );
  process.exit(1);
});
