import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { compare, hash } from "bcryptjs"

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return new NextResponse("未授权", { status: 401 })
    }

    const body = await req.json()
    const { name, currentPassword, newPassword } = body

    // 获取当前用户
    const user = await db.user.findUnique({
      where: {
        id: session.user.id,
      },
    })

    if (!user) {
      return new NextResponse("用户不存在", { status: 404 })
    }

    // 如果要修改密码
    if (newPassword) {
      // 验证当前密码
      const isPasswordValid = await compare(currentPassword, user.password)
      if (!isPasswordValid) {
        return new NextResponse("当前密码错误", { status: 400 })
      }

      // 更新密码
      const hashedPassword = await hash(newPassword, 12)
      await db.user.update({
        where: {
          id: user.id,
        },
        data: {
          password: hashedPassword,
        },
      })
    }

    // 更新用户信息
    await db.user.update({
      where: {
        id: user.id,
      },
      data: {
        name,
      },
    })

    return new NextResponse("更新成功", { status: 200 })
  } catch (error) {
    console.error("[PROFILE_PUT]", error)
    return new NextResponse("内部服务器错误", { status: 500 })
  }
} 