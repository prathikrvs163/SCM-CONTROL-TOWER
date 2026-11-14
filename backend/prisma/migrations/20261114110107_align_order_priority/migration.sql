/*
  Warnings:

  - You are about to alter the column `priority` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(0))` to `Enum(EnumId(1))`.

*/
-- AlterTable
ALTER TABLE `Order` MODIFY `priority` ENUM('LOW', 'MED', 'HIGH') NOT NULL DEFAULT 'MED';
