import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * App-wide settings shared by main.ts and the API tests, so tests exercise
 * the same request validation as the running server.
 */
export function configureApp(app: INestApplication) {
  app.enableCors({
    origin: 'http://localhost:5173',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  return app;
}
