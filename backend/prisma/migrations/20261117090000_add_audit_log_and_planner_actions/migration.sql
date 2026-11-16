-- AlterTable
ALTER TABLE `Order` ADD COLUMN `splitFromOrderId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `OrderLine` ADD COLUMN `promiseOverrideReason` VARCHAR(500) NULL,
    ADD COLUMN `promisedShipDateOverride` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `entityType` ENUM('INBOUND_RECEIPT', 'ORDER', 'AI_INTERACTION') NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `entityRef` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(500) NULL,
    `actor` VARCHAR(191) NOT NULL DEFAULT 'planner',
    `before` JSON NULL,
    `after` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entityType_entityId_createdAt_idx`(`entityType`, `entityId`, `createdAt`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Order_splitFromOrderId_idx` ON `Order`(`splitFromOrderId`);

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_splitFromOrderId_fkey` FOREIGN KEY (`splitFromOrderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

