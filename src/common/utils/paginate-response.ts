//* src/common/utils/paginate-response.ts

import { ApiResponse, CoreResponse } from './response.util';

// ===================================================================================
// Se mantiene por compatibilidad de imports. El shape real lo define
// CoreResponse.paginated (response.util.ts).
// ===================================================================================
export type PaginatedResponse<T> = ApiResponse<T[]>;

// ===================================================================================
export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit?: number,
  message = 'Listado obtenido correctamente',
): PaginatedResponse<T> {
  return CoreResponse.paginated(message, data, total, page, limit);
}
