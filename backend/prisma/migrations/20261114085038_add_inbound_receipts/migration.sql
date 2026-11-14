-- CreateTable
CREATE TABLE `InboundReceipt` (
    `id` VARCHAR(191) NOT NULL,
    `receiptId` VARCHAR(191) NOT NULL,
    `skuId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `expectedArrivalTime` DATETIME(3) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `status` ENUM('PLANNED', 'IN_TRANSIT', 'RECEIVED', 'CANCELED') NOT NULL DEFAULT 'PLANNED',
    `receivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `InboundReceipt_receiptId_key`(`receiptId`),
    INDEX `InboundReceipt_skuId_warehouseId_status_idx`(`skuId`, `warehouseId`, `status`),
    INDEX `InboundReceipt_expectedArrivalTime_idx`(`expectedArrivalTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `InboundReceipt` ADD CONSTRAINT `InboundReceipt_skuId_fkey` FOREIGN KEY (`skuId`) REFERENCES `SKU`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InboundReceipt` ADD CONSTRAINT `InboundReceipt_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
