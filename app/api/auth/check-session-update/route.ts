import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// 用于存储已请求更新的用户ID
const userRoleUpdates = new Map<string, boolean>();

// 标记用户需要更新会话
export function markUserForUpdate(userId: string) {
  userRoleUpdates.set(userId, true);
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ needsRelogin: false }, { status: 200 })
    }

    // 检查用户是否被标记为需要更新
    const needsRelogin = userRoleUpdates.get(session.user.id) || false

    // 如果用户被标记为需要更新，则检查数据库中的角色是否与会话中的角色不同
    if (!needsRelogin) {
      const user = await db.user.findUnique({
        where: {
          id: session.user.id,
        },
        select: {
          role: true,
        },
      })

      // 检查角色是否已更改
      // 只有 SUPER_ADMIN 和 USER 两种角色
      // 如果会话中是ADMIN，但数据库中已改为USER或SUPER_ADMIN，也需要重新登录
      if (user) {
        const sessionRole = session.user.role;
        const dbRole = user.role;
        
        if (sessionRole !== dbRole || 
            (sessionRole === "ADMIN" && (dbRole === "USER" || dbRole === "SUPER_ADMIN"))) {
          // 角色不匹配，需要重新登录
          userRoleUpdates.set(session.user.id, true)
          return NextResponse.json({ needsRelogin: true })
        }
      }
    }

    return NextResponse.json({ needsRelogin })
  } catch (error) {
    console.error("Session check error:", error)
    return NextResponse.json({ needsRelogin: false }, { status: 500 })
  }
} 