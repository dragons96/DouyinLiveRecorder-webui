import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
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

    // Check if user is super admin
    const isSuperAdmin = await checkUserRole(session.user.id, "SUPER_ADMIN")
    if (!isSuperAdmin) {
      return NextResponse.json({ message: "权限不足" }, { status: 403 })
    }

    const { enabled } = await req.json()

    // 准备更新数据
    const updateData: any = {}
    
    // 只允许更新启用状态
    if (enabled !== undefined) updateData.enabled = enabled

    // Update platform
    const platform = await db.platform.update({
      where: {
        id: params.id,
      },
      data: updateData,
    })

    return NextResponse.json(platform)
  } catch (error) {
    console.error("Update platform error:", error)
    return NextResponse.json({ message: "更新平台失败" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ message: "未授权" }, { status: 401 })
    }

    // 平台不允许删除，返回权限不足
    return NextResponse.json({ message: "平台删除功能已禁用" }, { status: 403 })
  } catch (error) {
    console.error("Delete platform error:", error)
    return NextResponse.json({ message: "删除平台失败" }, { status: 500 })
  }
}

