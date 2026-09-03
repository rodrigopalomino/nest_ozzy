//* src/modules/carrito/carrito.controller.ts

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { CarritoService } from './carrito.service';
import {
  ActualizarItemDto,
  AgregarItemDto,
  CarritoQueryDto,
} from './schema/carrito.schema';
import { ClienteOpcionalGuard } from '../cliente/cliente-opcional.guard';
import { CurrentCliente } from 'src/common/decorators/current-cliente.decorator';
import { ClienteAutenticado } from 'src/common/types/express';

// ===================================================================================
// Carrito público: no exige iniciar sesión.
//
// Todas las rutas usan ClienteOpcionalGuard: si hay cookie de cliente el
// carrito es suyo, y si no, se identifica por `dispositivo`. Es el mismo
// mecanismo que los favoritos, para que el carrito exista desde el primer
// clic y se adopte al entrar con Google.
// ===================================================================================

@ApiTags('carrito')
@UseGuards(ClienteOpcionalGuard)
@Controller('carrito')
export class CarritoController {
  constructor(private readonly carrito: CarritoService) {}

  // ===================================================================================
  @Get()
  ver(
    @CurrentCliente() cliente: ClienteAutenticado | undefined,
    @Query() query: CarritoQueryDto,
  ) {
    return this.carrito.ver({
      clienteId: cliente?.id,
      dispositivo: query.dispositivo,
    });
  }

  // ===================================================================================
  @Throttle({ corto: { limit: 60, ttl: 60_000 } })
  @Post('items')
  agregar(
    @Body() dto: AgregarItemDto,
    @CurrentCliente() cliente: ClienteAutenticado | undefined,
  ) {
    return this.carrito.agregar(dto.variante_id, dto.cantidad, {
      clienteId: cliente?.id,
      dispositivo: dto.dispositivo,
    });
  }

  // ===================================================================================
  @Patch('items/:varianteId')
  actualizar(
    @Param('varianteId', ParseIntPipe) varianteId: number,
    @Body() dto: ActualizarItemDto,
    @CurrentCliente() cliente: ClienteAutenticado | undefined,
  ) {
    return this.carrito.actualizarCantidad(varianteId, dto.cantidad, {
      clienteId: cliente?.id,
      dispositivo: dto.dispositivo,
    });
  }

  // ===================================================================================
  @Delete('items/:varianteId')
  quitar(
    @Param('varianteId', ParseIntPipe) varianteId: number,
    @CurrentCliente() cliente: ClienteAutenticado | undefined,
    @Query() query: CarritoQueryDto,
  ) {
    return this.carrito.quitar(varianteId, {
      clienteId: cliente?.id,
      dispositivo: query.dispositivo,
    });
  }

  // ===================================================================================
  @Delete()
  vaciar(
    @CurrentCliente() cliente: ClienteAutenticado | undefined,
    @Query() query: CarritoQueryDto,
  ) {
    return this.carrito.vaciar({
      clienteId: cliente?.id,
      dispositivo: query.dispositivo,
    });
  }

  // ===================================================================================
  // El pedido completo, con el mensaje y el total ya armados por el servidor.
  @Throttle({ corto: { limit: 20, ttl: 60_000 } })
  @Get('whatsapp')
  whatsapp(
    @CurrentCliente() cliente: ClienteAutenticado | undefined,
    @Query() query: CarritoQueryDto,
  ) {
    return this.carrito.generarEnlace({
      clienteId: cliente?.id,
      dispositivo: query.dispositivo,
    });
  }
}
