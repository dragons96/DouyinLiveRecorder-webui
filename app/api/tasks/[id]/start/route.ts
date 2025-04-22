import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { checkProjectAccess } from "@/lib/auth-utils"
import { RecordingTask } from "@prisma/client"
import { updateWorkerNodeRecordingCount } from "../../../admin/worker-nodes/utils"

// 自定义类型接口
interface Platform {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  apiKey: string | null;
  apiSecret: string | null;
}

// 自定义WorkerNode接口
interface WorkerNode {
  id: string;
  nodeId: string;
  status: string;
  projectId: string | null;
  maxRecordings: number;
  currentRecordings: number;
  platformCapacities?: Array<{
    id: string;
    platformId: string;
    maxRecordings: number;
    currentRecordings: number;
  }>;
  lastSeenAt?: string;
}

// 新增接口
interface LiveStream {
  id: string;
  url: string;
}

interface TaskLivestreamAssignment {
  id: string;
  taskId: string;
  livestreamId: string;
}

interface LivestreamWorkerAssignment {
  id: string;
  livestreamId: string;
  workerNodeId: string;
  referenceCount: number;
}

interface RouteParams {
  params: {
    id: string
  }
}

// 定义带有平台特定录制信息的增强工作节点类型
interface EnhancedWorkerNode extends WorkerNode {
  platformRecordings: {
    current: number;
    max: number;
  };
  availableCapacity: number;
}

// 添加检查工作节点是否长时间无响应的函数
function isWorkerInactive(worker: WorkerNode): boolean {
  // 如果没有最后心跳时间，视为不活跃
  if (!worker.lastSeenAt) return true;
  
  try {
    const lastSeen = new Date(worker.lastSeenAt);
    const now = new Date();
    const oneDayInMs = 24 * 60 * 60 * 1000; // 一天的毫秒数
    return now.getTime() - lastSeen.getTime() > oneDayInMs;
  } catch (e) {
    // 日期解析出错，默认视为不活跃
    console.error("日期解析错误:", e);
    return true;
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const { id } = params

    // 查询任务信息
    const task = await (db as any).recordingTask.findUnique({
      where: { id },
      include: { platform: true, project: true }
    }) as RecordingTask & { platform: Platform, project: any }

    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 })
    }

    // 检查用户是否有权限操作该任务
    const hasAccess = await checkProjectAccess(session.user.id, task.projectId)
    if (!hasAccess && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "权限不足" }, { status: 403 })
    }

    // 检查任务状态，只有暂停或挂起状态的任务才能启动
    if (task.status === "RUNNING") {
      return NextResponse.json({ error: "任务已在运行中" }, { status: 400 })
    }

    // 检查平台是否已停用
    if (!task.platform.enabled) {
      return NextResponse.json({ error: "该平台已停用，无法启动任务" }, { status: 400 })
    }

    // 解析任务流URL
    let streamUrls = []
    try {
      streamUrls = JSON.parse(task.streamUrls)
    } catch (error) {
      return NextResponse.json({ error: "任务流URL格式错误" }, { status: 400 })
    }

    // 使用Prisma事务包装所有数据库操作，确保原子性
    const result = await (db as any).$transaction(async (prisma: any) => {
      // 为任务分配工作节点
      const resourceInfo = await assignWorkersToTask(task.id, task.projectId, task.platformId, streamUrls, prisma)

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

      // 获取当前时间作为开始时间
      const startTime = new Date();

      // 更新任务状态为运行中，并记录启动时间
      await prisma.recordingTask.update({
        where: { id },
        data: { 
          status: "RUNNING",
          startedAt: startTime,
          endedAt: null
        }
      })

      // 创建新的录制时间段记录
      await prisma.recordingPeriod.create({
        data: {
          startedAt: startTime,
          endedAt: null, // 录制中状态，结束时间为空
          streamUrls: task.streamUrls,
          platformParams: task.platformParams,
          // 关联到现有任务
          task: {
            connect: { id }
          },
          // 获取工作节点分配数据的简化版本，仅保留必要信息
          workerData: JSON.stringify(
            (await prisma.taskLivestreamWorkerAssignment.findMany({
              where: { taskId: id, status: "PROCESSING" },
              select: {
                id: true,
                livestreamWorkerAssignmentId: true,
                livestreamWorkerAssignment: {
                  select: {
                    id: true,
                    livestreamId: true,
                    workerNodeId: true,
                    workerNode: {
                      select: { 
                        nodeId: true 
                      }
                    }
                  }
                }
              }
            })).map((assignment: { 
              id: string; 
              livestreamWorkerAssignment?: { 
                workerNode?: { 
                  nodeId: string 
                } 
              } 
            }) => ({
              id: assignment.id,
              worker: assignment.livestreamWorkerAssignment?.workerNode?.nodeId || "unknown"
            }))
          )
        }
      });

      return resourceInfo;
    }, {
      // 设置事务超时时间为30秒
      timeout: 30000,
      // MySQL支持READ COMMITTED隔离级别
      isolationLevel: 'ReadCommitted',
    });

    return NextResponse.json({
      success: true,
      message: "任务已启动",
      resourceInfo: result
    })
  } catch (error: any) {
    console.error("[TASK_START]", error);
    return NextResponse.json({ error: error.message || "启动任务失败" }, { status: 500 })
  }
}

