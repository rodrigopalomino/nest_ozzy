//* src/modules/configuracion/configuracion.constants.ts

// ===================================================================================
// Ajustes editables desde el admin, sin desplegar.
//
// Cada clave declara su valor por defecto y si es pública: las públicas las
// sirve /configuracion para que el front las lea; las privadas no salen
// nunca del admin.
// ===================================================================================

export interface DefinicionConfig {
  clave: string;
  valor: string;
  descripcion: string;
  publica: boolean;
}

export const CONFIG_CLAVES = {
  WHATSAPP_NUMERO: 'whatsapp.numero',
  WHATSAPP_MENSAJE_PLANTILLA: 'whatsapp.mensaje_plantilla',
  WHATSAPP_HORARIO: 'whatsapp.horario',
  WHATSAPP_CARRITO_PLANTILLA: 'whatsapp.carrito_plantilla',
  WHATSAPP_CARRITO_LINEA: 'whatsapp.carrito_linea',
  TIENDA_NOMBRE: 'tienda.nombre',
  TIENDA_URL: 'tienda.url',
  TIENDA_MONEDA: 'tienda.moneda',
  TIENDA_MONEDA_SIMBOLO: 'tienda.moneda_simbolo',
  REDES_INSTAGRAM: 'redes.instagram',
  REDES_TIKTOK: 'redes.tiktok',
  REDES_FACEBOOK: 'redes.facebook',
  ENVIO_INFO: 'envio.info',
} as const;

// ===================================================================================
// {{producto}}, {{talla}}, {{color}}, {{precio}} y {{url}} se sustituyen al
// generar el mensaje de WhatsApp.
export const CONFIG_POR_DEFECTO: DefinicionConfig[] = [
  {
    clave: CONFIG_CLAVES.WHATSAPP_NUMERO,
    valor: '',
    descripcion:
      'Número de WhatsApp con código de país, sólo dígitos. Ej: 51987654321',
    publica: true,
  },
  {
    clave: CONFIG_CLAVES.WHATSAPP_MENSAJE_PLANTILLA,
    valor:
      'Hola! Me interesa este producto:\n\n' +
      '*{{producto}}*\n' +
      '{{variante}}' +
      'Precio: {{precio}}\n\n' +
      '{{url}}',
    descripcion:
      'Plantilla del mensaje. Variables: {{producto}} {{variante}} {{talla}} {{color}} {{precio}} {{url}}',
    publica: false,
  },
  {
    clave: CONFIG_CLAVES.WHATSAPP_CARRITO_PLANTILLA,
    valor:
      'Hola! Quiero pedir:\n\n' +
      '{{items}}\n' +
      'Total: {{total}}\n\n' +
      '{{url}}',
    descripcion:
      'Plantilla del pedido con varios productos. Variables: {{items}} {{total}} {{cantidad}} {{url}}',
    publica: false,
  },
  {
    clave: CONFIG_CLAVES.WHATSAPP_CARRITO_LINEA,
    valor:
      '{{n}}) *{{producto}}*\n' +
      '   Talla {{talla}} / {{color}}\n' +
      '   {{cantidad}} x {{precio}} = {{subtotal}}\n',
    descripcion:
      'Plantilla de cada línea del pedido. Variables: {{n}} {{producto}} {{talla}} {{color}} {{cantidad}} {{precio}} {{subtotal}}',
    publica: false,
  },
  {
    clave: CONFIG_CLAVES.WHATSAPP_HORARIO,
    valor: 'Lun a Sáb de 9:00 a 20:00',
    descripcion: 'Horario de atención mostrado en la web',
    publica: true,
  },
  {
    clave: CONFIG_CLAVES.TIENDA_NOMBRE,
    valor: 'Ozzy',
    descripcion: 'Nombre de la tienda',
    publica: true,
  },
  {
    clave: CONFIG_CLAVES.TIENDA_URL,
    valor: 'http://localhost:3000',
    descripcion: 'URL pública del front, usada en enlaces y sitemap',
    publica: true,
  },
  {
    clave: CONFIG_CLAVES.TIENDA_MONEDA,
    valor: 'PEN',
    descripcion: 'Código ISO de la moneda',
    publica: true,
  },
  {
    clave: CONFIG_CLAVES.TIENDA_MONEDA_SIMBOLO,
    valor: 'S/',
    descripcion: 'Símbolo de la moneda',
    publica: true,
  },
  {
    clave: CONFIG_CLAVES.REDES_INSTAGRAM,
    valor: '',
    descripcion: 'URL del perfil de Instagram',
    publica: true,
  },
  {
    clave: CONFIG_CLAVES.REDES_TIKTOK,
    valor: '',
    descripcion: 'URL del perfil de TikTok',
    publica: true,
  },
  {
    clave: CONFIG_CLAVES.REDES_FACEBOOK,
    valor: '',
    descripcion: 'URL de la página de Facebook',
    publica: true,
  },
  {
    clave: CONFIG_CLAVES.ENVIO_INFO,
    valor: 'Envíos a todo el país. Consulta el costo por WhatsApp.',
    descripcion: 'Texto informativo de envíos',
    publica: true,
  },
];

export const CLAVES_PUBLICAS = new Set(
  CONFIG_POR_DEFECTO.filter((c) => c.publica).map((c) => c.clave),
);
