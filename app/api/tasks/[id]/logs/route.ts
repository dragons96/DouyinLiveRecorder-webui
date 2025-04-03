import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { checkProjectAccess, checkProjectAdmin } from "@/lib/auth-utils"
import { z } from "zod"

interface Params {
  params: {
    id: string
  }
}

export async function GET(req: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ message: "未授权" }, { status: 401 })
    }

    // Get task
    const task = await db.recordingTask.findUnique({
      where: {
        id: params.id,
      },
    })

    if (!task) {
      return NextResponse.json({ message: "任务不存在" }, { status: 404 })
    }

    // Check if user has access to the project
    const hasAccess = await checkProjectAccess(session.user.id, task.projectId)
    if (!hasAccess) {
      return NextResponse.json({ message: "权限不足" }, { status: 403 })
    }

    // Get logs
    const logs = await db.taskLog.findMany({
      where: {
        taskId: params.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error("Get logs error:", error)
    return NextResponse.json({ message: "获取日志失败" }, { status: 500 })
  }
}

// 定义日志创建参数的验证器
const logSchema = z.object({
  message: z.string().min(1, "日志消息不能为空"),
  level: z.enum(["INFO", "WARNING", "ERROR"]).default("INFO"),
})

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ message: "未授权" }, { status: 401 })
    }

    // 获取任务
    const task = await db.recordingTask.findUnique({
      where: {
        id: params.id,
      },
      include: {
        project: {
          include: {
            managers: true,
          }
        }
      }
    })

    if (!task) {
      return NextResponse.json({ message: "任务不存在" }, { status: 404 })
    }

    // 检查用户是否是超级管理员
    const isSuperAdmin = session.user.role === "SUPER_ADMIN"

    // 如果不是超级管理员，检查是否是项目管理员或任务创建者
    if (!isSuperAdmin) {
      const isProjectAdmin = task.project.managers.some(manager => manager.id === session.user.id)
      const isTaskCreator = task.userId === session.user.id
      
      if (!isProjectAdmin && !isTaskCreator) {
        return NextResponse.json({ message: "权限不足，只有项目管理员或任务创建者可以添加日志" }, { status: 403 })
      }
    }

    // 验证请求数据
    const body = await req.json()
    const validationResult = logSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json({ message: "日志格式错误", errors: validationResult.error.format() }, { status: 400 })
    }

    const { message, level } = validationResult.data

    // 创建日志
    const log = await db.taskLog.create({
      data: {
        message,
        level,
        taskId: params.id
      }
    })

    return NextResponse.json(log)
  } catch (error) {
    console.error("Create log error:", error)
    return NextResponse.json({ message: "创建日志失败" }, { status: 500 })
  }
}