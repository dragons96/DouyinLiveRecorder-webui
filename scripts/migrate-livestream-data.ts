import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 此脚本用于将旧的TaskWorkerAssignment数据迁移到新的LiveStream和相关模型中
 */
async function migrateLivestreamData() {
  try {
    console.log('开始迁移数据...');
    
    // 1. 获取所有旧的TaskWorkerAssignment记录
    // 注意：由于我们已经删除了这个表，所以这里使用了原始查询
    // 如果数据库已经迁移，这一步可能无法工作，需要从备份中恢复数据
    const oldAssignments = await prisma.$queryRaw`
      SELECT * FROM task_worker_assignments
    `;
    
    console.log(`找到 ${Array.isArray(oldAssignments) ? oldAssignments.length : 0} 条旧记录`);
    
    if (!Array.isArray(oldAssignments) || oldAssignments.length === 0) {
      console.log('没有找到需要迁移的数据，可能表已被删除或为空');
      return;
    }
    
    // 2. 为每个流URL创建LiveStream记录
    for (const assignment of oldAssignments) {
      const { taskId, workerNodeId, streamUrl, status } = assignment;
      
      // 获取任务信息以获取平台ID
      const task = await prisma.recordingTask.findUnique({
        where: { id: taskId },
        select: { platformId: true }
      });
      
      if (!task) {
        console.log(`无法找到任务 ${taskId}，跳过`);
        continue;
      }
      
      // 2.1 检查LiveStream是否已存在
      let livestream = await prisma.liveStream.findUnique({
        where: { url: streamUrl as string }
      });
      
      // 2.2 如果不存在，创建新的LiveStream
      if (!livestream) {
        livestream = await prisma.liveStream.create({
          data: {
            url: streamUrl as string,
            platformId: task.platformId
          }
        });
        console.log(`创建新直播流: ${livestream.id} (${streamUrl})`);
      }
      
      // 3. 创建任务与直播流的关联
      const taskLivestreamAssignment = await prisma.taskLivestreamAssignment.create({
        data: {
          taskId: taskId as string,
          livestreamId: livestream.id,
          status: status as string
        }
      });
      console.log(`创建任务-直播流关联: ${taskLivestreamAssignment.id}`);
      
      // 4. 检查直播流与工作节点的关联是否存在
      let livestreamWorkerAssignment = await prisma.livestreamWorkerAssignment.findFirst({
        where: {
          livestreamId: livestream.id,
          workerNodeId: workerNodeId as string
        }
      });
      
      // 5. 如果不存在，创建新的关联；如果存在，增加引用计数
      if (!livestreamWorkerAssignment) {
        livestreamWorkerAssignment = await prisma.livestreamWorkerAssignment.create({
          data: {
            livestreamId: livestream.id,
            workerNodeId: workerNodeId as string,
            referenceCount: 1,
            status: status as string
          }
        });
        console.log(`创建直播流-工作节点关联: ${livestreamWorkerAssignment.id}`);
      } else {
        livestreamWorkerAssignment = await prisma.livestreamWorkerAssignment.update({
          where: { id: livestreamWorkerAssignment.id },
          data: {
            referenceCount: livestreamWorkerAssignment.referenceCount + 1
          }
        });
        console.log(`更新直播流-工作节点关联引用计数: ${livestreamWorkerAssignment.id} -> ${livestreamWorkerAssignment.referenceCount}`);
      }
    }
    
    console.log('数据迁移完成!');
  } catch (error) {
    console.error('数据迁移失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行迁移
migrateLivestreamData()
  .catch(e => {
    console.error(e);
    process.exit(1);
  }); 