//* src/common/utils/prisma-query-builder.ts

import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  QueryOptionsSchemaType,
} from '../schema/query-options.schema';

// ===================================================================================
export interface PrismaPaginationResult {
  take: number;
  skip: number;
  orderBy?: Record<string, 'asc' | 'desc'> | Record<string, 'asc' | 'desc'>[];
}

// ===================================================================================
// Operadores Prisma admitidos en `filtros[campo][op]`.
const ALLOWED_OPERATORS = new Set([
  'equals',
  'not',
  'in',
  'notIn',
  'lt',
  'lte',
  'gt',
  'gte',
  'contains',
  'startsWith',
  'endsWith',
]);

// Operadores cuyo valor NUNCA debe coercionarse a número:
// buscar el texto "2024" debe seguir siendo un string.
const TEXT_OPERATORS = new Set(['contains', 'startsWith', 'endsWith']);

const NUMERIC_REGEX = /^-?\d+(\.\d+)?$/;

// ===================================================================================
export function buildPagination(
  options?: QueryOptionsSchemaType,
): PrismaPaginationResult {
  const page = options?.page ? Number(options.page) : 1;

  // Se acota siempre: nunca se devuelve la tabla completa.
  const rawLimit = options?.limit ? Number(options.limit) : DEFAULT_LIMIT;
  const limit = Math.min(Math.max(rawLimit, 1), MAX_LIMIT);

  const pagination: PrismaPaginationResult = {
    take: limit,
    skip: (page - 1) * limit,
  };

  const sortBy = options?.sortBy;
  const order = options?.order;

  const sortByArr = Array.isArray(sortBy) ? sortBy : sortBy ? [sortBy] : [];
  const orderArr = Array.isArray(order) ? order : order ? [order] : [];

  if (sortByArr.length > 0) {
    pagination.orderBy = sortByArr.map((field, index) => ({
      [field]: orderArr[index] ?? orderArr[0] ?? 'asc',
    }));
  }

  return pagination;
}

// ===================================================================================
// El límite efectivo aplicado, para construir el `meta` de la respuesta.
export function resolveLimit(options?: QueryOptionsSchemaType): number {
  const rawLimit = options?.limit ? Number(options.limit) : DEFAULT_LIMIT;
  return Math.min(Math.max(rawLimit, 1), MAX_LIMIT);
}

// ===================================================================================
// Valida que un campo (posiblemente anidado: "variantes.color.nombre")
// esté permitido para filtrar u ordenar.
function assertAllowedField(
  field: string,
  allowed: Set<string>,
  invalid: string[],
): boolean {
  if (allowed.has(field)) return true;
  invalid.push(field);
  return false;
}

// ===================================================================================
function coerceValue(op: string, raw: unknown): unknown {
  // Los operadores de texto conservan el string tal cual.
  if (TEXT_OPERATORS.has(op)) return typeof raw === 'string' ? raw : raw;

  if (op === 'in' || op === 'notIn') {
    const list =
      typeof raw === 'string'
        ? raw.split(',').map((v) => v.trim())
        : Array.isArray(raw)
          ? (raw as unknown[])
          : [raw];

    return list.map((v) =>
      typeof v === 'string' && NUMERIC_REGEX.test(v) ? Number(v) : v,
    );
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (NUMERIC_REGEX.test(trimmed)) return Number(trimmed);
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
  }

  return raw;
}

