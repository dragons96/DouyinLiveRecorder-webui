import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { isSystemAdmin } from "@/lib/auth-utils"

interface Params {
  params: {
    id: string
    memberId: string
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    // 检查用户是否是超级管理员
    const isSuperAdmin = await isSystemAdmin(session.user.id)

    // 如果不是超级管理员，则检查是否是项目管理员
    if (!isSuperAdmin) {
      // 获取项目信息
      const project = await db.project.findUnique({
        where: {
          id: params.id,
        },
        include: {
          managers: true,
        },
      })

      if (!project) {
        return NextResponse.json({ error: "项目不存在" }, { status: 404 })
      }

      // 检查用户是否是项目管理员
      const isProjectAdmin = project.managers.some((manager) => manager.id === session.user.id)
      if (!isProjectAdmin) {
        return NextResponse.json({ error: "权限不足" }, { status: 403 })
      }

      // 项目管理员不能移除管理员
      const isTargetAdmin = project.managers.some((manager) => manager.id === params.memberId)
      if (isTargetAdmin) {
        return NextResponse.json({ error: "无法移除项目管理员" }, { status: 403 })
      }
    }

    const { isManager } = await req.json()

    // 更新项目成员
    if (isManager) {
      await db.project.update({
        where: {
          id: params.id,
        },
        data: {
          managers: {
            disconnect: {
              id: params.memberId,
            },
          },
        },
      })
    } else {
      await db.project.update({
        where: {
          id: params.id,
        },
        data: {
          users: {
            disconnect: {
              id: params.memberId,
            },
          },
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[REMOVE_MEMBER_ERROR]", error)
    return NextResponse.json({ error: "移除成员失败" }, { status: 500 })
  }
}

