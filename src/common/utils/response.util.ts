//* src/common/utils/response.util.ts

// ===================================================================================
// Contrato único de respuesta de la API.
// Toda respuesta exitosa tiene esta forma. `meta` sólo viaja en listados.
// ===================================================================================
export type ResponseStatus = 'success' | 'created' | 'updated' | 'deleted';

export interface ResponseMeta {
  page: number;
  limit: number | null;
  total: number;
  totalPages: number | null;
}

export interface ApiResponse<T> {
  status: ResponseStatus;
  message: string;
  data: T;
  // `meta` lleva la paginación y, cuando aplica, el contexto del listado
  // (la categoría o colección que se está mostrando).
  meta: (ResponseMeta & Record<string, unknown>) | null;
}

// Alias retrocompatible: antes se importaba desde paginate-response.
export type PagenatedMeta = ResponseMeta;

// ===================================================================================
export class CoreResponse {
  // ===================================================================================
  static created<T>(message: string, data: T): ApiResponse<T> {
    return { status: 'created', message, data, meta: null };
  }

  // ===================================================================================
  static updated<T>(message: string, data: T): ApiResponse<T> {
    return { status: 'updated', message, data, meta: null };
  }

  // ===================================================================================
  static deleted(message: string): ApiResponse<null> {
    return { status: 'deleted', message, data: null, meta: null };
  }

  // ===================================================================================
  static success<T>(message: string, data: T): ApiResponse<T> {
    return { status: 'success', message, data, meta: null };
  }

  // ===================================================================================
  // Listados paginados. `limit` ausente => sin paginar (una sola página).
  static paginated<T>(
    message: string,
    data: T[],
    total: number,
    page: number,
    limit?: number,
    extra?: Record<string, unknown>,
  ): ApiResponse<T[]> {
    const totalPages = limit && limit > 0 ? Math.ceil(total / limit) : null;

    return {
      status: 'success',
      message,
      data,
      meta: {
        page,
        limit: limit ?? null,
        total,
        totalPages,
        ...extra,
      },
    };
  }
}
