-- Ampliación del dominio: clientes con Google, notificaciones, CRM de leads,
-- curaduría del catálogo, SEO, imágenes responsive, auditoría y cupones.
--
-- Sólo añade tablas, columnas e índices: no hay DROP ni pérdida de datos.
-- Las columnas de texto pasan de VARCHAR(191) a TEXT (amplían, no truncan).

-- AlterTable
ALTER TABLE `usuario` ADD COLUMN `tokenVersion` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `ultimoAcceso` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `producto` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `destacado` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `metaDescripcion` TEXT NULL,
    ADD COLUMN `metaTitulo` VARCHAR(191) NULL,
    ADD COLUMN `ogImagen` VARCHAR(191) NULL,
    ADD COLUMN `orden` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `precioDesde` DECIMAL(10, 2) NULL,
    ADD COLUMN `version` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `vistas` INTEGER NOT NULL DEFAULT 0,
    MODIFY `descripcion` TEXT NULL;

-- AlterTable
ALTER TABLE `imagen_producto` ADD COLUMN `alto` INTEGER NULL,
    ADD COLUMN `ancho` INTEGER NULL,
    ADD COLUMN `blurData` TEXT NULL,
    ADD COLUMN `urlLg` VARCHAR(191) NULL,
    ADD COLUMN `urlMd` VARCHAR(191) NULL,
    ADD COLUMN `urlSm` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `categoria` ADD COLUMN `metaDescripcion` TEXT NULL,
    ADD COLUMN `metaTitulo` VARCHAR(191) NULL,
    ADD COLUMN `orden` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `coleccion` ADD COLUMN `destacada` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `metaDescripcion` TEXT NULL,
    ADD COLUMN `metaTitulo` VARCHAR(191) NULL,
    ADD COLUMN `orden` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `lead` ADD COLUMN `cupon_id` INTEGER NULL,
    ADD COLUMN `estado` ENUM('NUEVO', 'CONTACTADO', 'VENDIDO', 'PERDIDO') NOT NULL DEFAULT 'NUEVO',
    ADD COLUMN `huella` VARCHAR(191) NULL,
    ADD COLUMN `nota` TEXT NULL,
    ADD COLUMN `precioMostrado` DECIMAL(10, 2) NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    MODIFY `mensaje` TEXT NOT NULL;

