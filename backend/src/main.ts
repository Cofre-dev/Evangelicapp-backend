import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

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
  // prohíbe origin:"*" en CORS. CORS_ORIGIN admite varios orígenes separados por coma
  // (ej. dev + prod) — ver .env.example.
  const corsOrigins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Storage local de logos (uploads/logos) mientras no haya un bucket configurado.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
