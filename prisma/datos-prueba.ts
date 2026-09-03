//* prisma/datos-prueba.ts
//
// Genera datos de prueba realistas: productos con variantes, imágenes
// procesadas en MinIO, clientes, favoritos, cupones y leads con histórico.
//
//   npx ts-node prisma/datos-prueba.ts
//   npx ts-node prisma/datos-prueba.ts --limpiar   (borra los de prueba antes)
//
// Las imágenes se generan aquí con sharp en lugar de descargarse de tiendas
// reales: las fotos de catálogos ajenos tienen derechos y acabarían en el
// bucket como si fueran propias. Los nombres y precios sí son de mercado.

import 'dotenv/config';
import * as argon2 from 'argon2';
import { createHash, randomUUID } from 'crypto';
import { Client } from 'minio';
// require y no import: ts-node se ejecuta aquí sin el esModuleInterop del
// build de Nest, y el default import de sharp queda sin envolver.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp: typeof import('sharp').default = require('sharp');
import {
  EstadoLead,
  EstadoProducto,
  OrigenLead,
  PlataformaVideo,
  PrismaClient,
} from '@prisma/client';

const prisma = new PrismaClient();

// ===================================================================================
// Catálogo
// ===================================================================================

interface DefinicionColor {
  nombre: string;
  hex: string;
}

interface DefinicionProducto {
  nombre: string;
  categoria: string;
  descripcion: string;
  precioBase: number;
  // Colores en los que existe la prenda, con su foto propia.
  colores: string[];
  tallas: string[];
  destacado?: boolean;
  // Oferta vigente, en porcentaje.
  descuento?: number;
  insignias?: string[];
  colecciones?: string[];
  // Variantes agotadas: "COLOR/TALLA".
  agotadas?: string[];
  // Precio distinto para una variante concreta: "COLOR/TALLA": precio.
  preciosEspeciales?: Record<string, number>;
  videos?: { plataforma: PlataformaVideo; url: string; etiqueta: string }[];
}

const COLORES: DefinicionColor[] = [
  { nombre: 'Negro', hex: '#000000' },
  { nombre: 'Blanco', hex: '#FFFFFF' },
  { nombre: 'Rojo', hex: '#DC2626' },
  { nombre: 'Beige', hex: '#D6C7A8' },
  { nombre: 'Azul Marino', hex: '#1E3A5F' },
  { nombre: 'Verde Militar', hex: '#4A5D3A' },
  { nombre: 'Gris Melange', hex: '#9CA3AF' },
  { nombre: 'Vino', hex: '#6B1F2E' },
];

const TALLAS = ['S', 'M', 'L', 'XL'];

