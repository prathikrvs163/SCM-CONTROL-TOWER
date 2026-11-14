-- CreateTable
CREATE TABLE `Order` (
    `id` VARCHAR(191) NOT NULL,
    `orderNumber` VARCHAR(191) NOT NULL,
    `customerName` VARCHAR(191) NOT NULL,
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL DEFAULT 'MEDIUM',
    `requestedShipDate` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'CONFIRMED', 'FULFILLING', 'SHIPPED', 'CANCELED') NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Order_orderNumber_key`(`orderNumber`),
    INDEX `Order_status_priority_idx`(`status`, `priority`),
    INDEX `Order_requestedShipDate_idx`(`requestedShipDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderLine` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `skuId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `preferredWarehouseId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OrderLine_orderId_idx`(`orderId`),
    INDEX `OrderLine_skuId_idx`(`skuId`),
    INDEX `OrderLine_preferredWarehouseId_idx`(`preferredWarehouseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OrderLine` ADD CONSTRAINT `OrderLine_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderLine` ADD CONSTRAINT `OrderLine_skuId_fkey` FOREIGN KEY (`skuId`) REFERENCES `SKU`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderLine` ADD CONSTRAINT `OrderLine_preferredWarehouseId_fkey` FOREIGN KEY (`preferredWarehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
