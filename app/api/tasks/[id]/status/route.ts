import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { checkProjectAccess, isSystemAdmin } from "@/lib/auth-utils"

interface RouteParams {
  params: {
    id: string
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const body = await req.json()
    const { status } = body

    if (!status) {
      return NextResponse.json({ error: "状态不能为空" }, { status: 400 })
    }

    // 获取任务信息
    const task = await db.recordingTask.findUnique({
      where: {
        id: params.id,
      },
      include: {
        project: {
          include: {
            managers: true,
          },
        },
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

      // 检查用户是否是项目管理员
      const isProjectAdmin = task.project.managers.some((manager) => manager.id === session.user.id)
      if (!isProjectAdmin) {
        return NextResponse.json({ error: "您没有该项目的管理权限" }, { status: 403 })
      }
    }

    // 更新任务状态
    const updatedTask = await db.recordingTask.update({
      where: {
        id: params.id,
      },
      data: {
        status,
      },
    })

    // 添加任务状态变更日志
    await db.taskLog.create({
      data: {
        message: `任务状态已变更为: ${status}`,
        level: "INFO",
        taskId: params.id,
      },
    })

    return NextResponse.json(updatedTask)
  } catch (error) {
    console.error("[TASK_STATUS_PATCH]", error)
    return NextResponse.json({ error: "更新任务状态失败" }, { status: 500 })
  }
} 