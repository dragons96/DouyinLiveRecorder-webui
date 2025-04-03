import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { checkProjectAccess } from "@/lib/auth-utils"

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const { id } = params
    if (!id) {
      return NextResponse.json({ error: "任务ID不能为空" }, { status: 400 })
    }

    // 获取请求体
    const body = await req.json()
    const { enabled } = body

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: "enabled参数必须是布尔值" }, { status: 400 })
    }

    // 获取任务信息
    const task = await db.recordingTask.findUnique({
      where: { id },
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

    // 检查用户是否为超级管理员
    const isSuperAdmin = session.user.role === "SUPER_ADMIN"
    
    // 检查用户是否是项目管理员或任务创建者
    const isProjectAdmin = task.project.managers.some(
      (manager) => manager.id === session.user.id
    )
    const isTaskCreator = task.userId === session.user.id

    // 只有超级管理员、项目管理员或任务创建者才能启用/禁用任务
    if (!isSuperAdmin && !isProjectAdmin && !isTaskCreator) {
      return NextResponse.json({ error: "权限不足" }, { status: 403 })
    }

    // 如果任务正在运行，禁止禁用
    if (task.status === "RUNNING" && !enabled) {
      return NextResponse.json(
        { error: "任务正在运行中，请先停止任务" },
        { status: 400 }
      )
    }

    // 更新任务的启用状态 - 使用类型断言解决Prisma类型问题
    const updateData: any = { enabled };
    const updatedTask = await db.recordingTask.update({
      where: { id },
      data: updateData,
    })

    // 记录操作日志
    await db.taskLog.create({
      data: {
        taskId: task.id,
        message: enabled ? "任务已启用" : "任务已禁用",
        level: "INFO",
      },
    })

    return NextResponse.json(updatedTask)
  } catch (error) {
    console.error("[TASK_TOGGLE_ENABLED]", error)
    return NextResponse.json(
      { error: "更新任务状态失败" },
      { status: 500 }
    )
  }
} 