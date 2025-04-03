import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const query = searchParams.get("query") || ""
    const excludeProjectId = searchParams.get("excludeProjectId") || ""
    const limit = Number(searchParams.get("limit") || "20")

    // 构建查询条件
    let whereCondition: any = {}
    
    // 如果有查询词，则添加搜索条件
    if (query && query.length > 0) {
      whereCondition.OR = [
        {
          name: {
            contains: query,
          },
        },
        {
          email: {
            contains: query,
          },
        },
      ]
    }

    // 查询用户
    let users = await db.user.findMany({
      where: whereCondition,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
      orderBy: {
        name: "asc", // 按名称排序
      },
      take: limit, // 限制结果数量
    })

    // 如果提供了排除项目ID，则排除已在该项目中的用户
    if (excludeProjectId) {
      const projectWithMembers = await db.project.findUnique({
        where: {
          id: excludeProjectId,
        },
        include: {
          users: {
            select: {
              id: true,
            },
          },
          managers: {
            select: {
              id: true,
            },
          },
        },
      })

      if (projectWithMembers) {
        const userIds = [
          ...projectWithMembers.users.map(u => u.id),
          ...projectWithMembers.managers.map(u => u.id)
        ]
        
        users = users.filter(user => !userIds.includes(user.id))
      }
    }

    return NextResponse.json(users)
  } catch (error) {
    console.error("[USERS_SEARCH]", error)
    return NextResponse.json({ error: "搜索用户失败" }, { status: 500 })
  }
} 