import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { checkProjectAdmin, isSystemAdmin } from "@/lib/auth-utils"

interface Params {
  params: {
    id: string
  }
}

export async function POST(req: Request, { params }: Params) {
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

    const { userId, email, role } = await req.json()

    // 查找用户 - 优先使用userId，如果没有则使用email
    let user;
    
    if (userId) {
      user = await db.user.findUnique({
        where: { id: userId },
      });
    } else if (email) {
      user = await db.user.findUnique({
        where: { email },
      });
    } else {
      return NextResponse.json({ error: "需要提供用户ID或邮箱" }, { status: 400 });
    }

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    // 获取项目信息，检查用户是否已经是成员
    const project = await db.project.findUnique({
      where: {
        id: params.id,
      },
      include: {
        users: {
          where: {
            id: user.id,
          },
        },
        managers: {
          where: {
            id: user.id,
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 })
    }

    // 检查用户是否已经是成员
    if (project.users.length > 0 || project.managers.length > 0) {
      return NextResponse.json({ error: "用户已是项目成员" }, { status: 409 })
    }

    // 添加为管理员或普通成员
    if (role === "MANAGER") {
      await db.project.update({
        where: {
          id: params.id,
        },
        data: {
          managers: {
            connect: {
              id: user.id,
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
            connect: {
              id: user.id,
            },
          },
        },
      })
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error("[ADD_MEMBER_ERROR]", error)
    return NextResponse.json({ error: "添加成员失败" }, { status: 500 })
  }
}

