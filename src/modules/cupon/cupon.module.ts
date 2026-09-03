import { Module } from '@nestjs/common';
import { CuponService } from './cupon.service';
import { CuponController } from './cupon.controller';

@Module({
  providers: [CuponService],
  controllers: [CuponController],
})
export class CuponModule {}
