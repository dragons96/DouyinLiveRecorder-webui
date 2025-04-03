import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { checkProjectAccess } from "@/lib/auth-utils"
import { updateWorkerNodeRecordingCount } from "../../../admin/worker-nodes/utils"

interface RouteParams {
  params: {
    id: string
  }
}

interface TaskLivestreamAssignment {
  id: string;
  livestreamId: string;
}

interface LivestreamWorkerAssignment {
  id: string;
  livestreamId: string;
  workerNodeId: string;
  referenceCount: number;
  taskId?: string;
  livestream?: {
    id: string;
    url: string;
    platformId?: string;
  };
}

// 定义任务分配关联类型
interface TaskAssignmentWithTask {
  task: {
    id: string;
    name: string;
    projectId: string;
    project?: {
      name: string;
    };
  };
}

// 检查当前直播流是否被其他任务使用
async function checkOtherTasksUsingStream(livestreamId: string, currentTaskId: string, prisma: any) {
  try {
    // 查询正在使用该直播流的其他任务
    const otherTaskAssignments = await prisma.taskLivestreamWorkerAssignment.findMany({
      where: {
        status: "PROCESSING",
        taskId: { not: currentTaskId },
        livestreamWorkerAssignment: {
          livestreamId: livestreamId
        }
      },
      include: {
        task: {
          select: {
            id: true,
            name: true,
            projectId: true,
            project: {
              select: {
                name: true
              }
            }
          }
        }
      }
    }) as TaskAssignmentWithTask[];
    
    if (otherTaskAssignments.length > 0) {
      console.log(`直播流(${livestreamId})还被以下${otherTaskAssignments.length}个其他任务使用:`);
      otherTaskAssignments.forEach((ta: TaskAssignmentWithTask, index: number) => {
        console.log(`  ${index + 1}. 任务ID: ${ta.task.id}, 名称: ${ta.task.name}, 项目: ${ta.task.project?.name || '未知项目'}`);
      });
      return true;
    } else {
      console.log(`直播流(${livestreamId})没有被其他任务使用`);
      return false;
    }
  } catch (error) {
    console.error(`检查直播流(${livestreamId})的使用情况时出错:`, error);
    return false;
  }
}

