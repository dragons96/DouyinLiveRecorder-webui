import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { authOptions } from "@/lib/auth"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Button } from "@/components/ui/button"
import { db } from "@/lib/db"
import { TasksList } from "@/components/tasks/tasks-list"

// 扩展的RecordingTask类型，包含project信息
interface ExtendedRecordingTask {
  id: string
  name: string
  description: string | null
  status: string
  createdAt: Date
  updatedAt: Date
  userId: string
  projectId: string
  platformId: string
  streamUrls: string
  user: {
    id: string
    name: string | null
    email: string
  }
  platform: {
    id: string
    name: string
    enabled: boolean
  }
  project?: {
    id: string
    name: string
  }
}

export default async function TasksPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  const userIsSuperAdmin = session.user.role === "SUPER_ADMIN"
  let tasks: ExtendedRecordingTask[] = [];
  let isProjectAdmin = false;
  
  // 获取用户管理的项目列表
  const managedProjects = await db.project.findMany({
    where: {
      managers: {
        some: {
          id: session.user.id,
        },
      },
    },
    select: {
      id: true,
    },
  });
  
  // 判断用户是否是某个项目的管理员
  isProjectAdmin = managedProjects.length > 0;
  const managedProjectIds = managedProjects.map(project => project.id);

  if (userIsSuperAdmin) {
    // 超级管理员可以看到所有项目的所有任务
    tasks = await db.recordingTask.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        platform: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }) as unknown as ExtendedRecordingTask[]
  } else if (isProjectAdmin) {
    // 项目管理员可以看到他管理的项目的所有任务
    tasks = await db.recordingTask.findMany({
      where: {
        projectId: {
          in: managedProjectIds,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        platform: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }) as unknown as ExtendedRecordingTask[]
  } else {
    // 普通用户只能看到自己创建的任务
    tasks = await db.recordingTask.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        platform: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }) as unknown as ExtendedRecordingTask[]
  }
  
  // 确定页面标题和描述
  let pageTitle = "我的录制任务";
  let pageDescription = "查看和管理您创建的录制任务";
  
  if (userIsSuperAdmin) {
    pageTitle = "所有录制任务";
    pageDescription = "查看和管理系统中的所有录制任务";
  } else if (isProjectAdmin) {
    pageTitle = "项目录制任务";
    pageDescription = "查看和管理您所管理项目的录制任务";
  }

  // 用户是否有管理权限（超级管理员或项目管理员）
  const hasManagementAccess = userIsSuperAdmin || isProjectAdmin;

  return (
    <DashboardShell>
      <DashboardHeader heading={pageTitle} text={pageDescription}>
        <Button asChild>
          <Link href="/tasks/new">
            新建录制任务
          </Link>
        </Button>
      </DashboardHeader>

      <TasksList 
        tasks={tasks} 
        showProject={true} 
        isAdmin={hasManagementAccess} 
        isSuperAdmin={session.user.role === "SUPER_ADMIN"}
      />
    </DashboardShell>
  )
} 