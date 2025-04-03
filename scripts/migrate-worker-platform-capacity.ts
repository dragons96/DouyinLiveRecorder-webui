import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 该脚本用于迁移数据，为工作节点创建平台特定的录制容量配置
 * 将为每个工作节点创建与每个平台的关联，并设置默认容量
 */
async function migrateWorkerNodePlatformCapacity() {
  console.log('开始执行工作节点平台容量迁移...');
  
  try {
    // 获取所有工作节点
    const workerNodes = await prisma.workerNode.findMany();
    console.log(`共找到 ${workerNodes.length} 个工作节点`);

    // 获取所有平台
    const platforms = await prisma.platform.findMany();
    console.log(`共找到 ${platforms.length} 个平台`);
    
    if (platforms.length === 0) {
      console.error('未找到任何平台，无法完成迁移');
      return;
    }

    // 为每个工作节点创建与每个平台的容量配置
    let createdCount = 0;
    
    for (const node of workerNodes) {
      console.log(`处理工作节点: ${node.nodeId}`);
      
      // 获取该工作节点的所有引用计数大于0的LivestreamWorkerAssignment
      const lwAssignments = await prisma.livestreamWorkerAssignment.findMany({
        where: {
          workerNodeId: node.id,
          referenceCount: { gt: 0 }
        },
        include: {
          livestream: {
            include: {
              platform: true
            }
          }
        }
      });
      
      // 按平台分组并计算当前录制数
      const platformRecordings = new Map<string, number>();
      
      for (const assignment of lwAssignments) {
        if (assignment.livestream?.platform) {
          const platformId = assignment.livestream.platform.id;
          platformRecordings.set(
            platformId, 
            (platformRecordings.get(platformId) || 0) + 1
          );
        }
      }
      
      // 为每个平台创建容量配置
      for (const platform of platforms) {
        try {
          // 使用prisma.$queryRaw执行原始查询检查是否存在记录
          const existingCapacities = await prisma.$queryRaw`
            SELECT * FROM worker_node_platform_capacities 
            WHERE workerNodeId = ${node.id} AND platformId = ${platform.id}
            LIMIT 1
          `;
          
          // 如果没有记录，创建新记录
          if (!existingCapacities || (Array.isArray(existingCapacities) && existingCapacities.length === 0)) {
            // 获取该平台的当前录制数，如果没有则为0
            const currentRecordings = platformRecordings.get(platform.id) || 0;
            
            // 使用prisma.$executeRaw执行原始插入语句
            await prisma.$executeRaw`
              INSERT INTO worker_node_platform_capacities 
              (id, workerNodeId, platformId, maxRecordings, currentRecordings, createdAt, updatedAt)
              VALUES (
                ${`wnpc_${Date.now()}_${Math.floor(Math.random() * 1000)}`}, 
                ${node.id}, 
                ${platform.id}, 
                ${node.maxRecordings}, 
                ${currentRecordings}, 
                ${new Date()}, 
                ${new Date()}
              )
            `;
            
            console.log(`已为工作节点 ${node.nodeId} 创建平台 ${platform.name} 的容量配置：最大录制数=${node.maxRecordings}，当前录制数=${currentRecordings}`);
            createdCount++;
          } else {
            console.log(`工作节点 ${node.nodeId} 已存在平台 ${platform.name} 的容量配置，跳过`);
          }
        } catch (error) {
          console.error(`为工作节点 ${node.nodeId} 创建平台 ${platform.name} 的容量配置时出错:`, error);
        }
      }
    }
    
    console.log(`成功创建 ${createdCount} 个工作节点平台容量配置`);
    console.log('工作节点平台容量迁移完成!');
    
  } catch (error) {
    console.error('迁移失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行迁移
migrateWorkerNodePlatformCapacity()
  .catch(error => {
    console.error('迁移过程中出错:', error);
    process.exit(1);
  }); 