const PRODUCTOS: DefinicionProducto[] = [
  // ============ POLOS ============
  {
    nombre: 'Polo Oversize Basic',
    categoria: 'polos',
    descripcion:
      'Polo de algodón peruano 100% pima, corte oversize con caída recta. ' +
      'Tela de 180 g/m² que no se transparenta y mantiene la forma tras el lavado. ' +
      'Cuello reforzado con cinta interna. Prelavado, no encoge.',
    precioBase: 59,
    colores: ['Negro', 'Blanco', 'Beige'],
    tallas: TALLAS,
    destacado: true,
    insignias: ['top'],
    colecciones: ['essential'],
    agotadas: ['Blanco/S'],
  },
  {
    nombre: 'Polo Boxy Fit Heavyweight',
    categoria: 'polos',
    descripcion:
      'Polo de corte boxy en algodón de 240 g/m². Hombro caído y largo cropped. ' +
      'La densidad de la tela le da estructura sin rigidez. Costuras dobles en ' +
      'mangas y bajo.',
    precioBase: 79,
    colores: ['Negro', 'Verde Militar', 'Vino'],
    tallas: TALLAS,
    destacado: true,
    descuento: 20,
    insignias: ['oferta'],
    colecciones: ['street-2026'],
    preciosEspeciales: { 'Vino/XL': 89 },
  },
  {
    nombre: 'Polo Manga Larga Rib',
    categoria: 'polos',
    descripcion:
      'Manga larga en tejido acanalado elástico que se ajusta al cuerpo. ' +
      'Puños y cuello con el mismo rib. Ideal para capas bajo casaca.',
    precioBase: 69,
    colores: ['Negro', 'Blanco', 'Gris Melange'],
    tallas: TALLAS,
    insignias: ['nuevo'],
    colecciones: ['drop-enero'],
  },
  {
    nombre: 'Polo Estampado Back Print',
    categoria: 'polos',
    descripcion:
      'Estampado serigrafiado a gran escala en la espalda, logo pequeño al ' +
      'pecho. Tinta plastisol de alta durabilidad que resiste el lavado sin ' +
      'agrietarse.',
    precioBase: 75,
    colores: ['Negro', 'Blanco'],
    tallas: ['M', 'L', 'XL'],
    insignias: ['nuevo', 'top'],
    colecciones: ['drop-enero', 'street-2026'],
    videos: [
      {
        plataforma: PlataformaVideo.INSTAGRAM,
        url: 'https://www.instagram.com/reel/ejemplo-polo-back-print/',
        etiqueta: 'Cómo queda puesto',
      },
    ],
  },
  {
    nombre: 'Polo Pima Cuello V',
    categoria: 'polos',
    descripcion:
      'Cuello en V en algodón pima de hebra larga, suave al tacto y con ' +
      'brillo natural. Corte regular, ni ajustado ni holgado.',
    precioBase: 55,
    colores: ['Blanco', 'Azul Marino', 'Gris Melange'],
    tallas: TALLAS,
    agotadas: ['Gris Melange/S', 'Gris Melange/M'],
  },

  // ============ HOODIES ============
  {
    nombre: 'Hoodie Oversize Frost',
    categoria: 'hoodies',
    descripcion:
      'Buzo con capucha en felpa perchada de 380 g/m². Interior afelpado, ' +
      'exterior con acabado mate. Capucha forrada a doble capa con cordón ' +
      'plano. Bolsillo canguro con refuerzo.',
    precioBase: 149,
    colores: ['Negro', 'Beige', 'Gris Melange'],
    tallas: TALLAS,
    destacado: true,
    descuento: 15,
    insignias: ['oferta', 'top'],
    colecciones: ['street-2026'],
    videos: [
      {
        plataforma: PlataformaVideo.TIKTOK,
        url: 'https://www.tiktok.com/@ozzy/video/ejemplo-hoodie-frost',
        etiqueta: 'Unboxing',
      },
      {
        plataforma: PlataformaVideo.INSTAGRAM,
        url: 'https://www.instagram.com/reel/ejemplo-hoodie-detalle/',
        etiqueta: 'Detalle de la tela',
      },
    ],
  },
  {
    nombre: 'Hoodie Zip Full Tech',
    categoria: 'hoodies',
    descripcion:
      'Con cierre completo YKK y capucha estructurada. Tejido técnico ' +
      'cortaviento por fuera y felpa por dentro. Puños y bajo elásticos.',
    precioBase: 179,
    colores: ['Negro', 'Azul Marino'],
    tallas: ['M', 'L', 'XL'],
    insignias: ['nuevo'],
    colecciones: ['drop-enero'],
    preciosEspeciales: { 'Azul Marino/XL': 199 },
  },
  {
    nombre: 'Hoodie Crop Femenino',
    categoria: 'hoodies',
    descripcion:
      'Corte cropped a la cintura con bajo elástico ancho. Felpa liviana de ' +
      '280 g/m², cómoda para entretiempo.',
    precioBase: 129,
    colores: ['Blanco', 'Vino', 'Beige'],
    tallas: ['S', 'M', 'L'],
    agotadas: ['Vino/S'],
  },

  // ============ CASACAS ============
  {
    nombre: 'Casaca Denim Washed',
    categoria: 'casacas',
    descripcion:
      'Casaca de jean con lavado a la piedra que le da el desgaste natural. ' +
      'Denim de 12 oz, botones metálicos grabados, dos bolsillos de pecho ' +
      'con tapa y dos laterales.',
    precioBase: 189,
    colores: ['Azul Marino', 'Negro'],
    tallas: TALLAS,
    destacado: true,
    insignias: ['top'],
    colecciones: ['essential'],
  },
  {
    nombre: 'Casaca Bomber Nylon',
    categoria: 'casacas',
    descripcion:
      'Bomber en nylon con forro interior acolchado. Cuello, puños y bajo en ' +
      'rib elástico. Repele la llovizna sin ser impermeable.',
    precioBase: 219,
    colores: ['Negro', 'Verde Militar'],
    tallas: ['M', 'L', 'XL'],
    descuento: 25,
    insignias: ['oferta'],
    colecciones: ['street-2026'],
  },
  {
    nombre: 'Casaca Trucker Corduroy',
    categoria: 'casacas',
    descripcion:
      'Trucker en pana de canal fino, forrada en sherpa. Abriga de verdad y ' +
      'no abulta. Cuatro bolsillos.',
    precioBase: 249,
    colores: ['Beige', 'Verde Militar', 'Vino'],
    tallas: TALLAS,
    insignias: ['nuevo'],
    colecciones: ['drop-enero'],
    agotadas: ['Vino/S', 'Vino/M', 'Vino/L', 'Vino/XL'],
  },

  // ============ PANTALONES ============
  {
    nombre: 'Pantalón Cargo Wide',
    categoria: 'pantalones',
    descripcion:
      'Cargo de pierna ancha en gabardina de algodón con elastano. Seis ' +
      'bolsillos, dos de ellos con tapa y velcro. Cintura con cordón interno.',
    precioBase: 159,
    colores: ['Negro', 'Beige', 'Verde Militar'],
    tallas: TALLAS,
    destacado: true,
    insignias: ['top'],
    colecciones: ['street-2026'],
  },
  {
    nombre: 'Jogger Felpa Tapered',
    categoria: 'pantalones',
    descripcion:
      'Jogger en felpa de algodón con corte tapered: holgado en muslo y ' +
      'estrecho al tobillo. Puños elásticos y bolsillos laterales profundos.',
    precioBase: 119,
    colores: ['Negro', 'Gris Melange', 'Azul Marino'],
    tallas: TALLAS,
    descuento: 30,
    insignias: ['oferta'],
  },
  {
    nombre: 'Pantalón Straight Drill',
    categoria: 'pantalones',
    descripcion:
      'Corte recto en drill resistente, sin elastano. Cae con estructura y ' +
      'aguanta uso diario. Cinco bolsillos clásicos.',
    precioBase: 139,
    colores: ['Negro', 'Beige'],
    tallas: ['M', 'L', 'XL'],
    colecciones: ['essential'],
  },

  // ============ ACCESORIOS ============
  {
    nombre: 'Gorra Trucker Bordada',
    categoria: 'accesorios',
    descripcion:
      'Gorra trucker con frente de algodón y malla trasera transpirable. ' +
      'Logo bordado en hilo grueso. Visera precurvada, cierre snapback.',
    precioBase: 49,
    colores: ['Negro', 'Blanco', 'Rojo'],
    tallas: ['M'],
    insignias: ['nuevo'],
  },
  {
    nombre: 'Tote Bag Canvas',
    categoria: 'accesorios',
    descripcion:
      'Bolso de lona de algodón crudo de 340 g/m². Asas reforzadas con ' +
      'costura en cruz, bolsillo interior. Aguanta peso de verdad.',
    precioBase: 39,
    colores: ['Beige', 'Negro'],
    tallas: ['M'],
    colecciones: ['essential'],
  },
  {
    nombre: 'Medias Pack x3',
    categoria: 'accesorios',
    descripcion:
      'Tres pares de medias en algodón peinado con puño elástico que no ' +
      'aprieta. Caña media. Refuerzo en talón y punta.',
    precioBase: 35,
    colores: ['Negro', 'Blanco'],
    tallas: ['M', 'L'],
    descuento: 10,
    insignias: ['oferta'],
  },
];

