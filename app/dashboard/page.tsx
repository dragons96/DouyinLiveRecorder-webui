import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { ProjectsOverview } from "@/components/dashboard/projects-overview"
import { RecentTasks } from "@/components/dashboard/recent-tasks"
import { db } from "@/lib/db"
import type { Project, RecordingTask } from "@/types"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  // Fetch user's projects
  const userProjects = await db.project.findMany({
    where: {
      users: {
        some: {
          id: session.user.id,
        },
      },
    },
    take: 5,
    orderBy: {
      updatedAt: "desc",
    },
  }) as unknown as Project[]

  // Fetch recent tasks
  const recentTasks = await db.recordingTask.findMany({
    where: {
      userId: session.user.id,
    },
    take: 5,
    orderBy: {
      updatedAt: "desc",
    },
    include: {
      project: true,
    },
  }) as unknown as RecordingTask[]

  return (
    <DashboardShell>
      <DashboardHeader heading="控制面板" text="查看您的项目和最近的录制任务" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <ProjectsOverview projects={userProjects} className="col-span-4" />
        <RecentTasks tasks={recentTasks} className="col-span-3" />
      </div>
    </DashboardShell>
  )
}

