import { Module } from '@nestjs/common';
import { ProductoAdminService } from './producto-admin.service';
import { ExportacionService } from './exportacion.service';
import { ProductoAdminController } from './producto-admin.controller';

@Module({
  providers: [ProductoAdminService, ExportacionService],
  controllers: [ProductoAdminController],
})
export class ProductoAdminModule {}
