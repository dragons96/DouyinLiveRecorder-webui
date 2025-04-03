import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { checkProjectAccess } from "@/lib/auth-utils"

type RouteParams = {
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

    const { id } = params

    // 获取任务信息
    const task = await db.recordingTask.findUnique({
      where: {
        id,
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

    // 解析直播URL
    let streamUrls: string[] = []
    try {
      streamUrls = JSON.parse(task.streamUrls)
    } catch (error) {
      console.error("解析直播URL失败:", error)
      streamUrls = []
    }

    // 获取任务相关的所有直播流工作节点分配
    const taskLWAssignments = await (db as any).taskLivestreamWorkerAssignment.findMany({
      where: { 
        taskId: id,
        status: "PROCESSING"
      },
      include: {
        livestreamWorkerAssignment: {
          include: {
            workerNode: true,
            livestream: true
          }
        }
      }
    })

    // 过滤掉关联为null的记录
    const validAssignments = taskLWAssignments.filter(
      (assignment: any) => assignment.livestreamWorkerAssignment !== null
    )
    
    // 统计上播情况
    let streamingCount = 0
    
    // 处理结果
    for (const assignment of validAssignments) {
      const lwa = assignment.livestreamWorkerAssignment
      
      // 只有直播状态为STREAMING才计数
      if (lwa.streamingStatus === "STREAMING") {
        streamingCount++
      }
    }

    // 计算总视频数
    const totalStreams = streamUrls.length
    
    return NextResponse.json({
      totalStreams: totalStreams,
      streamingCount: streamingCount
    })
  } catch (error) {
    console.error("[TASK_STREAMING_STATUS_GET]", error)
    return NextResponse.json({ error: "获取任务上播状态失败" }, { status: 500 })
  }
} 