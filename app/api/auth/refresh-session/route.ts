import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ message: "未授权" }, { status: 401 })
    }

    // 这里只是返回成功，实际的会话刷新逻辑在前端实现
    // 前端需要在收到角色更改后调用logout
    return NextResponse.json({ message: "会话刷新信号已发送" })
  } catch (error) {
    console.error("Session refresh error:", error)
    return NextResponse.json({ message: "刷新会话失败" }, { status: 500 })
  }
} 