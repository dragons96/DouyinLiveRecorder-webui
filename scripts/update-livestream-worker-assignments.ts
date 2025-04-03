import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface LivestreamWorkerAssignment {
  id: string;
  livestreamId: string;
  workerNodeId: string;
  taskId: string | null;
  referenceCount: number;
  status: string;
}

async function updateLivestreamWorkerAssignments() {
  try {
    console.log('开始更新livestream_worker_assignments添加任务ID...');
    
    // 1. 获取所有TaskLivestreamAssignment
    const taskLivestreamAssignments = await prisma.taskLivestreamAssignment.findMany({
      include: {
        task: true,
      }
    });
    
    console.log(`找到 ${taskLivestreamAssignments.length} 个任务-直播流关联记录`);
    
    // 2. 获取所有LivestreamWorkerAssignment
    const livestreamWorkerAssignments = await prisma.livestreamWorkerAssignment.findMany({
      where: {
        // 只更新引用计数大于0的记录
        referenceCount: { gt: 0 },
        // 只更新未设置taskId的记录
        taskId: null
      }
    }) as LivestreamWorkerAssignment[];
    
    console.log(`找到 ${livestreamWorkerAssignments.length} 个需要更新的直播流-工作节点关联记录`);
    
    // 3. 为每个LivestreamWorkerAssignment查找对应的任务
    let updatedCount = 0;
    
    for (const assignment of livestreamWorkerAssignments) {
      // 查找使用该直播流的任务
      const matchingTaskAssignments = taskLivestreamAssignments.filter(
        ta => ta.livestreamId === assignment.livestreamId
      );
      
      if (matchingTaskAssignments.length > 0) {
        // 如果有多个任务使用该直播流，使用第一个任务的ID
        // 注意：这可能不是最准确的方法，但是在没有更多信息的情况下，这是最好的猜测
        const firstTaskAssignment = matchingTaskAssignments[0];
        
        // 更新LivestreamWorkerAssignment添加任务ID
        await prisma.livestreamWorkerAssignment.update({
          where: { id: assignment.id },
          data: {
            taskId: firstTaskAssignment.taskId
          }
        });
        
        updatedCount++;
        console.log(`已更新关联记录 ${assignment.id} -> 任务ID: ${firstTaskAssignment.taskId}`);
      } else {
        console.log(`警告: 直播流 ${assignment.livestreamId} 没有找到对应的任务`);
      }
    }
    
    console.log(`迁移完成! 共更新了 ${updatedCount} 条记录`);
    
    // 4. 更新所有工作节点的录制数
    console.log('开始更新所有工作节点的录制数...');
    const workerNodes = await prisma.workerNode.findMany();
    
    for (const node of workerNodes) {
      // 获取该工作节点的所有有效关联
      const nodeAssignments = await prisma.livestreamWorkerAssignment.findMany({
        where: {
          workerNodeId: node.id,
          referenceCount: { gt: 0 }
        }
      });
      
      // 计算唯一任务数
      const uniqueTaskIds = new Set(
        nodeAssignments
          .filter(a => a.taskId !== null)
          .map(a => a.taskId)
      );
      
      // 更新工作节点的当前录制数
      await prisma.workerNode.update({
        where: { id: node.id },
        data: {
          currentRecordings: uniqueTaskIds.size
        }
      });
      
      console.log(`更新工作节点 ${node.nodeId} 的录制数为 ${uniqueTaskIds.size}`);
    }
    
    console.log('所有工作节点录制数更新完成!');
    
  } catch (error) {
    console.error('更新失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行迁移
updateLivestreamWorkerAssignments()
  .then(() => console.log('脚本执行完成'))
  .catch(e => console.error('脚本执行出错:', e)); 