// 释放任务相关的直播流资源
async function releaseTaskLivestreams(taskId: string, projectId: string, prisma: any) {
  try {
    // 定义一个接口来表示从数据库返回的任务直播流工作节点分配
    interface TaskLivestreamWorkerAssignmentWithRelation {
      id: string;
      taskId: string;
      livestreamWorkerAssignmentId: string;
      status: string;
      livestreamWorkerAssignment: {
        id: string;
        livestreamId: string;
        workerNodeId: string;
        referenceCount: number;
        status: string;
        workerNode: {
          id: string;
          nodeId: string;
          projectId: string | null;
          status: string;
        };
        livestream: {
          id: string;
          url: string;
          platformId: string;
        };
      };
    }
    
    console.log(`准备释放任务(${taskId})的直播流资源, 项目ID: ${projectId}`);
    
    // 1. 查询当前任务的所有直播流工作节点分配，并且包含工作节点信息
    const taskAssignments = await prisma.taskLivestreamWorkerAssignment.findMany({
      where: { 
        taskId: taskId 
      },
      include: { 
        livestreamWorkerAssignment: {
          include: {
            workerNode: true,
            livestream: true
          }
        }
      }
    }) as TaskLivestreamWorkerAssignmentWithRelation[];
    
    // 过滤掉关联为null的记录
    const validAssignments = taskAssignments.filter(
      (assignment) => assignment.livestreamWorkerAssignment !== null
    );

    console.log(`找到${validAssignments.length}个任务直播流工作节点关联`);
    
    // 记录要更新引用计数的工作节点和平台
    const updatedWorkerIds = new Set<string>();
    const workerPlatformPairs = new Set<string>(); // 格式: "workerId:platformId"
    
    // 2. 对每个分配单独处理，确保只更新当前任务使用的资源
    for (const assignment of validAssignments) {
      try {
        const lwa = assignment.livestreamWorkerAssignment;
        const workerNode = lwa.workerNode;
        const platformId = lwa.livestream.platformId;
        
        console.log(`处理直播流(${lwa.livestream.url})的工作节点分配，节点ID: ${workerNode.nodeId}, 节点项目: ${workerNode.projectId || '通用'}, 当前任务项目: ${projectId}, 当前引用计数: ${lwa.referenceCount}`);
        
        // 检查该直播流是否被其他任务使用
        const isUsedByOtherTasks = await checkOtherTasksUsingStream(lwa.livestream.id, taskId, prisma);
        
        // 首先标记当前任务与该分配的关联为完成状态，这个总是要做的
        await prisma.taskLivestreamWorkerAssignment.update({
          where: { id: assignment.id },
          data: { status: "COMPLETED" }
        });
        
        // 决定是否减少引用计数，基于工作节点类型：
        
        // 情况1: 独享节点（当前项目专属）
        if (workerNode.projectId === projectId) {
          console.log(`工作节点${workerNode.nodeId}是当前项目(${projectId})的专属节点`);
          
          // 减少引用计数
          const newReferenceCount = Math.max(0, lwa.referenceCount - 1);
          
          // 更新数据
          await prisma.livestreamWorkerAssignment.update({
            where: { id: lwa.id },
            data: { 
              referenceCount: newReferenceCount,
              // 只有当引用计数变为0时才将状态改为COMPLETED，否则保持PROCESSING状态
              ...(newReferenceCount === 0 ? { status: "COMPLETED" } : {})
            }
          });
          
          console.log(`已更新直播流工作节点分配(${lwa.id})的引用计数: ${lwa.referenceCount} -> ${newReferenceCount}, 状态: ${newReferenceCount > 0 ? 'PROCESSING' : 'COMPLETED'}`);
          
          // 添加工作节点ID到更新列表
          updatedWorkerIds.add(lwa.workerNodeId);
          workerPlatformPairs.add(`${lwa.workerNodeId}:${platformId}`);
        }
        // 情况2: 通用节点
        else if (workerNode.projectId === null) {
          // 减少引用计数但保持状态决策 - 无论是否被其他任务使用，我们都需要减少引用计数
          const newReferenceCount = Math.max(0, lwa.referenceCount - 1);
          
          // 创建更新数据对象
          const updateData: any = { 
            referenceCount: newReferenceCount
          };
          
          // 注意: 只有在没有其他任务使用且引用计数将变为0时才更改状态为COMPLETED
          // 如果有其他任务使用，即使引用计数为0也不能设置状态为COMPLETED，防止释放其他项目的资源
          if (!isUsedByOtherTasks && newReferenceCount === 0) {
            updateData.status = "COMPLETED";
            console.log(`工作节点${workerNode.nodeId}是通用节点，直播流未被其他任务使用且引用计数将为0，设置状态为COMPLETED`);
          } else {
            console.log(`工作节点${workerNode.nodeId}是通用节点，${isUsedByOtherTasks ? '直播流被其他任务使用' : '引用计数仍大于0'}，保持状态为PROCESSING`);
            
            // 即使引用计数变为0，如果有其他任务使用，也要强制保持PROCESSING状态
            if (isUsedByOtherTasks && newReferenceCount === 0) {
              console.log(`警告: 通用节点上直播流引用计数将变为0但仍被其他任务使用，已强制保持PROCESSING状态防止错误释放资源`);
              
              // 如果引用计数为0但仍有其他任务使用，可以考虑修复计数以防止状态不一致
              updateData.referenceCount = 1;
              console.log(`已调整引用计数为1以保持与使用状态一致`);
            }
          }
          
          // 执行更新
          await prisma.livestreamWorkerAssignment.update({
            where: { id: lwa.id },
            data: updateData
          });
          
          console.log(`已更新通用节点上直播流分配(${lwa.id})的引用计数: ${lwa.referenceCount} -> ${updateData.referenceCount}, 状态: ${updateData.status || 'PROCESSING'}`);
          
          // 添加工作节点ID到更新列表
          updatedWorkerIds.add(lwa.workerNodeId);
          workerPlatformPairs.add(`${lwa.workerNodeId}:${platformId}`);
        }
        // 情况3: 其他项目的专属节点（这种情况不应该发生，但仍处理）
        else if (workerNode.projectId !== null && workerNode.projectId !== projectId) {
          console.log(`警告: 工作节点${workerNode.nodeId}属于项目(${workerNode.projectId})，而当前任务属于项目(${projectId})`);
          console.log(`由于项目隔离，不修改其他项目的专属节点录制状态`);
        }
        
      } catch (error) {
        console.error(`更新任务直播流工作节点分配 ${assignment.id} 失败:`, error);
      }
    }
    
    // 3. 更新任务与直播流的关联状态
    await prisma.taskLivestreamAssignment.updateMany({
      where: { taskId },
      data: { status: "COMPLETED" }
    });
    
    // 4. 更新所有受影响的工作节点的录制数
    for (const workerId of updatedWorkerIds) {
      try {
        await updateWorkerNodeRecordingCountInTransaction(workerId, prisma);
      } catch (error) {
        console.error(`更新工作节点 ${workerId} 的录制数失败:`, error);
      }
    }
    
    // 5. 更新所有受影响的工作节点平台特定录制数
    for (const pair of workerPlatformPairs) {
      try {
        const [workerId, platformId] = pair.split(':');
        await updateWorkerNodePlatformRecordingCountInTransaction(workerId, platformId, prisma);
      } catch (error) {
        console.error(`更新工作节点平台特定录制数失败:`, error);
      }
    }

    // 返回已更新的工作节点ID，以便事务之外再次检查
    return {
      updatedWorkerIds: Array.from(updatedWorkerIds)
    };
  } catch (error) {
    console.error("释放任务直播流资源失败:", error);
    throw error;
  }
}

