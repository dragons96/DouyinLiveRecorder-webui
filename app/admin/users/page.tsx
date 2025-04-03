import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { UsersList } from "@/components/admin/users-list"
import { db } from "@/lib/db"
import { checkUserRole } from "@/lib/auth-utils"

export default async function UsersPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  // Check if user is super admin
  const isSuperAdmin = await checkUserRole(session.user.id, "SUPER_ADMIN")
  if (!isSuperAdmin) {
    redirect("/dashboard")
  }

  // Fetch all users
  const users = await db.user.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      projects: true,
      managedProjects: true,
      tasks: true,
    },
  })

  return (
    <DashboardShell>
      <DashboardHeader
        heading="用户管理"
        text="查看和管理系统中的所有用户"
      />
      <UsersList users={users} />
    </DashboardShell>
  )
}

