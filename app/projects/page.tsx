import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Plus } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Button } from "@/components/ui/button"
import { ProjectsList } from "@/components/projects/projects-list"
import { db } from "@/lib/db"
import { checkUserRole } from "@/lib/auth-utils"

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  // Check if user is super admin
  const isSuperAdmin = await checkUserRole(session.user.id, "SUPER_ADMIN")

  // Fetch projects based on user role
  const projects = isSuperAdmin
    ? await db.project.findMany({
        orderBy: {
          updatedAt: "desc",
        },
        include: {
          users: true,
          managers: true,
          tasks: true,
        },
      })
    : await db.project.findMany({
        where: {
          OR: [
            {
              users: {
                some: {
                  id: session.user.id,
                },
              },
            },
            {
              managers: {
                some: {
                  id: session.user.id,
                },
              },
            },
          ],
        },
        orderBy: {
          updatedAt: "desc",
        },
        include: {
          users: true,
          managers: true,
          tasks: true,
        },
      })

  return (
    <DashboardShell>
      <DashboardHeader heading="项目管理" text="管理您的直播录制项目">
        {isSuperAdmin && (
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="mr-2 h-4 w-4" />
              新建项目
            </Link>
          </Button>
        )}
      </DashboardHeader>
      <ProjectsList projects={projects} />
    </DashboardShell>
  )
}

