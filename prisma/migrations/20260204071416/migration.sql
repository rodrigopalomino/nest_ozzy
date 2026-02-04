-- CreateTable
CREATE TABLE `producto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `estado` ENUM('ACTIVO', 'OCULTO', 'ARCHIVADO') NOT NULL DEFAULT 'ACTIVO',
    `precioBase` DECIMAL(10, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `producto_slug_key`(`slug`),
    INDEX `producto_estado_idx`(`estado`),
    INDEX `producto_nombre_idx`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `imagen_producto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `producto_id` INTEGER NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `alt` VARCHAR(191) NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,
    `tipo` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `imagen_producto_producto_id_orden_idx`(`producto_id`, `orden`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `video_producto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `producto_id` INTEGER NOT NULL,
    `plataforma` ENUM('INSTAGRAM', 'TIKTOK') NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `etiqueta` VARCHAR(191) NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `video_producto_producto_id_orden_idx`(`producto_id`, `orden`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categoria` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `categoria_slug_key`(`slug`),
    INDEX `categoria_activo_orden_idx`(`activo`, `orden`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coleccion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `imagenPortada` VARCHAR(191) NULL,
    `iniciaEn` DATETIME(3) NULL,
    `terminaEn` DATETIME(3) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `coleccion_slug_key`(`slug`),
    INDEX `coleccion_activo_idx`(`activo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `producto_categoria` (
    `producto_id` INTEGER NOT NULL,
    `categoria_id` INTEGER NOT NULL,
    `asignadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `producto_categoria_categoria_id_idx`(`categoria_id`),
    PRIMARY KEY (`producto_id`, `categoria_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `producto_coleccion` (
    `producto_id` INTEGER NOT NULL,
    `coleccion_id` INTEGER NOT NULL,
    `asignadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `producto_coleccion_coleccion_id_idx`(`coleccion_id`),
    PRIMARY KEY (`producto_id`, `coleccion_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `talla` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `etiqueta` VARCHAR(191) NOT NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `talla_etiqueta_key`(`etiqueta`),
    INDEX `talla_activo_orden_idx`(`activo`, `orden`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `color` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `hex` VARCHAR(191) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `color_nombre_key`(`nombre`),
    INDEX `color_activo_idx`(`activo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `variante_producto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `producto_id` INTEGER NOT NULL,
    `talla_id` INTEGER NOT NULL,
    `color_id` INTEGER NOT NULL,
    `sku` VARCHAR(191) NULL,
    `precio` DECIMAL(10, 2) NULL,
    `stock` INTEGER NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `variante_producto_sku_key`(`sku`),
    INDEX `variante_producto_producto_id_activo_idx`(`producto_id`, `activo`),
    UNIQUE INDEX `variante_producto_producto_id_talla_id_color_id_key`(`producto_id`, `talla_id`, `color_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `precio_producto` (
    `producto_id` INTEGER NOT NULL,
    `precioOriginal` DECIMAL(10, 2) NOT NULL,
    `porcentajeDescuento` INTEGER NOT NULL DEFAULT 0,
    `precioOferta` DECIMAL(10, 2) NULL,
    `iniciaEn` DATETIME(3) NULL,
    `terminaEn` DATETIME(3) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `precio_producto_activo_idx`(`activo`),
    PRIMARY KEY (`producto_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `insignia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `insignia_slug_key`(`slug`),
    INDEX `insignia_activo_idx`(`activo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `producto_insignia` (
    `producto_id` INTEGER NOT NULL,
    `insignia_id` INTEGER NOT NULL,
    `asignadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `producto_insignia_insignia_id_idx`(`insignia_id`),
    PRIMARY KEY (`producto_id`, `insignia_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `producto_id` INTEGER NOT NULL,
    `variante_id` INTEGER NULL,
    `telefono` VARCHAR(191) NULL,
    `mensaje` VARCHAR(191) NOT NULL,
    `origen` ENUM('INICIO', 'CATALOGO', 'DETALLE_PRODUCTO', 'OTRO') NOT NULL DEFAULT 'DETALLE_PRODUCTO',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lead_producto_id_createdAt_idx`(`producto_id`, `createdAt`),
    INDEX `lead_origen_createdAt_idx`(`origen`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `imagen_producto` ADD CONSTRAINT `imagen_producto_producto_id_fkey` FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_producto` ADD CONSTRAINT `video_producto_producto_id_fkey` FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `producto_categoria` ADD CONSTRAINT `producto_categoria_producto_id_fkey` FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `producto_categoria` ADD CONSTRAINT `producto_categoria_categoria_id_fkey` FOREIGN KEY (`categoria_id`) REFERENCES `categoria`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `producto_coleccion` ADD CONSTRAINT `producto_coleccion_producto_id_fkey` FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `producto_coleccion` ADD CONSTRAINT `producto_coleccion_coleccion_id_fkey` FOREIGN KEY (`coleccion_id`) REFERENCES `coleccion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `variante_producto` ADD CONSTRAINT `variante_producto_producto_id_fkey` FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `variante_producto` ADD CONSTRAINT `variante_producto_talla_id_fkey` FOREIGN KEY (`talla_id`) REFERENCES `talla`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `variante_producto` ADD CONSTRAINT `variante_producto_color_id_fkey` FOREIGN KEY (`color_id`) REFERENCES `color`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `precio_producto` ADD CONSTRAINT `precio_producto_producto_id_fkey` FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `producto_insignia` ADD CONSTRAINT `producto_insignia_producto_id_fkey` FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `producto_insignia` ADD CONSTRAINT `producto_insignia_insignia_id_fkey` FOREIGN KEY (`insignia_id`) REFERENCES `insignia`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead` ADD CONSTRAINT `lead_producto_id_fkey` FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead` ADD CONSTRAINT `lead_variante_id_fkey` FOREIGN KEY (`variante_id`) REFERENCES `variante_producto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
