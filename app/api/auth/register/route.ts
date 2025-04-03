import { NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { db } from "@/lib/db"

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json()

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: {
        email,
      },
    })

    if (existingUser) {
      return NextResponse.json({ message: "用户已存在" }, { status: 409 })
    }

    // Hash password
    const hashedPassword = await hash(password, 10)

    // Check if this is the first user (make them super admin)
    const userCount = await db.user.count()
    const role = userCount === 0 ? "SUPER_ADMIN" : "USER"

    // 查找或创建默认项目
    let defaultProject = await db.project.findFirst({
      where: {
        name: "默认项目",
      },
    })

    if (!defaultProject) {
      defaultProject = await db.project.create({
        data: {
          name: "默认项目",
          description: "系统默认项目，用于管理新注册用户的任务",
        },
      })
    }

    // Create user and connect to default project
    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        projects: {
          connect: {
            id: defaultProject.id,
          },
        },
      },
    })

    return NextResponse.json(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json({ message: "注册失败" }, { status: 500 })
  }
}