// ===================================================================================
// Construye el `where` de Prisma a partir de `filtros`.
//
// `allowedFilters` es OBLIGATORIO: sin whitelist el cliente podía filtrar por
// cualquier columna (incluida `password`) y recorrer relaciones arbitrarias.
export function buildFilters<T>(
  filters: Record<string, unknown> | undefined,
  allowedFilters: string[],
): T {
  if (!filters) return {} as T;

  const allowed = new Set(allowedFilters);
  const parsed: Record<string, unknown> = {};
  const invalid: string[] = [];

  // ===================================================================================
  // Búsqueda global: OR de `contains` sobre las claves que pida el front,
  // limitadas también por la whitelist.
  //
  // Las rutas anidadas ("variantes.color.nombre") deben figurar completas en
  // `allowedFilters`. No basta con que esté la raíz: validar sólo por la raíz
  // dejaría al cliente recorrer cualquier relación colgada de ella.
  const globalValue =
    typeof filters.global === 'string' ? filters.global.trim() : '';

  const globalKeysRaw =
    typeof filters.globalKeys === 'string' ? filters.globalKeys.trim() : '';

  if (globalValue && globalKeysRaw) {
    const globalKeys = globalKeysRaw
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
      .filter((k) => assertAllowedField(k, allowed, invalid));

    const orClauses = globalKeys.map((field) => {
      const keys = field.split('.');

      if (keys.length === 1) {
        return { [field]: { contains: globalValue } };
      }

      // Objeto anidado. Un segmento marcado con "[]" es una relación de lista
      // y necesita `some`, o Prisma rechaza el where:
      //   "variantes[].color.nombre" => { variantes: { some: { color: { nombre: {...} } } } }
      //   "categoria.nombre"         => { categoria: { nombre: {...} } }
      const root: Record<string, any> = {};
      let current = root;

      keys.forEach((k, index) => {
        const esLista = k.endsWith('[]');
        const nombre = esLista ? k.slice(0, -2) : k;

        if (index === keys.length - 1) {
          current[nombre] = { contains: globalValue };
          return;
        }

        if (esLista) {
          const some: Record<string, any> = {};
          current[nombre] = { some };
          current = some;
        } else {
          current[nombre] = {};
          current = current[nombre] as Record<string, any>;
        }
      });

      return root;
    });

    if (orClauses.length > 0) parsed.OR = orClauses;
  }

  // ===================================================================================
  // Campos de relación: la whitelist puede declarar por dónde se filtra una
  // relación, y el cliente sigue usando su nombre corto.
  //
  //   allowedFilters: ['categorias[].categoria.slug']
  //   ?filtros[categorias]=polos
  //   => { categorias: { some: { categoria: { slug: { equals: 'polos' } } } } }
  //
  // Cuando el nombre que usa el cliente no coincide con la relación real, se
  // declara con "alias:ruta" — color y talla cuelgan de las variantes:
  //
  //   'colores:variantes[].color.nombre'
  //   ?filtros[colores]=Negro
  //   => { variantes: { some: { color: { nombre: { equals: 'Negro' } } } } }
  //
  // Sin esto un filtro sobre una relación generaba { categorias: { equals:
  // 'polos' } }, que Prisma rechaza: una relación de lista necesita `some`.
  const rutaPorAlias = new Map<string, string>();

  for (const permitido of allowedFilters) {
    const separador = permitido.indexOf(':');

    if (separador > 0) {
      rutaPorAlias.set(
        permitido.slice(0, separador),
        permitido.slice(separador + 1),
      );
      continue;
    }

    if (!permitido.includes('.')) continue;

    // Sin alias explícito, el nombre público es el primer segmento.
    rutaPorAlias.set(permitido.split('.')[0].replace(/\[\]$/, ''), permitido);
  }

  // Envuelve el filtro ya construido en la ruta declarada.
  function envolver(
    ruta: string,
    filtro: Record<string, unknown>,
  ): Record<string, unknown> {
    const segmentos = ruta.split('.');
    const raiz: Record<string, any> = {};
    let actual = raiz;

    segmentos.forEach((segmento, indice) => {
      const esLista = segmento.endsWith('[]');
      const nombre = esLista ? segmento.slice(0, -2) : segmento;

      if (indice === segmentos.length - 1) {
        actual[nombre] = filtro;
        return;
      }

      if (esLista) {
        const some: Record<string, any> = {};
        actual[nombre] = { some };
        actual = some;
      } else {
        actual[nombre] = {};
        actual = actual[nombre] as Record<string, any>;
      }
    });

    return raiz;
  }

  // Campos que exigen operador: comparar un rango por igualdad devolvía cero
  // resultados con un 200, y un cero mentiroso es peor que un error.
  const EXIGEN_OPERADOR = new Set(['precioDesde', 'precioBase', 'precio']);

  for (const [key, value] of Object.entries(filters)) {
    if (key === 'global' || key === 'globalKeys') continue;

    const rutaRelacion = rutaPorAlias.get(key);

    // El alias de una relación es válido aunque no figure tal cual: lo que
    // está en la whitelist es su ruta completa.
    if (!rutaRelacion && !assertAllowedField(key, allowed, invalid)) continue;

    if (
      EXIGEN_OPERADOR.has(key) &&
      (typeof value === 'string' || typeof value === 'number')
    ) {
      throw new BadRequestException({
        message: `El filtro "${key}" necesita un operador de comparación.`,
        campo: key,
        ejemplo: `filtros[${key}][gte]=100`,
        operadores: ['gte', 'lte', 'gt', 'lt', 'equals'],
      });
    }

    // Caso: filtros[campo][operador] = X
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const inner = value as Record<string, unknown>;
      const parsedInner: Record<string, unknown> = {};

      for (const [op, raw] of Object.entries(inner)) {
        if (!ALLOWED_OPERATORS.has(op)) {
          invalid.push(`${key}.${op}`);
          continue;
        }

        parsedInner[op] = coerceValue(op, raw);
      }

      if (Object.keys(parsedInner).length > 0) {
        Object.assign(
          parsed,
          rutaRelacion
            ? envolver(rutaRelacion, parsedInner)
            : { [key]: parsedInner },
        );
      }
      continue;
    }

    // Parámetro repetido: filtros[campo]=a&filtros[campo]=b llega como array.
    //
    // Es la forma canónica en HTTP para valores múltiples —la que produce un
    // <form> con casillas del mismo nombre y URLSearchParams.append— y antes
    // caía en el fallback sin envolver, así que Prisma la rechazaba. También
    // es la forma segura cuando un valor contiene comas.
    if (Array.isArray(value)) {
      const valores: unknown[] = (value as unknown[])
        .flatMap((v): unknown[] => (typeof v === 'string' ? v.split(',') : [v]))
        .map((v): unknown => (typeof v === 'string' ? v.trim() : v))
        .filter((v) => v !== '' && v !== undefined && v !== null);

      if (valores.length === 0) continue;

      // Un solo valor no necesita `in`: se compara directo.
      const filtro =
        valores.length === 1
          ? rutaRelacion
            ? { equals: valores[0] }
            : { equals: coerceValue('equals', valores[0]) }
          : { in: coerceValue('in', valores) };

      Object.assign(
        parsed,
        rutaRelacion ? envolver(rutaRelacion, filtro) : { [key]: filtro },
      );
      continue;
    }

    // Caso simple: filtros[campo] = "1,2,3"
    if (typeof value === 'string' && value.includes(',')) {
      const filtro = { in: coerceValue('in', value) };
      Object.assign(
        parsed,
        rutaRelacion ? envolver(rutaRelacion, filtro) : { [key]: filtro },
      );
      continue;
    }

    // Caso simple: filtros[campo] = "1" | "true" | "texto"
    if (typeof value === 'string') {
      const trimmed = value.trim();

      const filtro = NUMERIC_REGEX.test(trimmed)
        ? { equals: Number(trimmed) }
        : trimmed === 'true' || trimmed === 'false'
          ? { equals: trimmed === 'true' }
          : // Los campos de relación comparan exacto: un slug o un nombre no
            // se busca por fragmento.
            rutaRelacion
            ? { equals: trimmed }
            : { contains: trimmed };

      Object.assign(
        parsed,
        rutaRelacion ? envolver(rutaRelacion, filtro) : { [key]: filtro },
      );
      continue;
    }

    // Cualquier otra forma (objeto anidado inesperado, número suelto) se
    // compara por igualdad en lugar de pasarse cruda a Prisma.
    const filtro = { equals: value };

    Object.assign(
      parsed,
      rutaRelacion ? envolver(rutaRelacion, filtro) : { [key]: filtro },
    );
  }

  if (invalid.length > 0) {
    // Se listan los nombres que el cliente puede usar, no las rutas internas:
    // "categorias[].categoria.slug" no le sirve de nada a quien llama.
    const publicos = allowedFilters.map((permitido) => {
      const separador = permitido.indexOf(':');
      if (separador > 0) return permitido.slice(0, separador);
      return permitido.split('.')[0].replace(/\[\]$/, '');
    });

    throw new BadRequestException({
      message: 'Parámetros de filtro inválidos.',
      invalid,
      allowed: [...new Set(publicos)],
    });
  }

  return parsed as T;
}

