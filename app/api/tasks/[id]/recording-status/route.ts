import { getServerSession } from "next-auth"
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

    // 解析直播链接数量
    let streamUrls = [];
    try {
      streamUrls = JSON.parse(task.streamUrls);
    } catch (error) {
      console.error("解析直播链接失败:", error);
      streamUrls = [];
    }
    
    // 获取任务关联的直播流
    const taskLivestreams = await (db as any).taskLivestreamAssignment.findMany({
      where: { taskId: params.id },
      include: {
        livestream: true,
      },
    });

    // 获取各直播流分配的工作节点及其状态
    let activeStreamCount = 0;
    const stoppedNodes = [];
    
    // 通过新的任务-直播流-工作节点关联表查询状态
    const taskLWAssignments = await (db as any).taskLivestreamWorkerAssignment.findMany({
      where: { 
        taskId: params.id,
        status: "PROCESSING", // 只查找处理中的记录
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
    
    // 过滤掉关联为null的记录
    const validAssignments = taskLWAssignments.filter(
      (assignment: any) => assignment.livestreamWorkerAssignment !== null
    );
    
    // 处理结果
    for (const assignment of validAssignments) {
      const lw = assignment.livestreamWorkerAssignment;
      
      // 检查工作节点状态
      if (lw.workerNode.status === "RUNNING" && lw.status === "PROCESSING") {
        activeStreamCount++;
      } else if (lw.workerNode.status !== "RUNNING") {
        // 如果工作节点状态不是运行中，添加到停止节点列表
        stoppedNodes.push({
          nodeId: lw.workerNode.nodeId,
          status: lw.workerNode.status,
          streamUrl: lw.livestream.url
        });
      }
    }

    // 计算总视频数和录制中的视频数
    const totalStreams = Array.isArray(streamUrls) ? streamUrls.length : 0;
    
    return NextResponse.json({
      totalStreams: totalStreams,
      activeStreams: activeStreamCount,
      stoppedNodes: stoppedNodes
    })
  } catch (error) {
    console.error("[TASK_RECORDING_STATUS_GET]", error)
    return NextResponse.json({ error: "获取任务录制状态失败" }, { status: 500 })
  }
} 