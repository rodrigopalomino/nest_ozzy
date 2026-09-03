//* src/modules/catalogo/catalogo.controller.ts

import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { CatalogoService } from './catalogo.service';
import { QueryOptionsDto } from 'src/common/dto/query-options.dto';
import {
  CachePublico,
  CachePublicoInterceptor,
} from 'src/common/interceptors/cache-publico.interceptor';

// ===================================================================================
// Endpoints públicos que consume el front. Sólo lectura y sólo productos
// publicados: el servidor fuerza el estado, no depende del cliente.
// ===================================================================================
@UseInterceptors(CachePublicoInterceptor)
@Controller('catalogo')
export class CatalogoController {
  constructor(private readonly catalogoService: CatalogoService) {}

  // ===================================================================================
  // `q` usa el índice FULLTEXT; el resto de filtros van en `filtros[...]`.
  @CachePublico(60)
  @Get()
  listar(@Query() options: QueryOptionsDto, @Query('q') q?: string) {
    return this.catalogoService.listar(options, { busqueda: q });
  }

  // ===================================================================================
  // Cachés más largas: cambian con poca frecuencia.
  @CachePublico(300)
  @Get('facetas')
  facetas() {
    return this.catalogoService.facetas();
  }

  // ===================================================================================
  @CachePublico(600)
  @Get('sitemap')
  sitemap() {
    return this.catalogoService.sitemap();
  }

  // ===================================================================================
  @CachePublico(120)
  @Get('destacados')
  destacados(
    @Query('limite', new DefaultValuePipe(8), ParseIntPipe) limite: number,
  ) {
    return this.catalogoService.destacados(limite);
  }

  // ===================================================================================
  @CachePublico(120)
  @Get('novedades')
  novedades(
    @Query('limite', new DefaultValuePipe(8), ParseIntPipe) limite: number,
  ) {
    return this.catalogoService.novedades(limite);
  }

  // ===================================================================================
  @CachePublico(300)
  @Get('mas-vendidos')
  masVendidos(
    @Query('limite', new DefaultValuePipe(8), ParseIntPipe) limite: number,
  ) {
    return this.catalogoService.masVendidos(limite);
  }

  // ===================================================================================
  @CachePublico(60)
  @Get('categoria/:slug')
  porCategoria(@Param('slug') slug: string, @Query() options: QueryOptionsDto) {
    return this.catalogoService.porCategoria(slug, options);
  }

  // ===================================================================================
  @CachePublico(60)
  @Get('coleccion/:slug')
  porColeccion(@Param('slug') slug: string, @Query() options: QueryOptionsDto) {
    return this.catalogoService.porColeccion(slug, options);
  }

  // ===================================================================================
  // El detalle no se cachea en el navegador: incrementa el contador de
  // vistas y debe reflejar el stock al momento.
  @Get('producto/:slug')
  porSlug(@Param('slug') slug: string) {
    return this.catalogoService.porSlug(slug);
  }

  // ===================================================================================
  @CachePublico(120)
  @Get('producto/:slug/relacionados')
  relacionados(
    @Param('slug') slug: string,
    @Query('limite', new DefaultValuePipe(8), ParseIntPipe) limite: number,
  ) {
    return this.catalogoService.relacionados(slug, limite);
  }

  // ===================================================================================
  @CachePublico(3600)
  @Get('producto/:slug/guia-tallas')
  guiaTallas(@Param('slug') slug: string) {
    return this.catalogoService.guiaTallas(slug);
  }
}
