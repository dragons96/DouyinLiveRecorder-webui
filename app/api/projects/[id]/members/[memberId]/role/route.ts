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

export async function PATCH(req: Request, { params }: Params) {
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
    }

    const { role } = await req.json()
    
    // 验证角色是否有效
    if (role !== "MANAGER" && role !== "USER") {
      return NextResponse.json({ error: "无效的角色" }, { status: 400 })
    }

    // 查找用户是否是项目成员
    const project = await db.project.findUnique({
      where: {
        id: params.id,
      },
      include: {
        users: {
          where: {
            id: params.memberId,
          },
        },
        managers: {
          where: {
            id: params.memberId,
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 })
    }

    const isUserMember = project.users.length > 0
    const isUserManager = project.managers.length > 0

    if (!isUserMember && !isUserManager) {
      return NextResponse.json({ error: "该用户不是项目成员" }, { status: 404 })
    }

    // 使用事务来安全地更新成员角色
    await db.$transaction(async (prisma) => {
      // 1. 断开当前关系
      if (isUserMember) {
        await prisma.project.update({
          where: { id: params.id },
          data: {
            users: {
              disconnect: { id: params.memberId }
            }
          }
        })
      }
      
      if (isUserManager) {
        await prisma.project.update({
          where: { id: params.id },
          data: {
            managers: {
              disconnect: { id: params.memberId }
            }
          }
        })
      }

      // 2. 建立新关系
      if (role === "MANAGER") {
        await prisma.project.update({
          where: { id: params.id },
          data: {
            managers: {
              connect: { id: params.memberId }
            }
          }
        })
      } else {
        await prisma.project.update({
          where: { id: params.id },
          data: {
            users: {
              connect: { id: params.memberId }
            }
          }
        })
      }
    })

    return NextResponse.json({ 
      message: `成员角色已更新为${role === "MANAGER" ? "项目管理员" : "普通成员"}`,
    })
  } catch (error) {
    console.error("[CHANGE_MEMBER_ROLE_ERROR]", error)
    return NextResponse.json({ error: "更新成员角色失败" }, { status: 500 })
  }
} 