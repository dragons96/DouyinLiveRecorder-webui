import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { checkUserRole } from "@/lib/auth-utils"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    // Check if user is super admin
    const isSuperAdmin = await checkUserRole(session.user.id, "SUPER_ADMIN")
    if (!isSuperAdmin) {
      return NextResponse.json({ error: "权限不足" }, { status: 403 })
    }

    const body = await req.json()
    const { name, description } = body

    if (!name) {
      return NextResponse.json({ error: "项目名称不能为空" }, { status: 400 })
    }

    const project = await db.project.create({
      data: {
        name,
        description,
      },
      include: {
        users: true,
        managers: true,
        tasks: true,
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error("[PROJECTS_POST]", error)
    return NextResponse.json({ error: "创建项目失败" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    // Check if user is super admin
    const isSuperAdmin = await checkUserRole(session.user.id, "SUPER_ADMIN")

    // Fetch projects based on user role
    const projects = isSuperAdmin
      ? await db.project.findMany({
          orderBy: {
            updatedAt: "desc",
          },
          include: {
            users: true,
            managers: true,
            tasks: true,
          },
        })
      : await db.project.findMany({
          where: {
            OR: [
              {
                users: {
                  some: {
                    id: session.user.id,
                  },
                },
              },
              {
                managers: {
                  some: {
                    id: session.user.id,
                  },
                },
              },
            ],
          },
          orderBy: {
            updatedAt: "desc",
          },
          include: {
            users: true,
            managers: true,
            tasks: true,
          },
        })

    return NextResponse.json(projects)
  } catch (error) {
    console.error("[PROJECTS_GET]", error)
    return NextResponse.json({ error: "获取项目列表失败" }, { status: 500 })
  }
}

