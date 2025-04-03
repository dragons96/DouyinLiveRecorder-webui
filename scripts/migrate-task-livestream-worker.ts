import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

interface LivestreamWorkerAssignment {
  id: string;
  livestreamId: string;
  workerNodeId: string;
  taskId?: string | null;
  referenceCount: number;
  status: string;
}

async function migrateTaskLivestreamWorker() {
  try {
    console.log('开始迁移任务-直播流-工作节点关联数据...');
    
    // 1. 获取所有LivestreamWorkerAssignment
    const livestreamWorkerAssignments = await prisma.livestreamWorkerAssignment.findMany({
      where: {
        referenceCount: { gt: 0 }  // 只迁移引用计数大于0的记录
      }
    }) as LivestreamWorkerAssignment[];
    
    console.log(`找到 ${livestreamWorkerAssignments.length} 个直播流-工作节点关联记录`);
    
    // 2. 查找所有任务-直播流关联
    const taskLivestreamAssignments = await prisma.taskLivestreamAssignment.findMany({
      where: {
        status: "PROCESSING"  // 只处理正在处理中的任务
      }
    });
    
    console.log(`找到 ${taskLivestreamAssignments.length} 个任务-直播流关联记录`);
    
    // 3. 创建新的任务-直播流-工作节点关联记录
    let createdCount = 0;
    
    // 先按taskId和livestreamId建立查找映射
    const taskStreamMap = new Map();
    for (const tas of taskLivestreamAssignments) {
      taskStreamMap.set(`${tas.taskId}-${tas.livestreamId}`, tas);
    }
    
    // 遍历每个LivestreamWorkerAssignment
    for (const lwa of livestreamWorkerAssignments) {
      // 查找使用该直播流的任务
      const matchingTasks = taskLivestreamAssignments.filter(
        tas => tas.livestreamId === lwa.livestreamId
      );
      
      // 如果存在对应的任务
      if (matchingTasks.length > 0) {
        for (const tas of matchingTasks) {
          try {
            // 先验证LivestreamWorkerAssignment是否存在
            const lwExists = await prisma.livestreamWorkerAssignment.findUnique({
              where: { id: lwa.id }
            });
            
            if (!lwExists) {
              console.error(`直播流工作节点(${lwa.id})不存在，跳过创建关联`);
              continue;
            }
            
            // 检查关联是否已存在
            const existing = await prisma.$queryRaw`
              SELECT id FROM task_livestream_worker_assignments 
              WHERE taskId = ${tas.taskId} AND livestreamWorkerAssignmentId = ${lwa.id}
            ` as any[];
            
            if (existing.length === 0) {
              // 创建新的任务-直播流-工作节点关联
              await prisma.$executeRaw`
                INSERT INTO task_livestream_worker_assignments (id, taskId, livestreamWorkerAssignmentId, status, createdAt, updatedAt)
                VALUES (${crypto.randomUUID()}, ${tas.taskId}, ${lwa.id}, ${tas.status}, ${new Date()}, ${new Date()})
              `;
              
              createdCount++;
              console.log(`创建新关联: 任务(${tas.taskId}) -> 直播流工作节点(${lwa.id})`);
            }
          } catch (error) {
            console.error(`处理关联失败: 任务(${tas.taskId}) -> 直播流工作节点(${lwa.id})`, error);
          }
        }
      } else {
        // 如果没有找到对应的任务-直播流关联，但LivestreamWorkerAssignment有taskId
        // 这是之前版本留下的数据
        if (lwa.taskId) {
          // 先确保TaskLivestreamAssignment存在
          const taskLivestreamExisting = await prisma.taskLivestreamAssignment.findFirst({
            where: {
              taskId: lwa.taskId,
              livestreamId: lwa.livestreamId
            }
          });
          
          if (taskLivestreamExisting) {
            // 创建新的任务-直播流-工作节点关联
            const existing = await prisma.taskLivestreamWorkerAssignment.findFirst({
              where: {
                taskId: lwa.taskId,
                livestreamWorkerAssignmentId: lwa.id
              }
            });
            
            if (!existing) {
              try {
                // 检查LivestreamWorkerAssignment是否存在
                const lwCheck = await prisma.livestreamWorkerAssignment.findUnique({
                  where: { id: lwa.id }
                });
                
                if (lwCheck) {
                  await prisma.taskLivestreamWorkerAssignment.create({
                    data: {
                      taskId: lwa.taskId,
                      livestreamWorkerAssignmentId: lwa.id,
                      status: lwa.status
                    }
                  });
                  
                  createdCount++;
                  console.log(`通过taskId创建新关联: 任务(${lwa.taskId}) -> 直播流工作节点(${lwa.id})`);
                } else {
                  console.error(`直播流工作节点(${lwa.id})不存在，无法创建关联`);
                }
              } catch (error) {
                console.error(`通过taskId创建关联失败: 任务(${lwa.taskId}) -> 直播流工作节点(${lwa.id})`, error);
              }
            }
          }
        } else {
          console.log(`警告: 直播流-工作节点关联 ${lwa.id} 没有找到对应的任务`);
        }
      }
    }
    
    console.log(`迁移完成! 共创建了 ${createdCount} 条任务-直播流-工作节点关联记录`);
    
    // 4. 更新所有工作节点的录制数
    console.log('开始更新所有工作节点的录制数...');
    
    const workerNodes = await prisma.workerNode.findMany();
    let updatedNodeCount = 0;
    
    for (const node of workerNodes) {
      try {
        // 获取该工作节点的所有引用计数大于0的LivestreamWorkerAssignment
        const lwAssignments = await prisma.livestreamWorkerAssignment.findMany({
          where: {
            workerNodeId: node.id,
            referenceCount: { gt: 0 }
          }
        });
        
        // 直接使用记录数量作为当前录制数
        const recordingCount = lwAssignments.length;
        
        // 更新工作节点的当前录制数
        await prisma.workerNode.update({
          where: { id: node.id },
          data: { currentRecordings: recordingCount }
        });
        
        console.log(`更新工作节点 ${node.nodeId} 的录制数为 ${recordingCount}`);
        updatedNodeCount++;
      } catch (error) {
        console.error(`更新工作节点 ${node.nodeId} 失败:`, error);
      }
    }
    
    console.log(`工作节点录制数更新完成! 共更新 ${updatedNodeCount} 个节点`);
    
  } catch (error) {
    console.error('迁移失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行迁移
migrateTaskLivestreamWorker()
  .then(() => console.log('脚本执行完成'))
  .catch(e => console.error('脚本执行出错:', e)); 