-- CreateTable
CREATE TABLE `worker_node_platform_capacities` (
    `id` VARCHAR(191) NOT NULL,
    `workerNodeId` VARCHAR(191) NOT NULL,
    `platformId` VARCHAR(191) NOT NULL,
    `maxRecordings` INTEGER NOT NULL DEFAULT 5,
    `currentRecordings` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `worker_node_platform_capacities_workerNodeId_platformId_key`(`workerNodeId`, `platformId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `worker_node_platform_capacities` ADD CONSTRAINT `worker_node_platform_capacities_workerNodeId_fkey` FOREIGN KEY (`workerNodeId`) REFERENCES `worker_nodes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `worker_node_platform_capacities` ADD CONSTRAINT `worker_node_platform_capacities_platformId_fkey` FOREIGN KEY (`platformId`) REFERENCES `platforms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
