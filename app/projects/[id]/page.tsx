import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { authOptions } from "@/lib/auth"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProjectDetails } from "@/components/projects/project-details"
import { ProjectMembers } from "@/components/projects/project-members"
import { db } from "@/lib/db"
import { checkProjectAccess, isSystemAdmin } from "@/lib/auth-utils"
import { Plus } from "lucide-react"
import type { Project } from "@/types"

interface ProjectPageProps {
  params: {
    id: string
  }
  searchParams?: { tab?: string }
}

export default async function ProjectPage({ params, searchParams }: ProjectPageProps) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  // 提前获取项目ID
  const projectId = params.id

  // 检查用户是否是超级管理员
  const isSuperAdmin = await isSystemAdmin(session.user.id)

  const project = await db.project.findUnique({
    where: {
      id: projectId,
    },
    include: {
      users: true,
      managers: true,
      tasks: {
        orderBy: {
          updatedAt: "desc",
        },
        include: {
          user: true,
          platform: true,
          logs: true,
        },
      },
    },
  }) as Project | null

  if (!project) {
    notFound()
  }

  // 确定默认标签页值
  const defaultTab = searchParams?.tab || "details"

  // 超级管理员直接具有所有项目的访问权限
  if (!isSuperAdmin) {
    // Check if user has access to this project
    const hasAccess = await checkProjectAccess(session.user.id, project.id)
    if (!hasAccess) {
      redirect("/dashboard")
    }
  }

  // Check if user is project admin
  const isProjectAdmin = isSuperAdmin || project.managers.some((manager) => manager.id === session.user.id)

  return (
    <DashboardShell>
      <DashboardHeader heading={project.name} text={project.description || "项目详情"}>
        {isProjectAdmin}
      </DashboardHeader>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="details" data-value="details">项目详情</TabsTrigger>
          <TabsTrigger value="members" data-value="members">成员管理</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="space-y-4">
          <ProjectDetails project={project} isSuperAdmin={isSuperAdmin} />
        </TabsContent>
        <TabsContent value="members" className="space-y-4">
          <ProjectMembers project={project} isAdmin={isProjectAdmin} />
        </TabsContent>
      </Tabs>
    </DashboardShell>
  )
}

