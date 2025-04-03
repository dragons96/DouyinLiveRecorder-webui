import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { authOptions } from "@/lib/auth"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { db } from "@/lib/db"
import { checkProjectAccess } from "@/lib/auth-utils"
import { TasksList } from "@/components/tasks/tasks-list"

interface TasksPageProps {
  params: {
    id: string
  }
}

export default async function TasksPage({ params }: TasksPageProps) {
  const session = await getServerSession(authOptions)
  
  // 解构params对象，避免直接访问
  const { id } = params;

  if (!session) {
    redirect("/login")
  }

  // 获取项目信息
  const project = await db.project.findUnique({
    where: {
      id: id,
    },
    include: {
      managers: true,
    },
  })

  if (!project) {
    redirect("/projects")
  }

  // 检查用户是否有访问权限
  const hasAccess = await checkProjectAccess(session.user.id, project.id)
  if (!hasAccess) {
    redirect("/projects")
  }

  // 检查用户是否是项目管理员或超级管理员
  const isProjectAdmin = project.managers.some((manager) => manager.id === session.user.id)
  const isSuperAdmin = session.user.role === "SUPER_ADMIN"
  const hasAdminAccess = isProjectAdmin || isSuperAdmin

  // 根据用户权限获取项目任务
  let tasks;
  
  if (hasAdminAccess) {
    // 管理员可以看到项目中的所有任务
    tasks = await db.recordingTask.findMany({
      where: {
        projectId: id,
      },
      include: {
        user: true,
        platform: true,
        project: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    })
  } else {
    // 普通用户只能看到自己创建的任务
    tasks = await db.recordingTask.findMany({
      where: {
        projectId: id,
        userId: session.user.id,
      },
      include: {
        user: true,
        platform: true,
        project: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    })
  }

  const pageTitle = "项目录制任务";
  const pageDescription = hasAdminAccess 
    ? "管理项目中的所有直播录制任务" 
    : "管理您在此项目中创建的直播录制任务";

  return (
    <DashboardShell>
      <DashboardHeader heading={pageTitle} text={pageDescription}>
        <Button asChild>
          <Link href={`/projects/${id}/tasks/new`}>
            <Plus className="mr-2 h-4 w-4" />
            新建任务
          </Link>
        </Button>
      </DashboardHeader>
      <TasksList 
        tasks={tasks} 
        isAdmin={hasAdminAccess} 
        projectId={id} 
        showProject={true} 
        isSuperAdmin={isSuperAdmin}
      />
    </DashboardShell>
  )
} 