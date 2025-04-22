import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
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

    // 提前解构并获取任务ID
    const taskId = (await params).id

    // 获取任务信息
    const task = await db.recordingTask.findUnique({
      where: {
        id: taskId,
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

    // 获取录制时间段记录，按开始时间倒序排列
    const recordingPeriods = await db.recordingPeriod.findMany({
      where: {
        taskId,
      },
      orderBy: {
        startedAt: "desc",
      },
    })

    return NextResponse.json(recordingPeriods)
  } catch (error) {
    console.error("[RECORDING_PERIODS_GET]", error)
    return NextResponse.json({ error: "获取录制时间段记录失败" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    // 提前解构并获取任务ID
    const taskId = params.id

    // 获取任务信息
    const task = await db.recordingTask.findUnique({
      where: {
        id: taskId,
      },
      include: {
        project: true,
      },
    })

    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 })
    }

    // 检查用户是否有权限（必须是超级管理员或项目管理员或任务创建者）
    const isAdmin = await checkProjectAccess(session.user.id, task.projectId)
    const isSuperAdmin = session.user.role === "SUPER_ADMIN"
    const isTaskCreator = task.userId === session.user.id

    if (!isAdmin && !isSuperAdmin && !isTaskCreator) {
      return NextResponse.json({ error: "权限不足" }, { status: 403 })
    }

    // 如果任务正在运行中，不允许清空录制记录
    if (task.status === "RUNNING") {
      return NextResponse.json({ error: "任务正在运行中，无法清空录制记录" }, { status: 400 })
    }

    // 删除该任务的所有录制时间段记录
    const result = await db.recordingPeriod.deleteMany({
      where: {
        taskId,
      },
    })

    return NextResponse.json({
      message: "录制时间段记录已清空",
      count: result.count
    })
  } catch (error) {
    console.error("[RECORDING_PERIODS_DELETE]", error)
    return NextResponse.json({ error: "清空录制时间段记录失败" }, { status: 500 })
  }
} 