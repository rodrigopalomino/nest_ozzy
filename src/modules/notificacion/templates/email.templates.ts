//* src/modules/notificacion/templates/email.templates.ts

// ===================================================================================
// Plantillas de correo. HTML con estilos en línea y tablas, que es lo único
// que los clientes de correo renderizan de forma consistente.
// ===================================================================================

export interface DatosTienda {
  nombre: string;
  url: string;
  simboloMoneda: string;
}

// ===================================================================================
// Escapa el texto que viene de la base antes de meterlo en el HTML.
function esc(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===================================================================================
function envoltura(
  tienda: DatosTienda,
  contenido: string,
  urlBaja?: string,
): string {
  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:24px;border-bottom:1px solid #e4e4e7;">
              <span style="font-size:18px;font-weight:700;color:#18181b;">${esc(tienda.nombre)}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;color:#3f3f46;font-size:15px;line-height:1.6;">
              ${contenido}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background:#fafafa;border-top:1px solid #e4e4e7;font-size:12px;color:#71717a;">
              Recibes este correo porque lo solicitaste en
              <a href="${esc(tienda.url)}" style="color:#71717a;">${esc(tienda.nombre)}</a>.${
                urlBaja
                  ? `<br><a href="${esc(urlBaja)}" style="color:#71717a;">Cancelar este aviso</a>`
                  : ''
              }
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ===================================================================================
function boton(url: string, texto: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
    <tr><td style="background:#18181b;border-radius:8px;">
      <a href="${esc(url)}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">${esc(texto)}</a>
    </td></tr>
  </table>`;
}

// ===================================================================================
export function plantillaBienvenida(
  tienda: DatosTienda,
  nombre: string,
): { asunto: string; html: string } {
  return {
    asunto: `Bienvenido a ${tienda.nombre}`,
    html: envoltura(
      tienda,
      `<p style="margin:0 0 12px;">Hola ${esc(nombre)},</p>
       <p style="margin:0 0 12px;">Tu cuenta ya está lista. Desde ahora puedes
       guardar tus favoritos y pedir que te avisemos cuando vuelva el stock
       de una talla agotada.</p>
       ${boton(tienda.url, 'Ver el catálogo')}`,
    ),
  };
}

// ===================================================================================
export function plantillaStockDisponible(
  tienda: DatosTienda,
  datos: {
    producto: string;
    slug: string;
    variante: string | null;
    precio: number;
    // Token de baja: sólo viaja aquí, en el correo del propio suscriptor.
    tokenBaja?: string;
  },
): { asunto: string; html: string } {
  const url = `${tienda.url}/producto/${datos.slug}`;
  const precio = `${tienda.simboloMoneda} ${datos.precio.toFixed(2)}`;

  const urlBaja = datos.tokenBaja
    ? `${tienda.url}/avisos/baja?token=${encodeURIComponent(datos.tokenBaja)}`
    : undefined;

  return {
    asunto: `Ya está disponible: ${datos.producto}`,
    html: envoltura(
      tienda,
      `<p style="margin:0 0 12px;">Buenas noticias: <strong>${esc(datos.producto)}</strong>
       ${datos.variante ? `(${esc(datos.variante)})` : ''} volvió a estar disponible.</p>
       <p style="margin:0 0 4px;color:#71717a;font-size:14px;">Precio</p>
       <p style="margin:0 0 12px;font-size:20px;font-weight:700;color:#18181b;">${esc(precio)}</p>
       <p style="margin:0;color:#71717a;font-size:14px;">El stock es limitado, así que
       conviene no dejarlo para después.</p>
       ${boton(url, 'Ver el producto')}`,
      urlBaja,
    ),
  };
}

// ===================================================================================
export function plantillaOferta(
  tienda: DatosTienda,
  datos: {
    producto: string;
    slug: string;
    precio: number;
    precioAnterior: number;
    descuento: number;
  },
): { asunto: string; html: string } {
  const url = `${tienda.url}/producto/${datos.slug}`;
  const s = tienda.simboloMoneda;

  return {
    asunto: `-${datos.descuento}% en ${datos.producto}`,
    html: envoltura(
      tienda,
      `<p style="margin:0 0 12px;"><strong>${esc(datos.producto)}</strong> está en oferta.</p>
       <p style="margin:0 0 12px;">
         <span style="font-size:22px;font-weight:700;color:#18181b;">${esc(s)} ${datos.precio.toFixed(2)}</span>
         <span style="margin-left:8px;color:#a1a1aa;text-decoration:line-through;">${esc(s)} ${datos.precioAnterior.toFixed(2)}</span>
         <span style="margin-left:8px;background:#dcfce7;color:#166534;padding:2px 8px;border-radius:999px;font-size:13px;font-weight:600;">-${datos.descuento}%</span>
       </p>
       ${boton(url, 'Aprovechar la oferta')}`,
    ),
  };
}

// ===================================================================================
export function plantillaNovedades(
  tienda: DatosTienda,
  datos: {
    titulo: string;
    mensaje: string;
    enlace?: string;
  },
): { asunto: string; html: string } {
  return {
    asunto: datos.titulo,
    html: envoltura(
      tienda,
      `<p style="margin:0 0 12px;font-size:17px;font-weight:600;color:#18181b;">${esc(datos.titulo)}</p>
       <p style="margin:0 0 12px;white-space:pre-line;">${esc(datos.mensaje)}</p>
       ${boton(datos.enlace ?? tienda.url, 'Ver más')}`,
    ),
  };
}
