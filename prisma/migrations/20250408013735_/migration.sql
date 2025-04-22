-- AlterTable
ALTER TABLE `livestream_worker_assignments` ADD COLUMN `streamingStatus` VARCHAR(191) NOT NULL DEFAULT 'UNKNOWN';

-- AlterTable
ALTER TABLE `recording_periods` MODIFY `endedAt` DATETIME(3) NULL,
    MODIFY `streamUrls` TEXT NULL,
    MODIFY `platformParams` TEXT NULL,
    MODIFY `workerData` TEXT NULL;

-- AlterTable
ALTER TABLE `recording_tasks` MODIFY `streamUrls` TEXT NOT NULL,
    MODIFY `platformParams` TEXT NULL;