// ===================================================================================
type PrismaIncludeValue = true | PrismaIncludeObject;

interface PrismaIncludeObject {
  include: PrismaIncludeTree;
}

interface PrismaIncludeTree {
  [key: string]: PrismaIncludeValue;
}

export function buildInclude(
  raw?: string[] | string,
  allowed?: string[],
): PrismaIncludeTree {
  if (!raw) return {};

  const includeList = Array.isArray(raw)
    ? raw.flatMap((v) => v.split(','))
    : String(raw).split(',');

  const include: PrismaIncludeTree = {};
  const invalid: string[] = [];

  for (const item of includeList) {
    const path = item.trim();
    if (!path) continue;

    if (allowed && !allowed.includes(path)) {
      invalid.push(path);
      continue;
    }

    const keys = path.split('.');

    if (keys.length === 1) {
      include[keys[0]] = true;
      continue;
    }

    let current: PrismaIncludeTree = include;

    keys.forEach((key, index) => {
      const isLast = index === keys.length - 1;

      if (isLast) {
        current[key] = true;
        return;
      }

      const existing = current[key];

      if (!existing || existing === true) {
        current[key] = { include: {} };
      }

      current = (current[key] as PrismaIncludeObject).include;
    });
  }

  if (invalid.length > 0) {
    throw new BadRequestException({
      message: 'Parámetros de include inválidos.',
      invalid,
      allowed: allowed ?? null,
    });
  }

  return include;
}

// ===================================================================================
export interface QueryBuilderOptions {
  allowedIncludes?: string[];
  allowedFilters?: string[];
  // `where` forzado por el servidor (ej. estado: ACTIVO en endpoints públicos).
  // Se combina con AND, así el cliente no puede sobrescribirlo.
  baseWhere?: Record<string, unknown>;
}

export function prismaQueryBuilder<
  WhereType,
  IncludeType extends Record<string, unknown>,
>(options: QueryOptionsSchemaType, config: QueryBuilderOptions = {}) {
  const { allowedIncludes = [], allowedFilters = [], baseWhere } = config;

  const clientWhere = buildFilters<Record<string, unknown>>(
    options.filtros,
    allowedFilters,
  );

  const hasClientWhere = Object.keys(clientWhere).length > 0;

  const where = (
    baseWhere
      ? hasClientWhere
        ? { AND: [baseWhere, clientWhere] }
        : baseWhere
      : clientWhere
  ) as WhereType;

  return {
    ...buildPagination(options),
    where,
    include: buildInclude(options.include, allowedIncludes) as IncludeType,
  };
}
