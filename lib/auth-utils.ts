import { db } from "@/lib/db"

export async function checkUserRole(userId: string, role: string) {
  const user = await db.user.findUnique({
    where: {
      id: userId,
    },
  })

  return user?.role === role
}

// 检查用户是否是系统管理员
export async function isSystemAdmin(userId: string) {
  return checkUserRole(userId, "SUPER_ADMIN")
}

// 检查用户是否有项目访问权限
export async function checkProjectAccess(userId: string, projectId: string) {
  // 首先检查用户是否是超级管理员
  const isSuperAdmin = await isSystemAdmin(userId)
  
  // 超级管理员拥有所有项目的访问权限
  if (isSuperAdmin) {
    return true
  }
  
  const project = await db.project.findUnique({
    where: {
      id: projectId,
    },
    include: {
      users: {
        where: {
          id: userId,
        },
      },
      managers: {
        where: {
          id: userId,
        },
      },
    },
  })

  // 如果用户是项目成员或管理员，则有访问权限
  return (project?.users.length ?? 0) > 0 || (project?.managers.length ?? 0) > 0
}

// 检查用户是否是项目管理员
export async function checkProjectAdmin(userId: string, projectId: string) {
  const isSuperAdmin = await isSystemAdmin(userId)
  
  // 超级管理员有所有项目的管理权限
  if (isSuperAdmin) {
    return true
  }
  
  const project = await db.project.findUnique({
    where: {
      id: projectId,
    },
    include: {
      managers: {
        where: {
          id: userId,
        },
      },
    },
  })

  // 如果用户是项目管理员，则有管理权限
  return (project?.managers.length ?? 0) > 0
}

