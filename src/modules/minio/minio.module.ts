import { Global, Module } from '@nestjs/common';
import { MinioService } from './minio.service';
import { MinioController } from './minio.controller';
import { ImagenProcesadorService } from './imagen-procesador.service';

@Global()
@Module({
  providers: [MinioService, ImagenProcesadorService],
  controllers: [MinioController],
  exports: [MinioService, ImagenProcesadorService],
})
export class MinioModule {}
