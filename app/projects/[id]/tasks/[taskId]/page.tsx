import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { db } from "@/lib/db"
import { checkProjectAccess } from "@/lib/auth-utils"
import { TaskDetails } from "@/components/tasks/task-details"
import { TaskLogs } from "@/components/tasks/task-logs"
import { TaskVideos } from "@/components/task/task-videos"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface TaskPageProps {
  params: {
    id: string
    taskId: string
  }
}

export default async function TaskPage({ params }: TaskPageProps) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  // 提前解构获取参数
  const projectId = (await params).id
  const taskId = (await params).taskId

  // 获取任务信息
  const task = await db.recordingTask.findUnique({
    where: {
      id: taskId,
      projectId: projectId,
    },
    include: {
      user: true,
      platform: true,
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      logs: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  })

  if (!task) {
    notFound()
  }

  // 获取项目信息
  const project = await db.project.findUnique({
    where: {
      id: projectId,
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

  // 检查用户是否是项目管理员
  const isProjectAdmin = project.managers.some((manager) => manager.id === session.user.id)
  
  // 检查用户是否是超级管理员
  const isSuperAdmin = session.user.role === "SUPER_ADMIN"
  
  // 检查用户是否是任务创建者
  const isTaskCreator = task.userId === session.user.id

  return (
    <DashboardShell>
      <DashboardHeader
        heading={task.name}
        text={task.description || "录制任务详情"}
      />
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">任务详情</TabsTrigger>
          <TabsTrigger value="logs">任务日志</TabsTrigger>
          <TabsTrigger value="videos">录制视频</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="space-y-4">
          <TaskDetails 
            task={task as any} 
            isAdmin={isProjectAdmin} 
            isTaskCreator={isTaskCreator}
            isSuperAdmin={isSuperAdmin}
          />
        </TabsContent>
        <TabsContent value="logs" className="space-y-4">
          <TaskLogs initialLogs={task.logs} taskId={task.id} />
        </TabsContent>
        <TabsContent value="videos" className="space-y-4">
          <TaskVideos taskId={task.id} />
        </TabsContent>
      </Tabs>
    </DashboardShell>
  )
}