// 事务内的工作节点录制数更新函数
async function updateWorkerNodeRecordingCountInTransaction(workerNodeId: string, prisma: any) {
  try {
    // 首先获取工作节点的信息，了解它是专属节点还是通用节点
    const workerNode = await prisma.workerNode.findUnique({
      where: { id: workerNodeId },
      select: {
        id: true,
        nodeId: true,
        projectId: true,
        status: true
      }
    });
    
    if (!workerNode) {
      console.error(`工作节点(${workerNodeId})不存在`);
      return 0;
    }
    
    console.log(`更新工作节点${workerNode.nodeId}的录制数，节点类型: ${workerNode.projectId ? '专属' : '通用'}`);
    
    // 使用不同的方法计算通用节点和专属节点的录制数
    let recordingCount = 0;
    
    if (workerNode.projectId === null) {
      // 对通用节点：计算有多少个不同的直播流URL具有活跃的任务
      
      // 1. 获取此工作节点上的所有直播流-工作节点分配，无论状态如何
      const allAssignments = await prisma.livestreamWorkerAssignment.findMany({
        where: {
          workerNodeId: workerNode.id
        },
        include: {
          livestream: true
        }
      });
      
      console.log(`通用节点(${workerNode.nodeId})上总共有${allAssignments.length}个直播流分配记录`);
      
      // 2. 对每个直播流分配，检查是否有活跃的任务使用它
      const uniqueActiveStreams = new Set<string>();
      const activeAssignmentIds = new Set<string>();
      const assignmentsToFix = [];
      
      for (const assignment of allAssignments) {
        // 查找使用此直播流分配且状态为PROCESSING的任务分配
        const activeTaskAssignments = await prisma.taskLivestreamWorkerAssignment.findMany({
          where: {
            livestreamWorkerAssignmentId: assignment.id,
            status: "PROCESSING"
          },
          include: {
            task: {
              select: {
                id: true,
                name: true,
                projectId: true
              }
            }
          }
        });
        
        if (activeTaskAssignments.length > 0) {
          // 记录有活跃任务的直播流
          uniqueActiveStreams.add(assignment.livestream.url);
          activeAssignmentIds.add(assignment.id);
          
          console.log(`直播流URL(${assignment.livestream.url})上有${activeTaskAssignments.length}个活跃任务:`);
          activeTaskAssignments.forEach((ta: TaskAssignmentWithTask, idx: number) => {
            console.log(`  ${idx + 1}. 任务ID: ${ta.task.id}, 项目ID: ${ta.task.projectId}`);
          });
          
          // 确保分配状态为PROCESSING且引用计数与活跃任务数量一致
          if (assignment.status !== "PROCESSING" || assignment.referenceCount !== activeTaskAssignments.length) {
            assignmentsToFix.push({
              id: assignment.id,
              url: assignment.livestream.url,
              currentStatus: assignment.status,
              currentRefCount: assignment.referenceCount,
              actualRefCount: activeTaskAssignments.length
            });
          }
        } else if (assignment.status === "PROCESSING" || assignment.referenceCount > 0) {
          // 没有活跃任务，但状态不一致
          console.log(`警告: 直播流URL(${assignment.livestream.url})没有关联的活跃任务，但状态为${assignment.status}，引用计数为${assignment.referenceCount}`);
          assignmentsToFix.push({
            id: assignment.id,
            url: assignment.livestream.url,
            currentStatus: assignment.status,
            currentRefCount: assignment.referenceCount,
            actualRefCount: 0
          });
        }
      }
      
      // 3. 修复状态不一致的分配
      if (assignmentsToFix.length > 0) {
        console.log(`修复${assignmentsToFix.length}个状态不一致的直播流-工作节点分配:`);
        
        for (const fix of assignmentsToFix) {
          const newStatus = fix.actualRefCount > 0 ? "PROCESSING" : "COMPLETED";
          console.log(`  修复: 直播流(${fix.url}) 从 [状态:${fix.currentStatus}, 引用:${fix.currentRefCount}] 更新为 [状态:${newStatus}, 引用:${fix.actualRefCount}]`);
          
          await prisma.livestreamWorkerAssignment.update({
            where: { id: fix.id },
            data: {
              status: newStatus,
              referenceCount: fix.actualRefCount
            }
          });
        }
      }
      
      // 4. 录制数等于有活跃任务的唯一直播流数量
      recordingCount = uniqueActiveStreams.size;
      
      console.log(`通用节点(${workerNode.nodeId})的最终录制数: ${recordingCount}，基于${uniqueActiveStreams.size}个有活跃任务的唯一直播流`);
      if (recordingCount > 0) {
        console.log(`活跃直播流: ${Array.from(uniqueActiveStreams).join(', ')}`);
      }
    } else {
      // 对专属节点：使用PROCESSING状态且引用计数>0的直播流数量
      const projectLWAssignments = await prisma.livestreamWorkerAssignment.findMany({
        where: {
          workerNodeId: workerNode.id,
          status: "PROCESSING",
          referenceCount: { gt: 0 }
        },
        include: {
          livestream: true
        }
      });
      
      recordingCount = projectLWAssignments.length;
      
      if (recordingCount > 0) {
        console.log(`专属节点(${workerNode.nodeId})的录制数(${recordingCount})对应以下直播流:`);
        projectLWAssignments.forEach((lwa: LivestreamWorkerAssignment, index: number) => {
          console.log(`  ${index + 1}. ${lwa.livestream?.url}, 引用计数: ${lwa.referenceCount}`);
        });
      } else {
        console.log(`专属节点(${workerNode.nodeId})没有活跃录制`);
      }
    }

    // 更新工作节点的当前录制数
    await prisma.workerNode.update({
      where: { id: workerNode.id },
      data: {
        currentRecordings: recordingCount
      }
    });

    console.log(`已更新工作节点(${workerNode.nodeId})的录制数为: ${recordingCount}`);
    return recordingCount;
  } catch (error) {
    console.error(`更新工作节点(${workerNodeId})录制数失败:`, error);
    throw error;
  }
}

