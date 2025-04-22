import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { checkUserRole } from "@/lib/auth-utils"
import { markUserForUpdate } from "../../../auth/check-session-update/route"

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

    // Check if user is super admin
    const isSuperAdmin = await checkUserRole(session.user.id, "SUPER_ADMIN")
    if (!isSuperAdmin) {
      return NextResponse.json({ message: "权限不足" }, { status: 403 })
    }

    const { role } = await req.json()

    // Update user role
    const user = await db.user.update({
      where: {
        id: params.id,
      },
      data: {
        role,
      },
    })

    // 标记用户需要更新会话
    markUserForUpdate(params.id)

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    })
  } catch (error) {
    console.error("Update user role error:", error)
    return NextResponse.json({ message: "更新用户角色失败" }, { status: 500 })
  }
}

