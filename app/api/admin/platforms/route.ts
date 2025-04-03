import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return new NextResponse("未授权", { status: 401 })
    }

    // 平台创建功能已禁用
    return new NextResponse("平台创建功能已禁用", { status: 403 })
  } catch (error) {
    console.error("[PLATFORMS_POST]", error)
    return new NextResponse("内部服务器错误", { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return new NextResponse("未授权", { status: 401 })
    }

    const platforms = await db.platform.findMany({
      orderBy: {
        name: "asc",
      },
    })

    return NextResponse.json(platforms)
  } catch (error) {
    console.error("[PLATFORMS_GET]", error)
    return new NextResponse("内部服务器错误", { status: 500 })
  }
} 