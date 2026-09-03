-- AlterTable: la imagen puede pertenecer a un color concreto del producto.
-- NULL = imagen genérica, válida para cualquier color.
ALTER TABLE `imagen_producto` ADD COLUMN `color_id` INTEGER NULL;

-- CreateIndex: la galería se consulta siempre por (producto, color).
CREATE INDEX `imagen_producto_producto_id_color_id_orden_idx` ON `imagen_producto`(`producto_id`, `color_id`, `orden`);
CREATE INDEX `imagen_producto_producto_id_color_id_esPrincipal_idx` ON `imagen_producto`(`producto_id`, `color_id`, `esPrincipal`);
CREATE INDEX `imagen_producto_producto_id_color_id_esHover_idx` ON `imagen_producto`(`producto_id`, `color_id`, `esHover`);

-- AddForeignKey: si se borra el color, la imagen queda como genérica
-- en lugar de desaparecer.
ALTER TABLE `imagen_producto` ADD CONSTRAINT `imagen_producto_color_id_fkey` FOREIGN KEY (`color_id`) REFERENCES `color`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
