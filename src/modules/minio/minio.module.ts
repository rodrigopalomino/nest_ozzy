import { Global, Module } from '@nestjs/common';
import { MinioService } from './minio.service';
import { MinioController } from './minio.controller';

@Global()
@Module({
  providers: [MinioService],
  controllers: [MinioController],
  exports: [MinioService],
})
export class MinioModule {}
