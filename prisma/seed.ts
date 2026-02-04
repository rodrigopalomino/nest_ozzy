import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta ${name} en .env`);
  return v;
}

async function main() {
  must('DATABASE_URL');

  const prisma = new PrismaClient();

  const categorias = [
    'Polos',
    'Casacas',
    'Hoodies',
    'Pantalones',
    'Accesorios',
  ];

  for (const nombre of categorias) {
    const slug = slugify(nombre);
    await prisma.categoria.upsert({
      where: { slug },
      update: { nombre },
      create: { nombre, slug },
    });
  }

  const colecciones = ['Drop Enero', 'Street 2026', 'Essential'];

  for (const nombre of colecciones) {
    const slug = slugify(nombre);
    await prisma.coleccion.upsert({
      where: { slug },
      update: { nombre },
      create: { nombre, slug },
    });
  }

  const insignias = ['NUEVO', 'OFERTA', 'TOP'];

  for (const nombre of insignias) {
    const slug = slugify(nombre);
    await prisma.insignia.upsert({
      where: { slug },
      update: { nombre },
      create: { nombre, slug },
    });
  }

  const tallas = ['S', 'M', 'L', 'XL'];
  await prisma.talla.createMany({
    data: tallas.map((etiqueta) => ({ etiqueta })),
    skipDuplicates: true,
  });

  const colores = [
    { nombre: 'Negro', hex: '#000000' },
    { nombre: 'Blanco', hex: '#FFFFFF' },
    { nombre: 'Rojo', hex: '#FF0000' },
  ];

  await prisma.color.createMany({
    data: colores,
    skipDuplicates: true,
  });

  console.log('✅ Seed OK');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Seed error:', e);
  process.exit(1);
});
