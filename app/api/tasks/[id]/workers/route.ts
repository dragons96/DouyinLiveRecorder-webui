import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { checkProjectAccess } from "@/lib/auth-utils"

interface RouteParams {
  params: {
    id: string
  }
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    // 获取任务信息
    const task = await db.recordingTask.findUnique({
      where: {
        id: params.id,
      },
      include: {
        project: true,
      },
    })

    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 })
    }

    // 检查用户是否是超级管理员
    const isSuperAdmin = session.user.role === "SUPER_ADMIN"

    // 如果不是超级管理员，检查用户是否有该项目的访问权限
    if (!isSuperAdmin) {
      const hasAccess = await checkProjectAccess(session.user.id, task.projectId)
      if (!hasAccess) {
        return NextResponse.json({ error: "权限不足" }, { status: 403 })
      }
    }

    // 获取当前任务关联的直播流
    const taskLivestreams = await (db as any).taskLivestreamAssignment.findMany({
      where: { taskId: params.id },
      include: {
        livestream: true,
      },
    });

    // 获取各直播流分配的工作节点，仅获取当前任务关联的分配
    const assignments = [];
    
    // 获取当前任务的所有直播流工作节点分配
    const taskLWAssignments = await (db as any).taskLivestreamWorkerAssignment.findMany({
      where: { 
        taskId: params.id,
      },
      include: {
        livestreamWorkerAssignment: {
          include: {
            workerNode: true,
            livestream: true
          }
        }
      }
    });
    
    // 处理当前任务的直播流工作节点分配
    for (const taskAssignment of taskLWAssignments) {
      if (taskAssignment.livestreamWorkerAssignment) {
        const workerAssignment = taskAssignment.livestreamWorkerAssignment;
        assignments.push({
          id: workerAssignment.id,
          streamUrl: workerAssignment.livestream.url,
          workerNode: workerAssignment.workerNode,
          referenceCount: workerAssignment.referenceCount,
          status: workerAssignment.status,
          streamingStatus: workerAssignment.streamingStatus, // 从livestreamWorkerAssignment获取上播状态
          taskStatus: taskAssignment.status, // 添加任务-分配关联的状态
          createdAt: workerAssignment.createdAt,
          updatedAt: workerAssignment.updatedAt,
        });
      }
    }

    // 解析直播链接数量
    let streamUrls = [];
    try {
      streamUrls = JSON.parse(task.streamUrls);
    } catch (error) {
      console.error("解析直播链接失败:", error);
      streamUrls = [];
    }

    // 获取可用的工作节点
    const getAvailableWorkerNodes = async (projectId: string | null, prisma: any) => {
      // 如果是查找特定项目的专属节点
      if (projectId) {
        return await prisma.workerNode.findMany({
          where: {
            status: "RUNNING",
            projectId: projectId
          },
          orderBy: { currentRecordings: 'asc' }
        });
      } 
      // 如果是查找通用节点
      else {
        return await prisma.workerNode.findMany({
          where: {
            status: "RUNNING",
            projectId: null
          },
          orderBy: { currentRecordings: 'asc' }
        });
      }
    };

    // 获取可用的项目专用节点和通用节点数量
    const projectWorkers = await getAvailableWorkerNodes(task.projectId, db as any)

    const generalWorkers = await getAvailableWorkerNodes(null, db as any)

    // 计算节点分配统计信息
    const assignmentStats = {
      totalStreams: streamUrls.length,
      projectNodeAssignments: 0,  // 使用项目专用节点的流数量
      generalNodeAssignments: 0,  // 使用通用节点的流数量
      reusedAssignments: 0,       // 所有共享节点数量
      newAssignments: assignments.length,  // 假设所有分配都是新分配
      maintainedProjectNodes: 0,  // 保持专用节点不降级的流数量（这个数值在运行时无法准确追踪，仅在启动任务时记录）
      crossProjectNodes: 0        // 跨项目的流数量（无法共享）
    };

    // 统计节点类型分配情况
    for (const assignment of assignments) {
      if (assignment.workerNode.projectId === task.projectId) {
        assignmentStats.projectNodeAssignments++;
      } else if (assignment.workerNode.projectId === null) {
        assignmentStats.generalNodeAssignments++;
      } else {
        // 如果节点属于其他项目，计为跨项目节点
        assignmentStats.crossProjectNodes++;
      }

      if (assignment.referenceCount > 1) {
        assignmentStats.reusedAssignments++;
        assignmentStats.newAssignments--; // 减去重复计算的节点
      }
    }

    // 返回工作节点分配信息和总体情况
    return NextResponse.json({
      task: {
        id: task.id,
        name: task.name,
        status: task.status,
      },
      totalStreams: Array.isArray(streamUrls) ? streamUrls.length : 0,
      assignedStreams: taskLivestreams.length,
      assignments: assignments,
      projectNodeCount: projectWorkers.length,
      generalNodeCount: generalWorkers.length,
      assignmentStats
    })
  } catch (error) {
    console.error("[TASK_WORKERS_GET]", error)
    return NextResponse.json({ error: "获取任务工作节点分配失败" }, { status: 500 })
  }
} 