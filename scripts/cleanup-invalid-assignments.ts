import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface InvalidAssignment {
  id: string;
  taskId: string;
  livestreamWorkerAssignmentId: string;
  lwaId: string | null;
}

async function cleanupInvalidAssignments() {
  try {
    console.log('开始清理无效的任务-直播流-工作节点关联...');
    
    // 使用原始SQL查询找到无效的关联
    const invalidAssignments = await prisma.$queryRaw`
      SELECT tlwa.id
      FROM task_livestream_worker_assignments tlwa
      LEFT JOIN livestream_worker_assignments lwa ON tlwa.livestreamWorkerAssignmentId = lwa.id
      WHERE lwa.id IS NULL
    ` as { id: string }[];
    
    console.log(`找到 ${invalidAssignments.length} 条无效关联记录`);
    
    // 删除无效关联
    let deletedCount = 0;
    
    for (const item of invalidAssignments) {
      try {
        await prisma.$executeRaw`DELETE FROM task_livestream_worker_assignments WHERE id = ${item.id}`;
        console.log(`已删除记录: ${item.id}`);
        deletedCount++;
      } catch (error: any) {
        console.error(`删除记录 ${item.id} 失败:`, error?.message || error);
      }
    }
    
    console.log(`已删除 ${deletedCount} 条无效关联记录`);
    console.log('清理完成!');
  } catch (error) {
    console.error('清理无效关联失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行清理
cleanupInvalidAssignments()
  .then(() => console.log('脚本执行完成'))
  .catch(e => console.error('脚本执行出错:', e)); 