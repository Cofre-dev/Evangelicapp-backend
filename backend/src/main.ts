import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { resolveCorsOrigins } from './common/utils/cors-origins.util';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Necesario para que req.cookies exista (lo leen JwtStrategy, JwtRefreshStrategy y CsrfMiddleware).
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Las cookies exigen credentials:true en el fetch del frontend, lo que a su vez
  // prohíbe origin:"*" en CORS.
  app.enableCors({
    origin: resolveCorsOrigins(),
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
