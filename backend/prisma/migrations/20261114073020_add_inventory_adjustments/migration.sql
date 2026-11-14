-- CreateTable
CREATE TABLE `InventoryAdjustment` (
    `id` VARCHAR(191) NOT NULL,
    `skuId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `quantityChange` INTEGER NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InventoryAdjustment_skuId_warehouseId_createdAt_idx`(`skuId`, `warehouseId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `InventoryAdjustment` ADD CONSTRAINT `InventoryAdjustment_skuId_fkey` FOREIGN KEY (`skuId`) REFERENCES `SKU`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryAdjustment` ADD CONSTRAINT `InventoryAdjustment_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
