/*
  Warnings:

  - You are about to drop the column `platformId` on the `worker_nodes` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `worker_nodes` DROP FOREIGN KEY `worker_nodes_platformId_fkey`;

-- DropIndex
DROP INDEX `worker_nodes_platformId_fkey` ON `worker_nodes`;

-- AlterTable
ALTER TABLE `worker_nodes` DROP COLUMN `platformId`;