// ===================================================================================
// Clientes de prueba
// ===================================================================================

const CLIENTES = [
  { nombre: 'María Fernanda Quispe', email: 'mfquispe@example.com', novedades: true },
  { nombre: 'Diego Alonso Ramírez', email: 'daramirez@example.com', novedades: true },
  { nombre: 'Camila Rojas Vega', email: 'crojas@example.com', novedades: false },
  { nombre: 'Sebastián Torres Luna', email: 'storres@example.com', novedades: true },
  { nombre: 'Valeria Chávez Núñez', email: 'vchavez@example.com', novedades: true },
  { nombre: 'Joaquín Mendoza Silva', email: 'jmendoza@example.com', novedades: false },
  { nombre: 'Antonella Paredes Ríos', email: 'aparedes@example.com', novedades: true },
  { nombre: 'Rodrigo Castillo Vargas', email: 'rcastillo@example.com', novedades: true },
];

const CUPONES = [
  { codigo: 'OZZY10', porcentaje: 10, usoMaximo: 100 },
  { codigo: 'VERANO25', porcentaje: 25, usoMaximo: 50 },
  { codigo: 'PRIMERACOMPRA', porcentaje: 15, usoMaximo: null },
  { codigo: 'ENVIOGRATIS', montoFijo: 15, usoMaximo: 200 },
  // Caducado, para probar que la validación lo rechaza.
  { codigo: 'NAVIDAD2025', porcentaje: 30, usoMaximo: 100, caducado: true },
];

// ===================================================================================
// Imágenes: se generan con sharp y se suben a MinIO en las 4 medidas que
// espera el front (original + sm/md/lg) más el blurData en base64.
// ===================================================================================

const minio = new Client({
  endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
  port: Number(process.env.MINIO_PORT ?? '9000'),
  useSSL: String(process.env.MINIO_USE_SSL ?? 'false').toLowerCase() === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY ?? '',
  secretKey: process.env.MINIO_SECRET_KEY ?? '',
});

const BUCKET = process.env.MINIO_BUCKET ?? 'ozzy';
const BASE_PUBLICA = (process.env.MINIO_PUBLIC_URL ?? '').replace(/\/+$/, '');

// Términos de búsqueda por categoría: la foto tiene que parecerse a la
// prenda, no ser una imagen cualquiera.
const BUSQUEDA_POR_CATEGORIA: Record<string, string> = {
  polos: 'tshirt,apparel',
  hoodies: 'hoodie,sweatshirt',
  casacas: 'jacket,outerwear',
  pantalones: 'pants,trousers',
  accesorios: 'cap,accessory',
};

// Fotografías reales de prendas, servidas por LoremFlickr (fotos de Flickr
// con licencia Creative Commons).
//
// IMPORTANTE: son SÓLO para desarrollo. Llevan marca de agua de licencia y
// pueden mostrar marcas ajenas, así que no sirven para producción: ahí van
// las fotos propias del catálogo.
async function descargarFoto(
  categoria: string,
  semillaFoto: number,
): Promise<Buffer | null> {
  const termino = BUSQUEDA_POR_CATEGORIA[categoria] ?? 'clothing';
  const url = `https://loremflickr.com/800/1000/${termino}/all?lock=${semillaFoto}`;

  for (let intento = 0; intento < 3; intento++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(25_000) });
      if (!r.ok) continue;

      const buf = Buffer.from(await r.arrayBuffer());
      // Una respuesta diminuta suele ser una página de error, no una foto.
      if (buf.length > 8_000) return buf;
    } catch {
      // Reintenta: el servicio corta conexiones de vez en cuando.
    }
  }

  return null;
}

