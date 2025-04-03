import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { checkProjectAdmin } from "@/lib/auth-utils"
import { checkUserRole } from "@/lib/auth-utils"

interface Params {
  params: {
    id: string
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ message: "未授权" }, { status: 401 })
    }

    // Check if user is project admin
    const isProjectAdmin = await checkProjectAdmin(session.user.id, params.id)
    if (!isProjectAdmin) {
      return NextResponse.json({ message: "权限不足" }, { status: 403 })
    }

    const { name, description } = await req.json()

    // Update project
    const project = await db.project.update({
      where: {
        id: params.id,
      },
      data: {
        name,
        description,
      },
    })

    return NextResponse.json(project)
  } catch (error) {
    console.error("Update project error:", error)
    return NextResponse.json({ message: "更新项目失败" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ message: "未授权" }, { status: 401 })
    }

    // Check if user is super admin
    const isSuperAdmin = await checkUserRole(session.user.id, "SUPER_ADMIN")
    if (!isSuperAdmin) {
      return NextResponse.json({ message: "权限不足" }, { status: 403 })
    }

    // Delete project
    await db.project.delete({
      where: {
        id: params.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete project error:", error)
    return NextResponse.json({ message: "删除项目失败" }, { status: 500 })
  }
}