// 事务内的工作节点平台特定录制数更新函数
async function updateWorkerNodePlatformRecordingCountInTransaction(workerNodeId: string, platformId: string, prisma: any) {
  try {
    // 获取该工作节点在特定平台上的所有直播流分配中引用计数大于0的记录数量
    const livestreamWorkerAssignments = await prisma.livestreamWorkerAssignment.findMany({
      where: {
        workerNodeId: workerNodeId,
        referenceCount: { gt: 0 }, // 只统计引用计数大于0的
        livestream: {
          platformId: platformId
        }
      },
      include: {
        livestream: true
      }
    });

    // 统计该平台的录制数量
    const recordingCount = livestreamWorkerAssignments.length;

    // 检查是否存在平台特定容量记录
    const platformCapacity = await prisma.$queryRaw`
      SELECT * FROM worker_node_platform_capacities 
      WHERE workerNodeId = ${workerNodeId} AND platformId = ${platformId}
      LIMIT 1
    `;

    if (!platformCapacity || (Array.isArray(platformCapacity) && platformCapacity.length === 0)) {
      // 如果不存在平台特定容量记录，则创建一个
      // 首先获取工作节点的默认录制数上限
      const workerNode = await prisma.workerNode.findUnique({
        where: { id: workerNodeId }
      });

      if (workerNode) {
        // 创建平台特定容量记录
        await prisma.$executeRaw`
          INSERT INTO worker_node_platform_capacities 
          (id, workerNodeId, platformId, maxRecordings, currentRecordings, createdAt, updatedAt)
          VALUES (
            ${`wnpc_${Date.now()}_${Math.floor(Math.random() * 1000)}`}, 
            ${workerNodeId}, 
            ${platformId}, 
            ${workerNode.maxRecordings}, 
            ${recordingCount}, 
            ${new Date()}, 
            ${new Date()}
          )
        `;
        
        console.log(`为工作节点 ${workerNodeId} 创建平台 ${platformId} 的容量配置，当前录制数：${recordingCount}`);
      }
    } else {
      // 如果存在平台特定容量记录，则更新它
      const capacityId = Array.isArray(platformCapacity) ? platformCapacity[0].id : platformCapacity.id;
      
      await prisma.$executeRaw`
        UPDATE worker_node_platform_capacities 
        SET currentRecordings = ${recordingCount}, updatedAt = ${new Date()}
        WHERE id = ${capacityId}
      `;
      
      console.log(`更新工作节点 ${workerNodeId} 平台 ${platformId} 的容量配置，当前录制数：${recordingCount}`);
    }

    return recordingCount;
  } catch (error) {
    console.error(`更新工作节点(${workerNodeId})在平台(${platformId})上的录制数失败:`, error);
    throw error;
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  
  try {
    // 获取任务信息和权限验证
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "未授权", success: false }, { status: 401 });
    }
    
    // 获取任务信息
    const task = await db.recordingTask.findUnique({
      where: { id },
      include: { project: true }
    });

    if (!task) {
      return NextResponse.json(
        { message: "任务不存在", success: false },
        { status: 404 }
      );
    }
    
    // 检查权限
    const hasAccess = await checkProjectAccess(session.user.id, task.projectId);
    if (!hasAccess && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "权限不足", success: false }, { status: 403 });
    }

    // 检查任务状态
    if (task.status !== "RUNNING") {
      return NextResponse.json(
        { message: "只有运行中的任务可以停止", success: false },
        { status: 400 }
      );
    }

    // 使用事务确保所有操作原子性
    await (db as any).$transaction(async (prisma: any) => {
      // 获取任务当前的启动时间
      const taskData = await prisma.recordingTask.findUnique({
        where: { id },
        select: { startedAt: true, streamUrls: true, platformParams: true }
      });
      
      // 当前时间作为结束时间
      const endTime = new Date();
      
      // 将任务相关的所有LivestreamWorkerAssignment的streamingStatus设置为UNKNOWN
      // 首先获取所有与当前任务相关的LivestreamWorkerAssignment的ID
      const taskAssignments = await prisma.taskLivestreamWorkerAssignment.findMany({
        where: { taskId: id },
        select: { livestreamWorkerAssignmentId: true }
      });
      
      // 提取LivestreamWorkerAssignment的ID数组
      const livestreamWorkerAssignmentIds = taskAssignments.map(
        (assignment) => assignment.livestreamWorkerAssignmentId
      );
      
      // 更新这些LivestreamWorkerAssignment的streamingStatus为UNKNOWN
      if (livestreamWorkerAssignmentIds.length > 0) {
        await prisma.livestreamWorkerAssignment.updateMany({
          where: { 
            id: { in: livestreamWorkerAssignmentIds }
          },
          data: { streamingStatus: "UNKNOWN" }
        });
      }
      
      // 查找该任务的未完成录制记录（endedAt为null的记录）
      const activeRecording = await prisma.recordingPeriod.findFirst({
        where: { 
          task: {
            id
          },
          endedAt: null
        },
        orderBy: { 
          startedAt: 'desc' 
        }
      });
      
      // 如果找到未完成的录制记录，更新其结束时间
      if (activeRecording) {
        await prisma.recordingPeriod.update({
          where: { id: activeRecording.id },
          data: { endedAt: endTime }
        });
      }

      // 释放任务相关的直播流资源
      await releaseTaskLivestreams(id, task.projectId, prisma);
      
      // 更新任务状态为暂停并记录结束时间
      await prisma.recordingTask.update({
        where: { id },
        data: { 
          status: "PAUSED",
          endedAt: endTime
        }
      });
    }, {
      timeout: 30000,
      isolationLevel: 'ReadCommitted',
    });

    return NextResponse.json({
      message: "任务已停止",
      taskId: id,
      status: "PAUSED",
      success: true
    });

  } catch (error) {
    console.error("停止任务失败:", error);
    return NextResponse.json(
      { message: "停止任务失败", error: String(error), success: false },
      { status: 500 }
    );
  }
}