// Tono de fondo derivado del color de la prenda, usado sólo cuando la
// descarga falla y hay que generar un sustituto.
function hexARgb(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// Sustituto para cuando la descarga falla: identifica el producto y el color
// para que se vea a simple vista que esa foto no llegó.
function placeholderSvg(
  texto: string,
  colorHex: string,
  toma: number,
  ancho: number,
  alto: number,
): string {
  const { r, g, b } = hexARgb(colorHex);
  const claro = r + g + b > 380;
  const tinta = claro ? '#111111' : '#FFFFFF';

  return `<svg width="${ancho}" height="${alto}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${ancho}" height="${alto}" fill="rgb(${r},${g},${b})"/>
    <text x="${ancho / 2}" y="${alto - 150}" font-family="Helvetica, Arial, sans-serif"
          font-size="56" font-weight="bold" fill="${tinta}" text-anchor="middle">OZZY</text>
    <text x="${ancho / 2}" y="${alto - 80}" font-family="Helvetica, Arial, sans-serif"
          font-size="38" fill="${tinta}" text-anchor="middle" opacity="0.75">${texto}</text>
    <text x="60" y="90" font-family="Helvetica, Arial, sans-serif"
          font-size="30" fill="${tinta}" opacity="0.5">sin foto · ${toma}</text>
  </svg>`;
}

interface ImagenSubida {
  url: string;
  urlSm: string;
  urlMd: string;
  urlLg: string;
  ancho: number;
  alto: number;
  blurData: string;
}

// Genera una imagen que representa la prenda: fondo del color, etiqueta con
// el nombre y una franja para distinguir las tomas de un mismo color.
async function generarYSubir(
  productoId: number,
  texto: string,
  colorHex: string,
  toma: number,
  categoria: string,
  semillaFoto: number,
): Promise<ImagenSubida> {
  const ANCHO = 1200;
  const ALTO = 1500;

  const foto = await descargarFoto(categoria, semillaFoto);

  // Con foto real se recorta al formato de catálogo (4:5). Sin ella se
  // genera un sustituto plano: es mejor un catálogo completo con algún
  // hueco identificable que abortar la siembra entera.
  const base = foto
    ? sharp(foto).rotate().resize(ANCHO, ALTO, { fit: 'cover', position: 'centre' })
    : sharp(Buffer.from(placeholderSvg(texto, colorHex, toma, ANCHO, ALTO)));
  const carpeta = `productos/${productoId}`;
  const id = randomUUID();

  async function subir(sufijo: string, ancho: number | null) {
    const img = ancho
      ? sharp(await base.clone().toBuffer()).resize(ancho)
      : base.clone();
    const buf = await img.webp({ quality: 82 }).toBuffer();
    const key = `${carpeta}/${id}${sufijo}.webp`;
    await minio.putObject(BUCKET, key, buf, buf.length, {
      'Content-Type': 'image/webp',
    });
    return `${BASE_PUBLICA}/${BUCKET}/${key}`;
  }

  const [url, urlSm, urlMd, urlLg] = await Promise.all([
    subir('', null),
    subir('-sm', 300),
    subir('-md', 600),
    subir('-lg', 1200),
  ]);

  // Placeholder diminuto para el blur de next/image.
  const blur = await base.clone().resize(16).webp({ quality: 40 }).toBuffer();

  return {
    url,
    urlSm,
    urlMd,
    urlLg,
    ancho: ANCHO,
    alto: ALTO,
    blurData: `data:image/webp;base64,${blur.toString('base64')}`,
  };
}

// ===================================================================================
// Utilidades
// ===================================================================================

function slugificar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Aleatorio reproducible: la misma semilla da el mismo catálogo, así que dos
// ejecuciones son comparables y un fallo se puede reproducir.
let semilla = 20260903;
function aleatorio(): number {
  semilla = (semilla * 1103515245 + 12345) & 0x7fffffff;
  return semilla / 0x7fffffff;
}

function entre(min: number, max: number): number {
  return Math.floor(aleatorio() * (max - min + 1)) + min;
}

function elegir<T>(lista: T[]): T {
  return lista[Math.floor(aleatorio() * lista.length)];
}

function hace(dias: number, horas = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(d.getHours() - horas);
  return d;
}

// ===================================================================================
async function limpiar() {
  console.log('Limpiando datos de prueba anteriores...');

  // El orden respeta las claves ajenas; el resto cae por cascada.
  await prisma.leadWhatsApp.deleteMany({});
  await prisma.favorito.deleteMany({});
  await prisma.suscripcionStock.deleteMany({});
  await prisma.carritoItem.deleteMany({});
  await prisma.carrito.deleteMany({});
  await prisma.notificacion.deleteMany({});
  await prisma.cliente.deleteMany({});
  await prisma.cupon.deleteMany({});
  await prisma.producto.deleteMany({});

  console.log('  hecho\n');
}

// ===================================================================================
async function regenerarImagenes() {
  const productos = await prisma.producto.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      nombre: true,
      categorias: { select: { categoria: { select: { slug: true } } } },
      variantes: {
        select: { color: { select: { id: true, nombre: true, hex: true } } },
      },
    },
    orderBy: { id: 'asc' },
  });

  console.log(`Regenerando imágenes de ${productos.length} productos...\n`);

  for (const producto of productos) {
    const categoria = producto.categorias[0]?.categoria.slug ?? 'polos';

    // Colores en los que existe la prenda, sin repetir.
    const colores = [
      ...new Map(producto.variantes.map((v) => [v.color.id, v.color])).values(),
    ];

    if (colores.length === 0) {
      console.log(`· ${producto.nombre}: sin variantes, se omite`);
      continue;
    }

    // Las filas viejas se borran después de subir las nuevas, para no dejar
    // el producto sin imágenes si algo falla a mitad.
    const viejas = await prisma.imagenProducto.findMany({
      where: { producto_id: producto.id },
      select: { id: true, url: true },
    });

    let orden = 0;
    const nuevas: number[] = [];

    for (const [indiceColor, color] of colores.entries()) {
      for (const toma of [1, 2]) {
        const img = await generarYSubir(
          producto.id,
          `${producto.nombre} · ${color.nombre}`,
          color.hex ?? '#888888',
          toma,
          categoria,
          producto.id * 1000 + indiceColor * 10 + toma,
        );

        const fila = await prisma.imagenProducto.create({
          data: {
            producto_id: producto.id,
            color_id: color.id,
            url: img.url,
            urlSm: img.urlSm,
            urlMd: img.urlMd,
            urlLg: img.urlLg,
            ancho: img.ancho,
            alto: img.alto,
            blurData: img.blurData,
            alt: `${producto.nombre} en ${color.nombre}`,
            orden: orden++,
            esPrincipal: toma === 1,
            esHover: toma === 2,
          },
          select: { id: true },
        });

        nuevas.push(fila.id);
      }
    }

    // Portada genérica sin color.
    const portada = await generarYSubir(
      producto.id,
      producto.nombre,
      colores[0].hex ?? '#888888',
      0,
      categoria,
      producto.id * 1000,
    );

    await prisma.imagenProducto.create({
      data: {
        producto_id: producto.id,
        color_id: null,
        url: portada.url,
        urlSm: portada.urlSm,
        urlMd: portada.urlMd,
        urlLg: portada.urlLg,
        ancho: portada.ancho,
        alto: portada.alto,
        blurData: portada.blurData,
        alt: producto.nombre,
        orden: 0,
        esPrincipal: true,
        esHover: false,
      },
    });

    await prisma.producto.update({
      where: { id: producto.id },
      data: { ogImagen: portada.url },
    });

    // Ahora sí: fuera las viejas, de la base y del bucket.
    if (viejas.length > 0) {
      await prisma.imagenProducto.deleteMany({
        where: { id: { in: viejas.map((v) => v.id) } },
      });

      for (const v of viejas) {
        const marca = `/${BUCKET}/`;
        const i = v.url.indexOf(marca);
        if (i < 0) continue;

        const key = v.url.slice(i + marca.length);

        // Las cuatro medidas comparten el nombre base.
        for (const sufijo of ['', '-sm', '-md', '-lg']) {
          const objeto = key.replace(/\.webp$/, `${sufijo}.webp`);
          await minio.removeObject(BUCKET, objeto).catch(() => undefined);
        }
      }
    }

    console.log(
      `✓ ${producto.nombre} — ${nuevas.length + 1} fotos nuevas ` +
        `(${viejas.length} reemplazadas)`,
    );
  }

  const total = await prisma.imagenProducto.count();
  console.log(`\nImágenes en la base: ${total}`);
}

