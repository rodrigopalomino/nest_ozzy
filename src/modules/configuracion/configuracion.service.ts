//* src/modules/configuracion/configuracion.service.ts

import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CoreResponse } from 'src/common/utils/response.util';
import { CLAVES_PUBLICAS, CONFIG_POR_DEFECTO } from './configuracion.constants';

// Los ajustes cambian muy poco y se leen en cada mensaje de WhatsApp:
// se cachean en memoria durante un minuto.
const CACHE_MS = 60_000;

@Injectable()
export class ConfiguracionService implements OnModuleInit {
  private cache = new Map<string, string>();
  private cacheExpira = 0;

  constructor(private readonly prisma: PrismaService) {}

  // ===================================================================================
  // Al arrancar se insertan las claves que falten, sin sobrescribir las
  // que el administrador ya haya editado.
  async onModuleInit() {
    for (const def of CONFIG_POR_DEFECTO) {
      await this.prisma.configuracion.upsert({
        where: { clave: def.clave },
        update: { descripcion: def.descripcion },
        create: {
          clave: def.clave,
          valor: def.valor,
          descripcion: def.descripcion,
        },
      });
    }
  }

  // ===================================================================================
  private async cargar(): Promise<Map<string, string>> {
    if (Date.now() < this.cacheExpira && this.cache.size > 0) {
      return this.cache;
    }

    const filas = await this.prisma.configuracion.findMany();

    this.cache = new Map(filas.map((f) => [f.clave, f.valor]));
    this.cacheExpira = Date.now() + CACHE_MS;

    return this.cache;
  }

  // ===================================================================================
  async get(clave: string): Promise<string> {
    const cache = await this.cargar();

    const valor = cache.get(clave);
    if (valor !== undefined) return valor;

    // Si la clave no está en la base, se usa su valor por defecto.
    return CONFIG_POR_DEFECTO.find((c) => c.clave === clave)?.valor ?? '';
  }

  // ===================================================================================
  async getVarias(claves: string[]): Promise<Record<string, string>> {
    const cache = await this.cargar();

    return Object.fromEntries(
      claves.map((clave) => [
        clave,
        cache.get(clave) ??
          CONFIG_POR_DEFECTO.find((c) => c.clave === clave)?.valor ??
          '',
      ]),
    );
  }

  // ===================================================================================
  // Sólo las claves marcadas como públicas: el front no debe recibir
  // plantillas internas ni ajustes de operación.
  async publicas() {
    const cache = await this.cargar();

    const data = Object.fromEntries(
      [...CLAVES_PUBLICAS].map((clave) => [clave, cache.get(clave) ?? '']),
    );

    return CoreResponse.success('Configuración obtenida correctamente', data);
  }

  // ===================================================================================
  async listarAdmin() {
    const filas = await this.prisma.configuracion.findMany({
      orderBy: { clave: 'asc' },
    });

    return CoreResponse.success('Configuración obtenida correctamente', filas);
  }

  // ===================================================================================
  // El DTO es parcial: sólo llegan las claves que se quieren cambiar, así que
  // los valores pueden venir indefinidos y se descartan antes de escribir.
  async actualizar(valores: Record<string, string | undefined>) {
    const entradas = Object.entries(valores).filter(
      (par): par is [string, string] => typeof par[1] === 'string',
    );

    const claves = entradas.map(([clave]) => clave);

    await this.prisma.$transaction(
      entradas.map(([clave, valor]) =>
        this.prisma.configuracion.upsert({
          where: { clave },
          update: { valor },
          create: { valor, clave },
        }),
      ),
    );

    // Se invalida la caché para que el cambio se vea de inmediato.
    this.cacheExpira = 0;

    return CoreResponse.updated('Configuración actualizada correctamente', {
      actualizadas: claves,
    });
  }
}
