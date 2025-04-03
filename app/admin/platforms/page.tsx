import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { PlatformsList } from "@/components/admin/platforms-list"
import { db } from "@/lib/db"
import { checkUserRole } from "@/lib/auth-utils"

export default async function PlatformsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  // Check if user is super admin
  const isSuperAdmin = await checkUserRole(session.user.id, "SUPER_ADMIN")
  if (!isSuperAdmin) {
    redirect("/dashboard")
  }

  // Fetch all platforms
  const platforms = await db.platform.findMany({
    orderBy: {
      name: "asc",
    },
  })

  return (
    <DashboardShell>
      <DashboardHeader heading="平台管理" text="查看和管理直播平台配置" />
      <PlatformsList platforms={platforms} />
    </DashboardShell>
  )
}

