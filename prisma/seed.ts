import 'dotenv/config';
import { PrismaClient, RolUsuario } from '@prisma/client';
import * as argon2 from 'argon2';

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

  // =========================
  // CATEGORÍAS
  // =========================
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

  // =========================
  // COLECCIONES
  // =========================
  const colecciones = ['Drop Enero', 'Street 2026', 'Essential'];

  for (const nombre of colecciones) {
    const slug = slugify(nombre);
    await prisma.coleccion.upsert({
      where: { slug },
      update: { nombre },
      create: { nombre, slug },
    });
  }

  // =========================
  // INSIGNIAS
  // =========================
  const insignias = ['NUEVO', 'OFERTA', 'TOP'];

  for (const nombre of insignias) {
    const slug = slugify(nombre);
    await prisma.insignia.upsert({
      where: { slug },
      update: { nombre },
      create: { nombre, slug },
    });
  }

  // =========================
  // TALLAS
  // =========================
  const tallas = ['S', 'M', 'L', 'XL'];
  await prisma.talla.createMany({
    data: tallas.map((etiqueta) => ({ etiqueta })),
    skipDuplicates: true,
  });

  // =========================
  // COLORES
  // =========================
  const colores = [
    { nombre: 'Negro', hex: '#000000' },
    { nombre: 'Blanco', hex: '#FFFFFF' },
    { nombre: 'Rojo', hex: '#FF0000' },
  ];

  await prisma.color.createMany({
    data: colores,
    skipDuplicates: true,
  });

  // =========================
  // USUARIO ADMIN
  // =========================
  // La contraseña se toma de ADMIN_PASSWORD. Antes estaba fijada a 'admin'
  // en el código: cualquiera que conociera el repositorio podía entrar al
  // panel de una instalación recién desplegada.
  const adminUsername = process.env.ADMIN_USERNAME ?? 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD;

  const yaExiste = await prisma.usuario.findUnique({
    where: { username: adminUsername },
    select: { id: true },
  });

  if (yaExiste) {
    console.log(`ℹ️  El usuario "${adminUsername}" ya existe, no se modifica`);
  } else if (!adminPassword) {
    console.warn(
      '⚠️  No se creó el usuario administrador: falta ADMIN_PASSWORD en el entorno.\n' +
        '    Añádela al .env y vuelve a ejecutar el seed:\n' +
        '    ADMIN_PASSWORD="una-contraseña-larga" npm run seed',
    );
  } else {
    await prisma.usuario.create({
      data: {
        username: adminUsername,
        password: await argon2.hash(adminPassword),
        activo: true,
        rol: RolUsuario.ADMIN,
      },
    });

    console.log(`✅ Usuario administrador "${adminUsername}" creado`);
  }

  console.log('✅ Seed OK');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Seed error:', e);
  process.exit(1);
});