-- CreateTable
CREATE TABLE `refresh_token` (
    `id` VARCHAR(191) NOT NULL,
    `usuario_id` INTEGER NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiraEn` DATETIME(3) NOT NULL,
    `revocadoEn` DATETIME(3) NULL,
    `userAgent` VARCHAR(191) NULL,
    `ip` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_token_tokenHash_key`(`tokenHash`),
    INDEX `refresh_token_usuario_id_revocadoEn_idx`(`usuario_id`, `revocadoEn`),
    INDEX `refresh_token_expiraEn_idx`(`expiraEn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cliente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `google_id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `avatar` VARCHAR(191) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `aceptaNovedades` BOOLEAN NOT NULL DEFAULT false,
    `ultimoAcceso` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cliente_google_id_key`(`google_id`),
    UNIQUE INDEX `cliente_email_key`(`email`),
    INDEX `cliente_activo_idx`(`activo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `suscripcion_stock` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `producto_id` INTEGER NOT NULL,
    `variante_id` INTEGER NULL,
    `cliente_id` INTEGER NULL,
    `email` VARCHAR(191) NOT NULL,
    `tokenBajaHash` VARCHAR(191) NOT NULL,
    `notificadoEn` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `suscripcion_stock_tokenBajaHash_key`(`tokenBajaHash`),
    INDEX `suscripcion_stock_producto_id_notificadoEn_idx`(`producto_id`, `notificadoEn`),
    INDEX `suscripcion_stock_email_idx`(`email`),
    UNIQUE INDEX `suscripcion_stock_variante_id_email_key`(`variante_id`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `favorito` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `producto_id` INTEGER NOT NULL,
    `cliente_id` INTEGER NULL,
    `dispositivo` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `favorito_cliente_id_idx`(`cliente_id`),
    INDEX `favorito_dispositivo_idx`(`dispositivo`),
    UNIQUE INDEX `favorito_producto_id_cliente_id_key`(`producto_id`, `cliente_id`),
    UNIQUE INDEX `favorito_producto_id_dispositivo_key`(`producto_id`, `dispositivo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notificacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NULL,
    `email` VARCHAR(191) NOT NULL,
    `tipo` ENUM('STOCK_DISPONIBLE', 'BIENVENIDA', 'NOVEDADES', 'OFERTA') NOT NULL,
    `canal` ENUM('EMAIL') NOT NULL DEFAULT 'EMAIL',
    `estado` ENUM('PENDIENTE', 'ENVIADA', 'FALLIDA') NOT NULL DEFAULT 'PENDIENTE',
    `asunto` VARCHAR(191) NOT NULL,
    `cuerpo` TEXT NOT NULL,
    `intentos` INTEGER NOT NULL DEFAULT 0,
    `error` TEXT NULL,
    `enviadaEn` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `notificacion_estado_createdAt_idx`(`estado`, `createdAt`),
    INDEX `notificacion_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `configuracion` (
    `clave` VARCHAR(191) NOT NULL,
    `valor` TEXT NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`clave`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auditoria` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_id` INTEGER NULL,
    `usuarioNombre` VARCHAR(191) NULL,
    `entidad` VARCHAR(191) NOT NULL,
    `entidadId` VARCHAR(191) NOT NULL,
    `accion` ENUM('CREAR', 'ACTUALIZAR', 'ELIMINAR') NOT NULL,
    `cambios` TEXT NULL,
    `ip` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `auditoria_entidad_entidadId_createdAt_idx`(`entidad`, `entidadId`, `createdAt`),
    INDEX `auditoria_usuario_id_createdAt_idx`(`usuario_id`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `redireccion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `entidad` VARCHAR(191) NOT NULL,
    `slugViejo` VARCHAR(191) NOT NULL,
    `slugNuevo` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `redireccion_slugNuevo_idx`(`slugNuevo`),
    UNIQUE INDEX `redireccion_entidad_slugViejo_key`(`entidad`, `slugViejo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cupon` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(191) NOT NULL,
    `porcentaje` INTEGER NULL,
    `montoFijo` DECIMAL(10, 2) NULL,
    `iniciaEn` DATETIME(3) NULL,
    `terminaEn` DATETIME(3) NULL,
    `usoMaximo` INTEGER NULL,
    `usos` INTEGER NOT NULL DEFAULT 0,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cupon_codigo_key`(`codigo`),
    INDEX `cupon_activo_codigo_idx`(`activo`, `codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `guia_tallas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `categoria_id` INTEGER NULL,
    `producto_id` INTEGER NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `datos` TEXT NOT NULL,
    `nota` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `guia_tallas_producto_id_key`(`producto_id`),
    INDEX `guia_tallas_categoria_id_idx`(`categoria_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `producto_relacionado` (
    `producto_id` INTEGER NOT NULL,
    `relacionado_id` INTEGER NOT NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,

    INDEX `producto_relacionado_relacionado_id_idx`(`relacionado_id`),
    PRIMARY KEY (`producto_id`, `relacionado_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `producto_estado_destacado_orden_idx` ON `producto`(`estado`, `destacado`, `orden`);

-- CreateIndex
CREATE INDEX `producto_estado_precioDesde_idx` ON `producto`(`estado`, `precioDesde`);

-- CreateIndex
CREATE INDEX `producto_estado_vistas_idx` ON `producto`(`estado`, `vistas`);

-- CreateIndex
CREATE INDEX `producto_deletedAt_idx` ON `producto`(`deletedAt`);

-- CreateIndex
CREATE FULLTEXT INDEX `producto_nombre_descripcion_idx` ON `producto`(`nombre`, `descripcion`);

-- CreateIndex
CREATE INDEX `lead_estado_createdAt_idx` ON `lead`(`estado`, `createdAt`);

-- CreateIndex
CREATE INDEX `lead_huella_createdAt_idx` ON `lead`(`huella`, `createdAt`);

-- AddForeignKey
ALTER TABLE `refresh_token` ADD CONSTRAINT `refresh_token_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead` ADD CONSTRAINT `lead_cupon_id_fkey` FOREIGN KEY (`cupon_id`) REFERENCES `cupon`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `suscripcion_stock` ADD CONSTRAINT `suscripcion_stock_producto_id_fkey` FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `suscripcion_stock` ADD CONSTRAINT `suscripcion_stock_variante_id_fkey` FOREIGN KEY (`variante_id`) REFERENCES `variante_producto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `suscripcion_stock` ADD CONSTRAINT `suscripcion_stock_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `cliente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favorito` ADD CONSTRAINT `favorito_producto_id_fkey` FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favorito` ADD CONSTRAINT `favorito_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notificacion` ADD CONSTRAINT `notificacion_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `cliente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auditoria` ADD CONSTRAINT `auditoria_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `guia_tallas` ADD CONSTRAINT `guia_tallas_categoria_id_fkey` FOREIGN KEY (`categoria_id`) REFERENCES `categoria`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `guia_tallas` ADD CONSTRAINT `guia_tallas_producto_id_fkey` FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `producto_relacionado` ADD CONSTRAINT `producto_relacionado_producto_id_fkey` FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `producto_relacionado` ADD CONSTRAINT `producto_relacionado_relacionado_id_fkey` FOREIGN KEY (`relacionado_id`) REFERENCES `producto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

