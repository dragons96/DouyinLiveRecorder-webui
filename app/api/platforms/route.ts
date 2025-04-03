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

    // 检查用户是否是超级管理员
    const isSuperAdmin = await checkUserRole(session.user.id, "SUPER_ADMIN")
    if (!isSuperAdmin) {
      return NextResponse.json({ error: "权限不足" }, { status: 403 })
    }

    // 平台创建功能已禁用
    return NextResponse.json({ error: "平台创建功能已禁用" }, { status: 403 })
  } catch (error) {
    console.error("[PLATFORMS_POST]", error)
    return NextResponse.json({ error: "创建平台失败" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    // 获取所有平台
    const platforms = await db.platform.findMany({
      orderBy: {
        name: "asc",
      },
    })

    return NextResponse.json(platforms)
  } catch (error) {
    console.error("[PLATFORMS_GET]", error)
    return NextResponse.json({ error: "获取平台列表失败" }, { status: 500 })
  }
}

