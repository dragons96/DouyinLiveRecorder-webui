-- CreateTable
CREATE TABLE `recorded_videos` (
    `id` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `originalFilename` VARCHAR(191) NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `fileType` VARCHAR(191) NOT NULL,
    `recordName` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `periodId` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `recorded_videos` ADD CONSTRAINT `recorded_videos_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `recording_tasks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recorded_videos` ADD CONSTRAINT `recorded_videos_periodId_fkey` FOREIGN KEY (`periodId`) REFERENCES `recording_periods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
