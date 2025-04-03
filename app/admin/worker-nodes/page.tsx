import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { db } from "@/lib/db"
import { WorkerNodesList } from "@/components/admin/worker-nodes-list"
import { updateAllWorkerNodesRecordingCounts } from "@/app/api/admin/worker-nodes/utils"

export default async function WorkerNodesPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  
  // 在获取工作节点列表前，先更新所有节点的录制数
  // 确保录制数基于livestream_worker_assignments表中的引用计数
  if (isSuperAdmin) {
    await updateAllWorkerNodesRecordingCounts();
  }
  
  // 获取所有启用中的平台
  const platforms = await db.platform.findMany({
    where: {
      enabled: true
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      createdAt: "asc"
    }
  });
  
  let workerNodes = [];
  
  if (isSuperAdmin) {
    // 超级管理员可以查看所有工作节点
    workerNodes = await (db as any).workerNode.findMany({
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        platformCapacities: {
          include: {
            platform: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  } else {
    // 获取用户所属的项目ID列表
    const userProjects = await db.project.findMany({
      where: {
        OR: [
          { users: { some: { id: session.user.id } } },
          { managers: { some: { id: session.user.id } } }
        ],
      },
      select: { id: true }
    });
    
    const projectIds = userProjects.map(project => project.id);
    
    // 获取用户有权访问的工作节点：所属项目的专有节点 + 所有通用节点(projectId为null)
    workerNodes = await (db as any).workerNode.findMany({
      where: {
        OR: [
          { projectId: { in: projectIds } },
          { projectId: null }
        ]
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        platformCapacities: {
          include: {
            platform: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  }

  const pageTitle = isSuperAdmin 
    ? "工作节点管理" 
    : "工作节点查看";
    
  const pageDescription = isSuperAdmin
    ? "查看所有工作节点状态和负载情况"
    : "查看您可访问的工作节点状态";

  return (
    <DashboardShell>
      <DashboardHeader
        heading={pageTitle}
        text={pageDescription}
      />
      <WorkerNodesList 
        workerNodes={workerNodes} 
        isAdmin={isSuperAdmin} 
        isSuperAdmin={isSuperAdmin}
        platforms={platforms}
      />
    </DashboardShell>
  )
} 