// 检查并分配工作节点
async function assignWorkersToTask(taskId: string, projectId: string, platformId: string, streamUrls: string[], prisma: any) {
  // 查询可用工作节点，按优先级获取
  // 1. 与任务相同项目关联并且配置了该平台容量的工作节点
  // 2. 与任务相同项目关联的工作节点（使用默认容量）
  // 3. 通用工作节点且配置了该平台容量
  // 4. 通用工作节点（使用默认容量）
  
  const getPlatformCapacityCondition = (workerNodeId: string) => {
    return {
      workerNodeId: workerNodeId,
      platformId: platformId,
    };
  };

  // 获取项目专用节点，包括平台容量数据和最后活跃时间
  const projectWorkers = await prisma.workerNode.findMany({
    where: {
      status: "RUNNING",
      projectId: projectId  // 与任务相同项目关联的工作节点
    },
    include: {
      platformCapacities: {
        where: {
          platformId: platformId
        }
      }
    },
    orderBy: [
      { maxRecordings: 'desc' },
      { currentRecordings: 'asc' },
    ],
  });

  // 获取通用工作节点，包括平台容量数据和最后活跃时间
  const generalWorkers = await prisma.workerNode.findMany({
    where: {
      status: "RUNNING",
      projectId: null  // 通用工作节点，无项目关联
    },
    include: {
      platformCapacities: {
        where: {
          platformId: platformId
        }
      }
    },
    orderBy: [
      { maxRecordings: 'desc' },
      { currentRecordings: 'asc' },
    ],
  });

  // 检查并更新长时间无响应的节点状态
  const inactiveWorkerIds: string[] = [];
  
  // 检查项目节点
  for (const worker of projectWorkers) {
    if (isWorkerInactive(worker)) {
      inactiveWorkerIds.push(worker.id);
    }
  }
  
  // 检查通用节点
  for (const worker of generalWorkers) {
    if (isWorkerInactive(worker)) {
      inactiveWorkerIds.push(worker.id);
    }
  }
  
  // 批量更新长时间无响应的节点状态为STOPPED
  if (inactiveWorkerIds.length > 0) {
    await prisma.workerNode.updateMany({
      where: {
        id: { in: inactiveWorkerIds }
      },
      data: {
        status: "STOPPED"
      }
    });
    
    console.log(`已将 ${inactiveWorkerIds.length} 个长时间无响应的节点状态更新为已停止`);
  }

  // 过滤掉长时间无响应的节点
  const activeProjectWorkers = projectWorkers.filter(worker => !isWorkerInactive(worker));
  const activeGeneralWorkers = generalWorkers.filter(worker => !isWorkerInactive(worker));

  // 计算工作节点的可用容量（优先使用平台特定容量）
  const getWorkerAvailableCapacity = (worker: any) => {
    // 检查是否有平台特定的容量配置
    if (worker.platformCapacities && worker.platformCapacities.length > 0) {
      const platformCapacity = worker.platformCapacities[0];
      return platformCapacity.maxRecordings - platformCapacity.currentRecordings;
    }
    // 如果没有平台特定配置，使用默认值
    return worker.maxRecordings - worker.currentRecordings;
  };

  // 获取工作节点的当前和最大录制数（优先使用平台特定值）
  const getWorkerRecordings = (worker: any) => {
    if (worker.platformCapacities && worker.platformCapacities.length > 0) {
      const platformCapacity = worker.platformCapacities[0];
      return {
        current: platformCapacity.currentRecordings,
        max: platformCapacity.maxRecordings
      };
    }
    return {
      current: worker.currentRecordings,
      max: worker.maxRecordings
    };
  };

  // 检查工作节点是否有容量
  const hasCapacity = (worker: any) => {
    const recordings = getWorkerRecordings(worker);
    return recordings.current < recordings.max;
  };

  // 通过添加虚拟属性扩展工作节点信息
  const enhancedProjectWorkers = activeProjectWorkers.map(worker => ({
    ...worker,
    platformRecordings: getWorkerRecordings(worker),
    availableCapacity: getWorkerAvailableCapacity(worker)
  })).filter(worker => worker.availableCapacity > 0);

  const enhancedGeneralWorkers = activeGeneralWorkers.map(worker => ({
    ...worker,
    platformRecordings: getWorkerRecordings(worker),
    availableCapacity: getWorkerAvailableCapacity(worker)
  })).filter(worker => worker.availableCapacity > 0);

  // 合并两种类型的工作节点，优先使用项目关联的工作节点
  const availableWorkers = [...enhancedProjectWorkers, ...enhancedGeneralWorkers];

  if (!availableWorkers.length) {
    throw new Error("没有可用的工作节点处理该任务");
  }

  // 计算所有工作节点的总可用容量
  const totalAvailableCapacity = availableWorkers.reduce(
    (sum, worker) => sum + worker.availableCapacity,
    0
  );

  // 用于存储已在录制中的视频流（只计算可共享的资源）
  const alreadyProcessingStreams = new Set<string>();
  // 用于存储已在录制但不能共享的视频流（属于其他项目的专用工作节点）
  const nonShareableStreams = new Set<string>();

  // 检查哪些直播流已经在录制中
  for (const streamUrl of streamUrls) {
    // 检查此URL是否已存在LiveStream记录
    const livestream = await prisma.liveStream.findUnique({
      where: { url: streamUrl },
    });

    if (livestream) {
      // 检查该直播流是否已有正在运行的工作节点分配
      const assignment = await prisma.livestreamWorkerAssignment.findFirst({
        where: { 
          livestreamId: livestream.id,
          status: "PROCESSING",
          referenceCount: { gt: 0 }
        },
        include: { workerNode: true }
      });

      if (assignment && assignment.workerNode.status === "RUNNING") {
        // 判断工作节点是否可以共享（同项目或通用节点）
        if (assignment.workerNode.projectId === projectId || assignment.workerNode.projectId === null) {
          // 可共享资源，计入已处理流
          alreadyProcessingStreams.add(streamUrl);
        } else {
          // 不可共享资源，计入不可共享流
          nonShareableStreams.add(streamUrl);
        }
      }
    }
  }

  // 计算实际需要的新资源数量（总流数减去已经在处理的可共享流数）
  const actualResourcesNeeded = streamUrls.length - alreadyProcessingStreams.size;

  // 检查总可用容量是否足够处理新的视频流
  if (totalAvailableCapacity < actualResourcesNeeded) {
    // 收集已在处理中的视频URLs，用于错误提示
    const alreadyProcessingUrls = Array.from(alreadyProcessingStreams).map(url => {
      // 返回截断的URL以提高可读性
      return url.length > 40 ? url.substring(0, 40) + '...' : url;
    });
    
    // 收集不可共享的视频URLs
    const nonShareableUrls = Array.from(nonShareableStreams).map(url => {
      return url.length > 40 ? url.substring(0, 40) + '...' : url;
    });
    
    let errorMessage = `可用工作节点容量不足，需要 ${actualResourcesNeeded} 个空闲录制槽，但只有 ${totalAvailableCapacity} 个可用`;
    
    // 如果有长时间无响应的节点被更新，则添加提示
    if (inactiveWorkerIds && inactiveWorkerIds.length > 0) {
      errorMessage += `\n\n系统检测到 ${inactiveWorkerIds.length} 个工作节点长时间无响应（超过24小时未活跃），已自动将其状态更新为"已停止"。`;
    }
    
    // 如果有已在处理的可共享流，添加到错误信息中
    if (alreadyProcessingStreams.size > 0) {
      errorMessage += `\n\n系统检测到以下 ${alreadyProcessingStreams.size} 个视频流已在系统中录制并可以共享资源（属于当前项目或通用工作节点）：\n- ${alreadyProcessingUrls.join('\n- ')}`;
    }
    
    // 如果有不可共享的流，添加到错误信息中
    if (nonShareableStreams.size > 0) {
      errorMessage += `\n\n注意：以下 ${nonShareableStreams.size} 个视频流虽然已在系统中录制，但由于项目隔离策略无法共享资源（由其他项目的专用工作节点处理）：\n- ${nonShareableUrls.join('\n- ')}`;
    }
    
    throw new Error(errorMessage);
  }

  // 记录更新过录制数的工作节点ID，用于后续调用updateWorkerNodeRecordingCount
  const updatedWorkerIds = new Set<string>();
  // 记录更新过平台特定录制数的工作节点ID和平台ID，用于后续更新
  const updatedPlatformCapacities = new Set<string>();

  // 记录节点分配的统计信息
  const assignmentStats = {
    totalStreams: streamUrls.length,
    projectNodeAssignments: 0,  // 使用项目专用节点的流数量
    generalNodeAssignments: 0,  // 使用通用节点的流数量
    reusedAssignments: 0,       // 重用已有节点的流数量
    newAssignments: 0,          // 新分配节点的流数量
    maintainedProjectNodes: 0,  // 保持专用节点不降级的流数量
    crossProjectNodes: 0        // 跨项目的流数量（无法共享）
  };

  // 为每个流URL分配工作节点
  for (const streamUrl of streamUrls) {
    // 查找该URL是否已存在LiveStream记录
    let livestream = await prisma.liveStream.findUnique({
      where: { url: streamUrl },
    });

    // 如果不存在，则创建新的LiveStream记录
    if (!livestream) {
      livestream = await prisma.liveStream.create({
        data: {
          url: streamUrl,
          platformId: platformId
        }
      });
    }

    // 查询任务与直播流的关联是否已存在
    let taskLivestreamAssignment = await prisma.taskLivestreamAssignment.findFirst({
      where: {
        taskId: taskId,
        livestreamId: livestream.id
      }
    });

    // 如果关联不存在，则创建新的关联
    if (!taskLivestreamAssignment) {
      taskLivestreamAssignment = await prisma.taskLivestreamAssignment.create({
        data: {
          taskId: taskId,
          livestreamId: livestream.id,
          status: "PROCESSING"  // 处理中状态
        }
      });
    } else {
      // 更新现有关联的状态
      taskLivestreamAssignment = await prisma.taskLivestreamAssignment.update({
        where: { id: taskLivestreamAssignment.id },
        data: { status: "PROCESSING" }
      });
    }

    // 查询直播流与工作节点的关联
    let livestreamWorkerAssignment = await prisma.livestreamWorkerAssignment.findFirst({
      where: { 
        livestreamId: livestream.id,
        status: "PROCESSING",
        referenceCount: { gt: 0 }  // 只查找引用计数大于0的关联
      },
      orderBy: { updatedAt: "desc" },
      include: { workerNode: true }
    }) as (LivestreamWorkerAssignment & { workerNode: WorkerNode }) | null;

    // 如果有正在处理中的关联并且工作节点是有效的
    if (livestreamWorkerAssignment) {
      const worker = livestreamWorkerAssignment.workerNode;
      
      console.log(`[${streamUrl}] 找到活跃的工作节点分配，节点ID: ${worker.nodeId}, 项目ID: ${worker.projectId || '通用'}, 当前项目: ${projectId}`);
      
      // 判断工作节点是否可以共享
      // 1. 通用节点（projectId为null）可以被任何项目共享
      // 2. 专用节点只能被同一个项目共享，不能跨项目共享
      const isValidWorker = (worker.projectId === null || worker.projectId === projectId) && worker.status === "RUNNING";
      
      if (isValidWorker) {
        try {
          // 工作节点符合条件，直接增加引用计数
          await prisma.livestreamWorkerAssignment.update({
            where: { id: livestreamWorkerAssignment.id },
            data: {
              referenceCount: livestreamWorkerAssignment.referenceCount + 1,
              status: "PROCESSING"  // 更新状态为处理中
            }
          });
          
          // 创建或更新任务-直播流-工作节点关联
          let taskLWAssignment = await prisma.taskLivestreamWorkerAssignment.findFirst({
            where: {
              taskId: taskId,
              livestreamWorkerAssignmentId: livestreamWorkerAssignment.id
            }
          });
          
          if (taskLWAssignment) {
            // 如果已存在关联，则更新状态
            await prisma.taskLivestreamWorkerAssignment.update({
              where: { id: taskLWAssignment.id },
              data: { status: "PROCESSING" }
            });
          } else {
            try {
              // 如果不存在关联，则创建新关联
              await prisma.taskLivestreamWorkerAssignment.create({
                data: {
                  taskId: taskId,
                  livestreamWorkerAssignmentId: livestreamWorkerAssignment.id,
                  status: "PROCESSING"
                }
              });
            } catch (error: any) {
              // 处理唯一约束冲突
              if (error.code === 'P2002' || error.message.includes('Unique constraint failed')) {
                console.log(`[${streamUrl}] 任务-直播流-工作节点关联已存在，尝试更新`);
                
                // 再次尝试查找可能是并发创建的关联
                const existingAssignment = await prisma.taskLivestreamWorkerAssignment.findFirst({
                  where: {
                    taskId: taskId,
                    livestreamWorkerAssignmentId: livestreamWorkerAssignment.id
                  }
                });
                
                if (existingAssignment) {
                  // 更新找到的关联
                  await prisma.taskLivestreamWorkerAssignment.update({
                    where: { id: existingAssignment.id },
                    data: { status: "PROCESSING" }
                  });
                } else {
                  // 如果还是找不到，则抛出原始错误
                  throw error;
                }
              } else {
                // 其他错误直接抛出
                throw error;
              }
            }
          }
          
          // 添加到需要更新录制数的工作节点列表
          updatedWorkerIds.add(livestreamWorkerAssignment.workerNodeId);
          
          // 更新统计信息
          assignmentStats.reusedAssignments++;
          if (worker.projectId === projectId) {
            assignmentStats.projectNodeAssignments++;
            console.log(`[${streamUrl}] 复用已有项目专用节点: ${worker.nodeId}`);
          } else {
            assignmentStats.generalNodeAssignments++;
            console.log(`[${streamUrl}] 复用已有通用节点: ${worker.nodeId}`);
          }
          
          continue; // 已经分配了工作节点，继续处理下一个流
        } catch (error) {
          console.error(`[${streamUrl}] 复用现有节点失败:`, error);
          // 如果复用失败，继续下面的逻辑尝试分配新节点
        }
      } else {
        // 如果是其他项目的专用节点，我们不会重用它，而是选择新的节点
        console.log(`[${streamUrl}] 发现其他项目(${worker.projectId})的专用节点，不重用，将分配新节点`);
        assignmentStats.crossProjectNodes++;
      }
    }

    // 如果没有有效的处理中关联，或者工作节点不符合条件，则需要选择新的工作节点
    
    // 优先选择具有以下条件的工作节点：
    // 1. 项目专属节点 
    // 2. 有平台特定容量
    let selectedWorker = enhancedProjectWorkers.find(worker => 
      worker.availableCapacity > 0
    );
    
    // 如果没有可用的项目专属节点，则尝试通用节点
    if (!selectedWorker) {
      console.log(`[${streamUrl}] 没有可用的项目专用节点，尝试使用通用节点`);
      selectedWorker = enhancedGeneralWorkers.find(worker => 
        worker.availableCapacity > 0
      );
    } else {
      console.log(`[${streamUrl}] 找到可用的项目专用节点: ${selectedWorker.nodeId}`);
    }

    if (!selectedWorker) {
      throw new Error(`无法为直播流分配工作节点，平台 ${platformId} 资源不足`);
    }

    // 更新统计信息
    assignmentStats.newAssignments++;
    if (selectedWorker.projectId === projectId) {
      assignmentStats.projectNodeAssignments++;
      console.log(`[${streamUrl}] 分配新的项目专用节点: ${selectedWorker.nodeId}, 平台容量: ${selectedWorker.availableCapacity}`);
    } else {
      assignmentStats.generalNodeAssignments++;
      console.log(`[${streamUrl}] 分配新的通用节点: ${selectedWorker.nodeId}, 平台容量: ${selectedWorker.availableCapacity}`);
    }

    // 对于已经存在的直播流，检查是否已有与当前项目匹配的历史分配记录
    // 如果有历史分配记录属于相同项目，则优先更新这些记录
    let projectSpecificAssignment = null;
    if (livestreamWorkerAssignment && livestreamWorkerAssignment.workerNode.projectId === projectId) {
      projectSpecificAssignment = livestreamWorkerAssignment;
      console.log(`[${streamUrl}] 当前活跃分配就是项目专用节点，将优先使用`);
    } else {
      // 查找当前项目的历史分配记录
      projectSpecificAssignment = await prisma.livestreamWorkerAssignment.findFirst({
        where: { 
          livestreamId: livestream.id,
          workerNode: {
            projectId: projectId
          }
        },
        orderBy: { updatedAt: "desc" },
      });
      
      if (projectSpecificAssignment) {
        console.log(`[${streamUrl}] 找到当前项目(${projectId})的历史分配记录，ID: ${projectSpecificAssignment.id}`);
      }
    }

    // 查找通用节点的历史关联
    const generalAssignment = await prisma.livestreamWorkerAssignment.findFirst({
      where: { 
        livestreamId: livestream.id,
        workerNode: {
          projectId: null
        }
      },
      orderBy: { updatedAt: "desc" },
    });

    if (generalAssignment) {
      console.log(`[${streamUrl}] 找到通用节点的历史分配记录，ID: ${generalAssignment.id}`);
    }

    // 决定使用哪个历史分配记录或创建新记录
    let assignmentToUpdate = null;
    let createNewAssignment = false;

    // 优先使用当前项目的历史分配记录
    if (projectSpecificAssignment) {
      assignmentToUpdate = projectSpecificAssignment;
      console.log(`[${streamUrl}] 使用当前项目(${projectId})的历史分配记录`);
    } 
    // 其次使用通用节点的历史分配记录（如果选择的是通用节点）
    else if (generalAssignment && selectedWorker.projectId === null) {
      assignmentToUpdate = generalAssignment;
      console.log(`[${streamUrl}] 使用通用节点的历史分配记录`);
    } 
    // 如果没有匹配的历史记录，创建新记录
    else {
      createNewAssignment = true;
      console.log(`[${streamUrl}] 没有合适的历史分配记录，创建新分配`);
    }

    // 如果正在选择项目专用节点，并且历史上使用过通用节点，这是"保持专用节点不降级"的情况
    if (selectedWorker.projectId === projectId && generalAssignment && !projectSpecificAssignment) {
      console.log(`[${streamUrl}] 保持专用节点不降级：历史上使用过通用节点，但现在将使用项目专用节点`);
      assignmentStats.maintainedProjectNodes++;
      
      // 在这种情况下，我们应该创建新的分配记录，而不是更新通用节点的历史记录
      if (assignmentToUpdate === generalAssignment) {
        createNewAssignment = true;
        assignmentToUpdate = null;
        console.log(`[${streamUrl}] 决定创建新的专用节点分配，而不是更新通用节点分配`);
      }
    }

    if (assignmentToUpdate) {
      try {
        // 输出历史分配信息
        console.log(`[${streamUrl}] 发现历史分配记录ID: ${assignmentToUpdate.id}，节点类型: ${assignmentToUpdate.workerNode?.projectId ? '专用' : '通用'}, 当前选择节点: ${selectedWorker.nodeId}, 类型: ${selectedWorker.projectId ? '专用' : '通用'}`);
        
        // 检查历史分配记录的工作节点ID是否与当前选择的节点ID相同
        if (assignmentToUpdate.workerNodeId === selectedWorker.id) {
          // 如果是同一个节点，直接更新引用计数
          console.log(`[${streamUrl}] 历史分配与当前选择节点相同，直接更新引用计数`);
          
          // 先获取最新的分配记录状态，避免并发问题
          const freshAssignment = await prisma.livestreamWorkerAssignment.findUnique({
            where: { id: assignmentToUpdate.id }
          });
          
          if (freshAssignment) {
            await prisma.livestreamWorkerAssignment.update({
              where: { id: assignmentToUpdate.id },
              data: {
                referenceCount: freshAssignment.referenceCount + 1,
                status: "PROCESSING"
              }
            });
            
            console.log(`[${streamUrl}] 已更新分配记录引用计数: ${freshAssignment.referenceCount} -> ${freshAssignment.referenceCount + 1}`);
          } else {
            throw new Error(`无法获取最新的分配记录: ${assignmentToUpdate.id}`);
          }
        } else {
          // 如果是不同节点，则创建新的分配记录而不是更新旧记录
          console.log(`[${streamUrl}] 历史分配节点(${assignmentToUpdate.workerNodeId})与当前选择节点(${selectedWorker.id})不同，创建新分配记录`);
          
          // 检查是否已存在新节点的分配记录
          let newAssignment = await prisma.livestreamWorkerAssignment.findFirst({
            where: {
              livestreamId: livestream.id,
              workerNodeId: selectedWorker.id
            }
          });
          
          if (newAssignment) {
            // 如果已存在新节点的分配记录，增加引用计数
            await prisma.livestreamWorkerAssignment.update({
              where: { id: newAssignment.id },
              data: {
                referenceCount: newAssignment.referenceCount + 1,
                status: "PROCESSING"
              }
            });
            
            console.log(`[${streamUrl}] 已更新新节点分配记录引用计数: ${newAssignment.referenceCount} -> ${newAssignment.referenceCount + 1}`);
          } else {
            // 创建新的分配记录
            newAssignment = await prisma.livestreamWorkerAssignment.create({
              data: {
                livestreamId: livestream.id,
                workerNodeId: selectedWorker.id,
                referenceCount: 1,
                status: "PROCESSING"
              }
            });
            
            console.log(`[${streamUrl}] 已创建新的分配记录: ${newAssignment.id}`);
          }
          
          // 使用新的分配记录
          assignmentToUpdate = newAssignment;
        }
        
        // 检查是否已存在任务-直播流-工作节点关联
        const existingAssignment = await prisma.taskLivestreamWorkerAssignment.findFirst({
          where: {
            taskId: taskId,
            livestreamWorkerAssignmentId: assignmentToUpdate.id
          }
        });
        
        if (existingAssignment) {
          // 如果已存在关联，则更新状态
          await prisma.taskLivestreamWorkerAssignment.update({
            where: { id: existingAssignment.id },
            data: { status: "PROCESSING" }
          });
        } else {
          try {
            // 创建任务-直播流-工作节点关联
            await prisma.taskLivestreamWorkerAssignment.create({
              data: {
                taskId: taskId,
                livestreamWorkerAssignmentId: assignmentToUpdate.id,
                status: "PROCESSING"
              }
            });
          } catch (error: any) {
            // 处理唯一约束冲突
            if (error.code === 'P2002' || error.message.includes('Unique constraint failed')) {
              console.log(`[${streamUrl}] 任务-直播流-工作节点关联创建冲突，尝试更新`);
              
              // 再次尝试查找并更新
              const conflictingAssignment = await prisma.taskLivestreamWorkerAssignment.findFirst({
                where: {
                  taskId: taskId,
                  livestreamWorkerAssignmentId: assignmentToUpdate.id
                }
              });
              
              if (conflictingAssignment) {
                await prisma.taskLivestreamWorkerAssignment.update({
                  where: { id: conflictingAssignment.id },
                  data: { status: "PROCESSING" }
                });
              } else {
                throw new Error(`无法解决任务-直播流-工作节点关联冲突: ${error.message}`);
              }
            } else {
              throw error; // 重新抛出其他类型的错误
            }
          }
        }
        
        // 添加到更新录制数的工作节点列表
        updatedWorkerIds.add(selectedWorker.id);
      } catch (error) {
        console.error(`[${streamUrl}] 更新历史分配记录失败:`, error);
        throw error;
      }
    } else {
      // 创建新的直播流工作节点分配
      console.log(`[${streamUrl}] 创建新的工作节点分配，节点ID: ${selectedWorker.id}，节点类型: ${selectedWorker.projectId ? '专用' : '通用'}`);
      
      try {
        // 声明变量并初始化为null，避免linter错误
        let livestreamWorkerAssignment: LivestreamWorkerAssignment | null = null;
        
        // 在创建前先检查是否已存在相同的livestreamId和workerNodeId组合
        // 这可以防止在高并发情况下出现唯一约束冲突
        const existingAssignment = await prisma.livestreamWorkerAssignment.findFirst({
          where: {
            livestreamId: livestream.id,
            workerNodeId: selectedWorker.id
          }
        });
        
        if (existingAssignment) {
          // 如果已存在，则更新引用计数而不是创建新记录
          console.log(`[${streamUrl}] 发现已存在的直播流-工作节点分配(${existingAssignment.id})，更新引用计数`);
          livestreamWorkerAssignment = await prisma.livestreamWorkerAssignment.update({
            where: { id: existingAssignment.id },
            data: {
              referenceCount: existingAssignment.referenceCount + 1,
              status: "PROCESSING"
            }
          });
        } else {
          // 如果不存在，则创建新记录
          livestreamWorkerAssignment = await prisma.livestreamWorkerAssignment.create({
            data: {
              livestreamId: livestream.id,
              workerNodeId: selectedWorker.id,
              referenceCount: 1,
              status: "PROCESSING"
            }
          });
        }
        
        // 确保livestreamWorkerAssignment不为null
        if (!livestreamWorkerAssignment) {
          throw new Error(`无法创建或更新直播流-工作节点分配`);
        }
        
        console.log(`[${streamUrl}] 已分配到工作节点(${selectedWorker.nodeId}), 分配ID: ${livestreamWorkerAssignment.id}`);
        
        // 创建任务-直播流-工作节点关联
        await prisma.taskLivestreamWorkerAssignment.create({
          data: {
            taskId: taskId,
            livestreamWorkerAssignmentId: livestreamWorkerAssignment.id,
            status: "PROCESSING"
          }
        });
        
        // 更新工作节点属性
        updatedWorkerIds.add(selectedWorker.id);
      } catch (error) {
        console.error(`[${streamUrl}] 创建直播流-工作节点分配失败:`, error);
        throw error;
      }
    }
    
    // 更新本地缓存的工作节点容量信息
    const workerIndex = availableWorkers.findIndex(w => w.id === selectedWorker.id);
    if (workerIndex !== -1) {
      // 减少可用容量
      availableWorkers[workerIndex].availableCapacity -= 1;
      // 增加当前录制数
      if (availableWorkers[workerIndex].platformRecordings) {
        availableWorkers[workerIndex].platformRecordings.current += 1;
      }
    }
    
    // 添加到需要更新平台特定录制数的列表
    updatedPlatformCapacities.add(`${selectedWorker.id}_${platformId}`);
  }
  
  // 更新所有涉及到的工作节点的录制数
  for (const workerId of updatedWorkerIds) {
    await updateWorkerNodeRecordingCountInTransaction(workerId, prisma);
  }
  
  // 更新所有涉及到的工作节点的平台特定录制数
  for (const key of updatedPlatformCapacities) {
    const [workerId, platformId] = key.split('_');
    await updateWorkerNodePlatformRecordingCountInTransaction(workerId, platformId, prisma);
  }
  
  // 返回资源分配信息
  return {
    totalStreams: streamUrls.length,
    alreadyProcessingStreams: alreadyProcessingStreams.size,
    nonShareableStreams: nonShareableStreams.size,
    newAllocatedResources: actualResourcesNeeded,
    totalAvailableCapacity,
    projectNodeCount: enhancedProjectWorkers.length,
    generalNodeCount: enhancedGeneralWorkers.length,
    assignmentStats
  };
}

// 事务内的工作节点录制数更新函数
async function updateWorkerNodeRecordingCountInTransaction(workerNodeId: string, prisma: any) {
  try {
    // 获取该工作节点的所有直播流分配中引用计数大于0的记录数量
    const livestreamWorkerAssignments = await prisma.livestreamWorkerAssignment.findMany({
      where: {
        workerNodeId: workerNodeId,
        referenceCount: { gt: 0 } // 只统计引用计数大于0的
      }
    });

    // 直接使用记录数量作为当前录制数
    const recordingCount = livestreamWorkerAssignments.length;

    // 更新工作节点的当前录制数
    await prisma.workerNode.update({
      where: { id: workerNodeId },
      data: {
        currentRecordings: recordingCount
      }
    });

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