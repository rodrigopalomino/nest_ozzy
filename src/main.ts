import { NestFactory, Reflector } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ZodValidationPipe, cleanupOpenApiDoc } from 'nestjs-zod';
import * as qs from 'qs';
import * as cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/errors/global-exception.filter';
import { CachePublicoInterceptor } from './common/interceptors/cache-publico.interceptor';
import { AuditoriaInterceptor } from './common/interceptors/auditoria.interceptor';
import { AuditoriaService } from './modules/auditoria/auditoria.service';
import { IS_PRODUCTION } from './common/config/jwt.config';

// ===================================================================================
// Orígenes permitidos, configurables con CORS_ORIGINS (lista separada por
// comas). Sin la variable se usan los de desarrollo.
function resolveCorsOrigins(): string[] {
  const fromEnv = process.env.CORS_ORIGINS;

  if (fromEnv && fromEnv.trim()) {
    return fromEnv
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }

  return ['http://localhost:3000'];
}

// ===================================================================================
async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());

  const reflector = app.get(Reflector);

  app.useGlobalInterceptors(
    // Cache-Control y ETag en las rutas marcadas con @CachePublico.
    new CachePublicoInterceptor(reflector),
    // Bitácora de las rutas marcadas con @Auditar.
    new AuditoriaInterceptor(reflector, app.get(AuditoriaService)),
  );

  // Necesario para los filtros anidados: filtros[campo][operador]=valor
  app.set('query parser', (str: string) => qs.parse(str));

  app.use(cookieParser());

  app.enableCors({
    origin: resolveCorsOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Detrás de un proxy inverso, req.ip debe ser la IP real del visitante:
  // el límite de peticiones y la deduplicación de leads dependen de ella.
  if (IS_PRODUCTION) app.set('trust proxy', 1);

  // ===================================================================================
  // La documentación no se publica en producción salvo que se pida
  // explícitamente: describe toda la superficie del panel.
  const exponerDocs = !IS_PRODUCTION || process.env.SWAGGER_ENABLED === 'true';

  if (exponerDocs) {
    const config = new DocumentBuilder()
      .setTitle('API Ozzy')
      .setDescription(
        'Catálogo, conversión por WhatsApp y panel de administración.\n\n' +
          'Toda respuesta correcta tiene la forma ' +
          '`{ status, message, data, meta }`.',
      )
      .setVersion('1.0')
      .addCookieAuth('access_token', {
        type: 'apiKey',
        in: 'cookie',
        description: 'Sesión de administración (POST /auth/login)',
      })
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        description: 'Alternativa a la cookie para clientes de API',
      })
      .addCookieAuth('cliente_token', {
        type: 'apiKey',
        in: 'cookie',
        description: 'Sesión de cliente (POST /cliente/auth/google)',
      })
      .build();

    // cleanupOpenApiDoc traduce los esquemas de Zod al formato OpenAPI,
    // así que la documentación sale de los mismos DTO que validan.
    const document = cleanupOpenApiDoc(
      SwaggerModule.createDocument(app, config),
    );

    SwaggerModule.setup('docs', app, document);

    logger.log('Documentación disponible en /docs');
  }

  const puerto = process.env.PORT ?? 3001;
  await app.listen(puerto);

  logger.log(`API escuchando en el puerto ${puerto}`);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
