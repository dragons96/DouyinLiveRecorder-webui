-- CreateTable
CREATE TABLE `recording_periods` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `endedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `streamUrls` VARCHAR(191) NULL,
    `platformParams` VARCHAR(191) NULL,
    `workerData` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `recording_periods` ADD CONSTRAINT `recording_periods_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `recording_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
