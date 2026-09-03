-- Carrito de compra que se cierra por WhatsApp.
--
-- No exige cuenta: hasta que el cliente inicia sesión el carrito se
-- identifica con el id de dispositivo (el mismo mecanismo que los
-- favoritos) y al entrar con Google se adopta.
--
-- No es un pedido: no hay estados de pago ni reserva de stock.

-- CreateTable
CREATE TABLE `carrito` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NULL,
    `dispositivo` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `carrito_updatedAt_idx`(`updatedAt`),
    UNIQUE INDEX `carrito_cliente_id_key`(`cliente_id`),
    UNIQUE INDEX `carrito_dispositivo_key`(`dispositivo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `carrito_item` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `carrito_id` INTEGER NOT NULL,
    `variante_id` INTEGER NOT NULL,
    `cantidad` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `carrito_item_variante_id_idx`(`variante_id`),
    UNIQUE INDEX `carrito_item_carrito_id_variante_id_key`(`carrito_id`, `variante_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `carrito` ADD CONSTRAINT `carrito_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carrito_item` ADD CONSTRAINT `carrito_item_carrito_id_fkey` FOREIGN KEY (`carrito_id`) REFERENCES `carrito`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carrito_item` ADD CONSTRAINT `carrito_item_variante_id_fkey` FOREIGN KEY (`variante_id`) REFERENCES `variante_producto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