// ===================================================================================
async function main() {
  const limpiarPrimero = process.argv.includes('--limpiar');

  console.log('=== Datos de prueba de Ozzy ===\n');

  if (!(await minio.bucketExists(BUCKET))) {
    throw new Error(
      `El bucket "${BUCKET}" no existe. Créalo antes de generar imágenes.`,
    );
  }

  if (limpiarPrimero) await limpiar();

  // --solo-imagenes: reemplaza las fotos de los productos que ya existen sin
  // tocar productos, variantes, leads ni clientes.
  if (process.argv.includes('--solo-imagenes')) {
    await regenerarImagenes();
    return;
  }

  // ---------------------------------------------------------------- colores
  for (const c of COLORES) {
    await prisma.color.upsert({
      where: { nombre: c.nombre },
      update: { hex: c.hex },
      create: { nombre: c.nombre, hex: c.hex },
    });
  }

  const colorPorNombre = new Map(
    (await prisma.color.findMany()).map((c) => [c.nombre, c]),
  );
  const tallaPorEtiqueta = new Map(
    (await prisma.talla.findMany()).map((t) => [t.etiqueta, t]),
  );
  const categoriaPorSlug = new Map(
    (await prisma.categoria.findMany()).map((c) => [c.slug, c]),
  );
  const insigniaPorSlug = new Map(
    (await prisma.insignia.findMany()).map((i) => [i.slug, i]),
  );
  const coleccionPorSlug = new Map(
    (await prisma.coleccion.findMany()).map((c) => [c.slug, c]),
  );

  console.log(`Colores: ${colorPorNombre.size}`);
  console.log(`Tallas: ${tallaPorEtiqueta.size}`);
  console.log(`Categorías: ${categoriaPorSlug.size}\n`);

  // ---------------------------------------------------------------- productos
  const creados: { id: number; nombre: string; variantes: number[] }[] = [];

  for (const [indice, def] of PRODUCTOS.entries()) {
    const slug = slugificar(def.nombre);

    const existente = await prisma.producto.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existente) {
      console.log(`· ${def.nombre} ya existe, se omite`);
      continue;
    }

    const categoria = categoriaPorSlug.get(def.categoria);
    if (!categoria) throw new Error(`Categoría desconocida: ${def.categoria}`);

    const producto = await prisma.producto.create({
      data: {
        nombre: def.nombre,
        slug,
        descripcion: def.descripcion,
        estado: EstadoProducto.ACTIVO,
        precioBase: def.precioBase,
        destacado: def.destacado ?? false,
        orden: indice,
        vistas: entre(40, 1200),
        metaTitulo: `${def.nombre} | Ozzy`,
        metaDescripcion: def.descripcion.slice(0, 155),
        categorias: { create: { categoria_id: categoria.id } },
        insignias: {
          create: (def.insignias ?? [])
            .map((s) => insigniaPorSlug.get(s))
            .filter((i): i is NonNullable<typeof i> => Boolean(i))
            .map((i) => ({ insignia_id: i.id })),
        },
        colecciones: {
          create: (def.colecciones ?? [])
            .map((s) => coleccionPorSlug.get(s))
            .filter((c): c is NonNullable<typeof c> => Boolean(c))
            .map((c) => ({ coleccion_id: c.id })),
        },
        videos: {
          create: (def.videos ?? []).map((v, i) => ({
            plataforma: v.plataforma,
            url: v.url,
            etiqueta: v.etiqueta,
            orden: i,
          })),
        },
      },
      select: { id: true },
    });

    // ------------------------------------------------------------ oferta
    if (def.descuento) {
      const oferta =
        Math.round(def.precioBase * (1 - def.descuento / 100) * 100) / 100;

      await prisma.precioProducto.create({
        data: {
          producto_id: producto.id,
          precioOriginal: def.precioBase,
          porcentajeDescuento: def.descuento,
          precioOferta: oferta,
          iniciaEn: hace(10),
          terminaEn: hace(-20), // vigente 20 días más
          activo: true,
        },
      });
    }

    // ------------------------------------------------------------ variantes
    const idsVariante: number[] = [];
    let precioMinimo = Number.POSITIVE_INFINITY;

    for (const nombreColor of def.colores) {
      const color = colorPorNombre.get(nombreColor);
      if (!color) throw new Error(`Color desconocido: ${nombreColor}`);

      for (const etiqueta of def.tallas) {
        const talla = tallaPorEtiqueta.get(etiqueta);
        if (!talla) continue;

        const clave = `${nombreColor}/${etiqueta}`;
        const agotada = (def.agotadas ?? []).includes(clave);
        const especial = def.preciosEspeciales?.[clave];

        const variante = await prisma.varianteProducto.create({
          data: {
            producto_id: producto.id,
            talla_id: talla.id,
            color_id: color.id,
            sku: `OZ-${producto.id}-${slugificar(nombreColor).slice(0, 3).toUpperCase()}-${etiqueta}`,
            precio: especial ?? null,
            stock: agotada ? 0 : entre(3, 40),
            activo: true,
          },
          select: { id: true },
        });

        idsVariante.push(variante.id);

        // El precio efectivo más bajo alimenta precioDesde.
        const base = especial ?? def.precioBase;
        const efectivo = def.descuento
          ? Math.round(base * (1 - def.descuento / 100) * 100) / 100
          : base;
        if (efectivo < precioMinimo) precioMinimo = efectivo;
      }
    }

    await prisma.producto.update({
      where: { id: producto.id },
      data: { precioDesde: precioMinimo },
    });

    // ------------------------------------------------------------ imágenes
    // Dos tomas por color: la primera es portada, la segunda el hover.
    let orden = 0;

    for (const [indiceColor, nombreColor] of def.colores.entries()) {
      const color = colorPorNombre.get(nombreColor)!;

      for (const toma of [1, 2]) {
        const img = await generarYSubir(
          producto.id,
          `${def.nombre} · ${nombreColor}`,
          color.hex ?? '#888888',
          toma,
          def.categoria,
          // Semilla estable por producto/color/toma: cada combinación tiene
          // su propia foto y no cambia entre ejecuciones.
          producto.id * 1000 + indiceColor * 10 + toma,
        );

        await prisma.imagenProducto.create({
          data: {
            producto_id: producto.id,
            color_id: color.id,
            url: img.url,
            urlSm: img.urlSm,
            urlMd: img.urlMd,
            urlLg: img.urlLg,
            ancho: img.ancho,
            alto: img.alto,
            blurData: img.blurData,
            alt: `${def.nombre} en ${nombreColor}`,
            orden: orden++,
            esPrincipal: toma === 1,
            esHover: toma === 2,
          },
        });
      }
    }

    // Portada genérica del producto, sin color asignado.
    const portada = await generarYSubir(
      producto.id,
      def.nombre,
      colorPorNombre.get(def.colores[0])?.hex ?? '#888888',
      0,
      def.categoria,
      producto.id * 1000,
    );

    await prisma.imagenProducto.create({
      data: {
        producto_id: producto.id,
        color_id: null,
        url: portada.url,
        urlSm: portada.urlSm,
        urlMd: portada.urlMd,
        urlLg: portada.urlLg,
        ancho: portada.ancho,
        alto: portada.alto,
        blurData: portada.blurData,
        alt: def.nombre,
        orden: 0,
        esPrincipal: true,
        esHover: false,
      },
    });

    await prisma.producto.update({
      where: { id: producto.id },
      data: { ogImagen: portada.url },
    });

    creados.push({
      id: producto.id,
      nombre: def.nombre,
      variantes: idsVariante,
    });

    console.log(
      `✓ ${def.nombre} — ${idsVariante.length} variantes, ` +
        `${def.colores.length * 2 + 1} imágenes` +
        (def.descuento ? `, -${def.descuento}%` : ''),
    );
  }

  console.log(`\nProductos creados: ${creados.length}\n`);

  // Si los productos ya existían de una ejecución anterior, se cargan de la
  // base para poder generar leads, favoritos y carritos sobre ellos: cortar
  // aquí dejaba el catálogo sin actividad.
  if (creados.length === 0) {
    const existentes = await prisma.producto.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        nombre: true,
        variantes: { where: { activo: true }, select: { id: true } },
      },
    });

    for (const p of existentes) {
      creados.push({
        id: p.id,
        nombre: p.nombre,
        variantes: p.variantes.map((v) => v.id),
      });
    }

    console.log(`Reutilizando ${creados.length} productos ya existentes\n`);
  }

  if (creados.length === 0) {
    console.log('No hay productos; nada más que hacer.');
    return;
  }

  // ---------------------------------------------------------------- guía tallas
  const catPolos = categoriaPorSlug.get('polos');

  if (catPolos && (await prisma.guiaTallas.count()) === 0) {
    await prisma.guiaTallas.create({
      data: {
        categoria_id: catPolos.id,
        nombre: 'Guía de tallas — Polos',
        nota: 'Medidas en centímetros, tomadas sobre la prenda estirada. Si estás entre dos tallas, elige la mayor para un calce holgado.',
        datos: JSON.stringify({
          columnas: ['Talla', 'Pecho', 'Largo', 'Hombro', 'Manga'],
          filas: [
            ['S', '52', '68', '46', '21'],
            ['M', '55', '71', '48', '22'],
            ['L', '58', '74', '50', '23'],
            ['XL', '61', '77', '52', '24'],
          ],
        }),
      },
    });
    console.log('Guía de tallas de polos creada\n');
  }

  // ---------------------------------------------------------------- cupones
  for (const c of CUPONES) {
    await prisma.cupon.upsert({
      where: { codigo: c.codigo },
      update: {},
      create: {
        codigo: c.codigo,
        porcentaje: c.porcentaje ?? null,
        montoFijo: c.montoFijo ?? null,
        usoMaximo: c.usoMaximo,
        usos: c.usoMaximo ? entre(0, Math.min(10, c.usoMaximo)) : entre(0, 25),
        iniciaEn: hace(30),
        terminaEn: c.caducado ? hace(5) : hace(-60),
        activo: true,
      },
    });
  }
  console.log(`Cupones: ${CUPONES.length} (uno caducado a propósito)\n`);

  const cupones = await prisma.cupon.findMany({ select: { id: true } });

  // ---------------------------------------------------------------- clientes
  const idsCliente: number[] = [];

  for (const c of CLIENTES) {
    const cliente = await prisma.cliente.upsert({
      where: { email: c.email },
      update: {},
      create: {
        // Sin login real de Google: un id estable derivado del correo.
        googleId: `prueba-${createHash('sha256').update(c.email).digest('hex').slice(0, 20)}`,
        email: c.email,
        nombre: c.nombre,
        avatar: null,
        aceptaNovedades: c.novedades,
        ultimoAcceso: hace(entre(0, 20)),
      },
      select: { id: true },
    });

    idsCliente.push(cliente.id);
  }

  const conNovedades = CLIENTES.filter((c) => c.novedades).length;
  console.log(
    `Clientes: ${idsCliente.length} (${conNovedades} aceptan novedades)\n`,
  );

  // ---------------------------------------------------------------- favoritos
  let favoritos = 0;

  for (const clienteId of idsCliente) {
    const cuantos = entre(1, 5);
    const elegidos = new Set<number>();

    while (elegidos.size < Math.min(cuantos, creados.length)) {
      elegidos.add(elegir(creados).id);
    }

    for (const productoId of elegidos) {
      await prisma.favorito
        .create({ data: { producto_id: productoId, cliente_id: clienteId } })
        .then(() => favoritos++)
        .catch(() => undefined);
    }
  }

  // Algunos favoritos anónimos, por dispositivo.
  for (let i = 0; i < 6; i++) {
    await prisma.favorito
      .create({
        data: {
          producto_id: elegir(creados).id,
          dispositivo: randomUUID(),
        },
      })
      .then(() => favoritos++)
      .catch(() => undefined);
  }

  console.log(`Favoritos: ${favoritos}\n`);

  // ---------------------------------------------------------------- leads
  // Repartidos en 60 días, con estados coherentes: los recientes siguen
  // NUEVO y los antiguos ya se resolvieron.
  const ORIGENES = [
    OrigenLead.DETALLE_PRODUCTO,
    OrigenLead.DETALLE_PRODUCTO,
    OrigenLead.DETALLE_PRODUCTO,
    OrigenLead.CATALOGO,
    OrigenLead.CATALOGO,
    OrigenLead.INICIO,
    OrigenLead.OTRO,
  ];

  const NOTAS_VENDIDO = [
    'Coordinado por WhatsApp, pago con Yape. Enviado por Olva.',
    'Recogió en tienda. Pidió cambio de talla y se resolvió en el momento.',
    'Pagó con transferencia. Pidió factura.',
    'Compró dos unidades, se le aplicó el cupón.',
  ];

  const NOTAS_PERDIDO = [
    'No respondió después de la cotización.',
    'Preguntó por una talla agotada y no quiso esperar reposición.',
    'Le pareció caro el envío a provincia.',
    'Compró en otra tienda.',
  ];

  const NOTAS_CONTACTADO = [
    'Consultó disponibilidad, quedó en confirmar mañana.',
    'Pidió fotos reales de la prenda. Enviadas.',
    'Preguntó por descuento en compra de 3 unidades.',
    'Quiere pagar contra entrega, verificando cobertura.',
  ];

  let leads = 0;
  const porEstado: Record<string, number> = {};

  const leadsExistentes = await prisma.leadWhatsApp.count();
  const objetivo = 120;
  const aCrear = Math.max(objetivo - leadsExistentes, 0);

  if (aCrear === 0) {
    console.log(`Leads: ya hay ${leadsExistentes}, no se crean más`);
  }

  for (let i = 0; i < aCrear; i++) {
    const producto = elegir(creados);
    if (producto.variantes.length === 0) continue;

    const varianteId = elegir(producto.variantes);
    const diasAtras = entre(0, 60);

    // Cuanto más antiguo el lead, más probable que ya esté resuelto.
    let estado: EstadoLead;
    let nota: string | null = null;

    if (diasAtras <= 3) {
      estado = EstadoLead.NUEVO;
    } else if (diasAtras <= 10) {
      const r = aleatorio();
      if (r < 0.35) {
        estado = EstadoLead.NUEVO;
      } else if (r < 0.8) {
        estado = EstadoLead.CONTACTADO;
        nota = elegir(NOTAS_CONTACTADO);
      } else {
        estado = EstadoLead.VENDIDO;
        nota = elegir(NOTAS_VENDIDO);
      }
    } else {
      const r = aleatorio();
      if (r < 0.3) {
        estado = EstadoLead.VENDIDO;
        nota = elegir(NOTAS_VENDIDO);
      } else if (r < 0.7) {
        estado = EstadoLead.PERDIDO;
        nota = elegir(NOTAS_PERDIDO);
      } else {
        estado = EstadoLead.CONTACTADO;
        nota = elegir(NOTAS_CONTACTADO);
      }
    }

    porEstado[estado] = (porEstado[estado] ?? 0) + 1;

    const variante = await prisma.varianteProducto.findUnique({
      where: { id: varianteId },
      select: {
        precio: true,
        talla: { select: { etiqueta: true } },
        color: { select: { nombre: true } },
        producto: { select: { nombre: true, precioDesde: true } },
      },
    });

    if (!variante) continue;

    const precio = Number(variante.precio ?? variante.producto.precioDesde ?? 0);
    const fecha = hace(diasAtras, entre(0, 23));

    // Uno de cada cinco leads llegó con cupón.
    const conCupon = aleatorio() < 0.2 && cupones.length > 0;

    const mensaje =
      `Hola! Me interesa este producto:\n\n` +
      `*${variante.producto.nombre}*\n` +
      `Talla ${variante.talla.etiqueta} / ${variante.color.nombre}\n` +
      `Precio: S/ ${precio.toFixed(2)}\n\n` +
      `https://ozzy.pe/producto/${slugificar(variante.producto.nombre)}`;

    await prisma.leadWhatsApp.create({
      data: {
        producto_id: producto.id,
        variante_id: varianteId,
        mensaje,
        origen: elegir(ORIGENES),
        estado,
        nota,
        telefono:
          estado === EstadoLead.NUEVO ? null : `+519${entre(10000000, 99999999)}`,
        precioMostrado: precio,
        huella: createHash('sha256')
          .update(`${producto.id}:${varianteId}:${i}`)
          .digest('hex')
          .slice(0, 32),
        cupon_id: conCupon ? elegir(cupones).id : null,
        createdAt: fecha,
        updatedAt: fecha,
      },
    });

    leads++;
  }

  console.log(`Leads: ${leads}`);
  for (const [estado, n] of Object.entries(porEstado).sort()) {
    console.log(`  ${estado}: ${n}`);
  }

  // ---------------------------------------------------------------- avisos stock
  // Suscripciones sobre variantes agotadas: es donde tienen sentido.
  const agotadas = await prisma.varianteProducto.findMany({
    where: { stock: 0 },
    select: { id: true, producto_id: true },
    take: 8,
  });

  let avisos = 0;

  for (const v of agotadas) {
    const cliente = elegir(CLIENTES);
    const token = randomUUID();

    await prisma.suscripcionStock
      .create({
        data: {
          producto_id: v.producto_id,
          variante_id: v.id,
          email: cliente.email,
          tokenBajaHash: createHash('sha256').update(token).digest('hex'),
          notificadoEn: null,
        },
      })
      .then(() => avisos++)
      .catch(() => undefined);
  }

  console.log(`\nAvisos de reposición: ${avisos}`);

  // ---------------------------------------------------------------- carritos
  let carritos = 0;

  for (let i = 0; i < 5; i++) {
    const producto = elegir(creados);
    if (producto.variantes.length === 0) continue;

    // Dos de cliente identificado, tres anónimos.
    const deCliente = i < 2;
    const fecha = hace(entre(1, 14));

    const carrito = await prisma.carrito
      .create({
        data: {
          cliente_id: deCliente ? idsCliente[i] : null,
          dispositivo: deCliente ? null : randomUUID(),
          createdAt: fecha,
          updatedAt: fecha,
        },
        select: { id: true },
      })
      .catch(() => null);

    if (!carrito) continue;

    const cuantas = entre(1, 3);
    const usadas = new Set<number>();

    for (let j = 0; j < cuantas; j++) {
      const otro = elegir(creados);
      if (otro.variantes.length === 0) continue;

      const varianteId = elegir(otro.variantes);
      if (usadas.has(varianteId)) continue;
      usadas.add(varianteId);

      await prisma.carritoItem
        .create({
          data: {
            carrito_id: carrito.id,
            variante_id: varianteId,
            cantidad: entre(1, 3),
          },
        })
        .catch(() => undefined);
    }

    carritos++;
  }

  console.log(`Carritos abandonados: ${carritos}`);

  // ---------------------------------------------------------------- resumen
  console.log('\n=== Resumen ===');
  for (const [n, c] of [
    ['productos', prisma.producto.count()],
    ['variantes', prisma.varianteProducto.count()],
    ['imagenes', prisma.imagenProducto.count()],
    ['clientes', prisma.cliente.count()],
    ['leads', prisma.leadWhatsApp.count()],
    ['favoritos', prisma.favorito.count()],
    ['cupones', prisma.cupon.count()],
    ['carritos', prisma.carrito.count()],
  ] as const) {
    console.log(`  ${n}: ${await c}`);
  }
}

main()
  .catch((e) => {
    console.error('\nFALLÓ:', (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
