//* src/modules/cliente/cliente.controller.ts

import {
  Body,
  Controller,
  Delete,
  forwardRef,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import { ClienteService } from './cliente.service';
import { CarritoService } from '../carrito/carrito.service';
import { FavoritoService } from './favorito.service';
import { SuscripcionStockService } from './suscripcion-stock.service';
import {
  AvisoStockDto,
  FavoritoDto,
  LoginGoogleDto,
  PreferenciasClienteDto,
} from './dto/cliente.dto';
import { ClienteGuard } from './cliente.guard';
import { ClienteOpcionalGuard } from './cliente-opcional.guard';
import { CurrentCliente } from 'src/common/decorators/current-cliente.decorator';
import { ClienteAutenticado } from 'src/common/types/express';
import { CoreResponse } from 'src/common/utils/response.util';
import { IS_PRODUCTION } from 'src/common/config/jwt.config';
import {
  CLIENTE_TOKEN_COOKIE,
  CLIENTE_TOKEN_MAX_AGE_MS,
} from 'src/common/config/google.config';

const cookieCliente: CookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: IS_PRODUCTION ? 'none' : 'lax',
  path: '/',
};

// ===================================================================================
// Cuenta de cliente: login con Google, favoritos y avisos de stock.
//
// Es un público distinto del panel: el token lleva `tipo: 'cliente'` y no
// sirve para autenticarse como administrador.
// ===================================================================================
@Controller('cliente')
export class ClienteController {
  constructor(
    private readonly clienteService: ClienteService,
    private readonly favoritos: FavoritoService,
    private readonly avisos: SuscripcionStockService,
    // forwardRef: CarritoModule usa el guard de cliente y cliente adopta el
    // carrito al iniciar sesión, así que las referencias son mutuas.
    @Inject(forwardRef(() => CarritoService))
    private readonly carrito: CarritoService,
  ) {}

  // ===================================================================================
  @Throttle({ corto: { limit: 10, ttl: 60_000 } })
  @Post('auth/google')
  async loginGoogle(
    @Body() dto: LoginGoogleDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, cliente, esNuevo } =
      await this.clienteService.loginConGoogle(dto.idToken);

    res.cookie(CLIENTE_TOKEN_COOKIE, token, {
      ...cookieCliente,
      maxAge: CLIENTE_TOKEN_MAX_AGE_MS,
    });

    // Lo guardado sin cuenta pasa a pertenecerle: favoritos y carrito.
    let favoritosAdoptados = 0;
    let carritoAdoptado = 0;

    if (dto.dispositivo) {
      const resultado = await this.favoritos.adoptarDeDispositivo(
        cliente.id,
        dto.dispositivo,
      );
      favoritosAdoptados = resultado.data.adoptados;

      // Si la adopción del carrito falla, la sesión ya está iniciada: no
      // se anula el login por esto, el carrito del dispositivo sigue ahí.
      try {
        const carrito = await this.carrito.adoptarDeDispositivo(
          cliente.id,
          dto.dispositivo,
        );
        carritoAdoptado = carrito.data.adoptados + carrito.data.fusionados;
      } catch {
        carritoAdoptado = 0;
      }
    }

    return CoreResponse.success('Sesión iniciada correctamente', {
      cliente,
      esNuevo,
      favoritosAdoptados,
      carritoAdoptado,
    });
  }

  // ===================================================================================
  @Post('auth/logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(CLIENTE_TOKEN_COOKIE, cookieCliente);
    return CoreResponse.success('Sesión cerrada correctamente', null);
  }

  // ===================================================================================
  @UseGuards(ClienteGuard)
  @Get('me')
  perfil(@CurrentCliente() cliente: ClienteAutenticado) {
    return this.clienteService.perfil(cliente.id);
  }

  // ===================================================================================
  @UseGuards(ClienteGuard)
  @Patch('me')
  actualizar(
    @CurrentCliente() cliente: ClienteAutenticado,
    @Body() dto: PreferenciasClienteDto,
  ) {
    return this.clienteService.actualizarPreferencias(cliente.id, dto);
  }

  // ===================================================================================
  // Favoritos. Funcionan con sesión o con id de dispositivo, así que no
  // llevan guard: la identidad se resuelve en el servicio.
  // ===================================================================================
  @UseGuards(ClienteOpcionalGuard)
  @Get('favoritos')
  listarFavoritos(
    @CurrentCliente() cliente: ClienteAutenticado | undefined,
    @Query('dispositivo') dispositivo?: string,
  ) {
    return this.favoritos.listar({
      clienteId: cliente?.id,
      dispositivo,
    });
  }

  // ===================================================================================
  @Throttle({ corto: { limit: 60, ttl: 60_000 } })
  @UseGuards(ClienteOpcionalGuard)
  @Post('favoritos')
  agregarFavorito(
    @Body() dto: FavoritoDto,
    @CurrentCliente() cliente: ClienteAutenticado | undefined,
  ) {
    return this.favoritos.agregar(dto.producto_id, {
      clienteId: cliente?.id,
      dispositivo: dto.dispositivo,
    });
  }

  // ===================================================================================
  @UseGuards(ClienteOpcionalGuard)
  @Delete('favoritos/:productoId')
  quitarFavorito(
    @Param('productoId', ParseIntPipe) productoId: number,
    @CurrentCliente() cliente: ClienteAutenticado | undefined,
    @Query('dispositivo') dispositivo?: string,
  ) {
    return this.favoritos.quitar(productoId, {
      clienteId: cliente?.id,
      dispositivo,
    });
  }

  // ===================================================================================
  // Avisos de reposición. No exigen cuenta: basta un correo.
  // ===================================================================================
  @Throttle({ corto: { limit: 10, ttl: 60_000 } })
  @UseGuards(ClienteOpcionalGuard)
  @Post('avisos-stock')
  suscribirAviso(
    @Body() dto: AvisoStockDto,
    @CurrentCliente() cliente: ClienteAutenticado | undefined,
  ) {
    return this.avisos.suscribir({
      varianteId: dto.variante_id,
      email: dto.email,
      clienteId: cliente?.id,
    });
  }

  // ===================================================================================
  // La baja se identifica por el token del enlace que va en el correo del
  // propio suscriptor. No se acepta el correo como identificador: sería
  // suficiente conocerlo para cancelar el aviso de otra persona.
  @Delete('avisos-stock')
  cancelarAviso(@Query('token') token: string) {
    return this.avisos.cancelar(token ?? '');
  }
}
