import { PrismaClient } from "@prisma/client"
import { db } from "@/lib/db"

// 定义接口
interface LivestreamWorkerAssignmentId {
  id: string;
}

interface TaskGroup {
  taskId: string;
}

interface PlatformCapacity {
  id: string;
  platformId: string;
  currentRecordings: number;
}

/**
 * 更新工作节点的当前录制数
 * 基于所有平台的累计录制数量
 */
export async function updateWorkerNodeRecordingCount(workerNodeId: string) {
  try {
    // 1. 获取工作节点的所有平台容量配置
    const platformCapacities = await (db as any).workerNodePlatformCapacity.findMany({
      where: {
        workerNodeId: workerNodeId
      },
      select: {
        id: true,
        platformId: true,
        currentRecordings: true
      }
    }) as PlatformCapacity[];

    // 计算所有平台容量的总和
    const platformTotalRecordings = platformCapacities.reduce(
      (sum, capacity) => sum + capacity.currentRecordings, 
      0
    );

    // 如果有平台特定容量配置，使用所有平台的总和作为当前录制数
    if (platformCapacities.length > 0) {
      console.log(`工作节点(${workerNodeId})的平台特定录制数总和: ${platformTotalRecordings}`);

      // 更新工作节点的当前录制数为所有平台的总和
      await (db as any).workerNode.update({
        where: { id: workerNodeId },
        data: {
          currentRecordings: platformTotalRecordings
        }
      });

      return platformTotalRecordings;
    } 
    // 如果没有平台特定配置，则使用传统方法计算
    else {
      // 获取该工作节点的所有直播流分配中引用计数大于0的记录数量
      const livestreamWorkerAssignments = await (db as any).livestreamWorkerAssignment.findMany({
        where: {
          workerNodeId: workerNodeId,
          referenceCount: { gt: 0 } // 只统计引用计数大于0的
        }
      });

      // 直接使用记录数量作为当前录制数
      const recordingCount = livestreamWorkerAssignments.length;
      
      console.log(`工作节点(${workerNodeId})没有平台特定配置，使用传统方法计算录制数: ${recordingCount}`);

      // 更新工作节点的当前录制数
      await (db as any).workerNode.update({
        where: { id: workerNodeId },
        data: {
          currentRecordings: recordingCount
        }
      });

      return recordingCount;
    }
  } catch (error) {
    console.error(`更新工作节点(${workerNodeId})录制数失败:`, error);
    throw error;
  }
}

/**
 * 更新所有工作节点的录制数
 */
export async function updateAllWorkerNodesRecordingCounts() {
  try {
    // 获取所有工作节点
    const workerNodes = await (db as any).workerNode.findMany();
    
    // 对每个工作节点更新录制数
    for (const node of workerNodes) {
      await updateWorkerNodeRecordingCount(node.id);
    }
    
    return workerNodes.length;
  } catch (error) {
    console.error("更新所有工作节点录制数失败:", error);
    throw error;
  }
} 