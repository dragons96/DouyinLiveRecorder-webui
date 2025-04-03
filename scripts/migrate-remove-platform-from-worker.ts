import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 该脚本用于迁移数据，将工作节点的platformId字段关联删除后，确保系统正常运行
 * 由于数据库迁移已经删除了platformId字段，此脚本主要用于确保系统中的数据状态一致
 */
async function migrateWorkerNodes() {
  console.log('开始执行工作节点迁移...');
  
  try {
    // 获取所有工作节点
    const workerNodes = await prisma.workerNode.findMany();
    console.log(`共找到 ${workerNodes.length} 个工作节点`);
    
    // 更新所有工作节点的录制数
    console.log('更新所有工作节点的录制数...');
    let updatedCount = 0;
    
    for (const node of workerNodes) {
      try {
        // 获取该工作节点的所有引用计数大于0的LivestreamWorkerAssignment
        const lwAssignments = await prisma.livestreamWorkerAssignment.findMany({
          where: {
            workerNodeId: node.id,
            referenceCount: { gt: 0 }
          }
        });
        
        // 使用记录数量作为当前录制数
        const recordingCount = lwAssignments.length;
        
        // 更新工作节点的当前录制数
        await prisma.workerNode.update({
          where: { id: node.id },
          data: { currentRecordings: recordingCount }
        });
        
        console.log(`已更新工作节点 ${node.nodeId} 的录制数为 ${recordingCount}`);
        updatedCount++;
      } catch (error) {
        console.error(`更新工作节点 ${node.nodeId} 失败:`, error);
      }
    }
    
    console.log(`成功更新 ${updatedCount} 个工作节点的录制数`);
    console.log('工作节点迁移完成!');
    
  } catch (error) {
    console.error('迁移失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行迁移
migrateWorkerNodes()
  .catch(error => {
    console.error('迁移过程中出错:', error);
    process.exit(1);
  }); 