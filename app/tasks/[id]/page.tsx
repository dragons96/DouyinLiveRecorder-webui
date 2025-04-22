import { notFound, redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { TaskDetails } from "@/components/tasks/task-details"
import { TaskLogs } from "@/components/tasks/task-logs"
import { TaskVideos } from "@/components/task/task-videos"
import { db } from "@/lib/db"
import { checkProjectAccess } from "@/lib/auth-utils"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Home } from "lucide-react"
import type { RecordingTask } from "@/types"

interface TaskPageProps {
  params: {
    id: string
  }
}

export default async function TaskPage({ params }: TaskPageProps) {
  const session = await getServerSession(authOptions)
  
  // 解构params对象，避免直接访问
  const { id } = params;

  if (!session) {
    redirect("/login")
  }

  try {
    console.log("开始获取任务数据: ", id);
    
    const taskData = await db.recordingTask.findUnique({
      where: {
        id: id,
      },
      include: {
        project: {
          include: {
            managers: true,
          }
        },
        platform: true,
        user: true,
        logs: {
          orderBy: {
            createdAt: "desc"
          },
          take: 50
        }
      },
    })

    if (!taskData) {
      console.error(`任务不存在: ${id}`)
      notFound()
    }

    // 如果项目信息不存在，但projectId存在，则尝试单独获取项目信息
    let projectData = taskData.project;
    if (!projectData && taskData.projectId) {
      try {
        console.log(`尝试直接获取项目信息: ${taskData.projectId}`);
        const projectResult = await db.project.findUnique({
          where: { id: taskData.projectId },
          include: { managers: true }
        });
        
        if (projectResult) {
          projectData = projectResult;
          console.log(`直接获取项目成功: ${projectResult.name}`);
        } else {
          console.log(`直接获取项目失败: 项目ID ${taskData.projectId} 不存在`);
        }
      } catch (err) {
        console.error(`获取项目信息失败:`, err);
      }
    }

    console.log(`任务数据 (原始): `, {
      id: taskData.id,
      name: taskData.name,
      projectId: taskData.projectId,
      hasProject: !!taskData.project,
      project: taskData.project ? {
        id: taskData.project.id,
        name: taskData.project.name
      } : null
    });

    // 创建默认项目对象
    const defaultProject = {
      id: taskData.projectId,
      name: `项目 (ID: ${taskData.projectId})`,
      managers: [],
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      users: [],
      tasks: []
    };

    // 将数据库结果转换为RecordingTask类型
    const task = {
      ...taskData,
      project: projectData || defaultProject
    } as unknown as RecordingTask;

    console.log(`任务数据 (转换后): `, {
      id: task.id,
      name: task.name,
      projectId: task.projectId,
      hasProject: !!task.project,
      project: task.project ? {
        id: task.project.id,
        name: task.project.name
      } : null
    });

    // 检查用户是否有访问该任务所属项目的权限
    const hasAccess = await checkProjectAccess(session.user.id, task.projectId)
    
    if (!hasAccess) {
      redirect("/dashboard")
    }

    // 检查用户是否是系统管理员
    const isSuperAdmin = session.user.role === "SUPER_ADMIN";
    const isAdmin = session.user.role === "ADMIN" || isSuperAdmin;
    
    // 检查用户是否是项目的管理者
    const isProjectAdmin = task.project && task.project.managers ?
      task.project.managers.some(manager => manager.id === session.user.id) : false;
    
    // 检查用户是否是任务创建者
    const isTaskCreator = task.userId === session.user.id;
    
    // 是否可以管理任务（系统管理员或项目管理员或任务创建者）
    const canManageTask = isSuperAdmin || isProjectAdmin || isTaskCreator;
    
    // 是否可以管理日志（项目管理员或任务创建者）
    const canManageLogs = isProjectAdmin || isTaskCreator;

    return (
      <DashboardShell>
        <DashboardHeader heading="任务详情" text="查看和管理录制任务">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">
                  <Home className="h-4 w-4" />
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href={`/projects/${task.projectId}`}>
                  <span>{task.project?.name || `项目 (ID: ${task.projectId})`}</span>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <span>{task.name}</span>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </DashboardHeader>
        <Tabs defaultValue="details" className="space-y-4">
          <TabsList>
            <TabsTrigger value="details">任务详情</TabsTrigger>
            <TabsTrigger value="logs">任务日志</TabsTrigger>
            <TabsTrigger value="videos">录制视频</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="space-y-4">
            <TaskDetails task={task} isAdmin={isProjectAdmin} isTaskCreator={isTaskCreator} isSuperAdmin={isSuperAdmin} />
          </TabsContent>
          <TabsContent value="logs" className="space-y-4">
            <TaskLogs initialLogs={taskData.logs} taskId={task.id} canManageLogs={canManageLogs} />
          </TabsContent>
          <TabsContent value="videos" className="space-y-4">
            <TaskVideos taskId={task.id} />
          </TabsContent>
        </Tabs>
      </DashboardShell>
    )
  } catch (error) {
    console.error("获取任务详情时发生错误:", error)
    notFound()
  }
} 