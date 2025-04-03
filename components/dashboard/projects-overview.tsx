import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Project } from "@/types"

interface ProjectsOverviewProps {
  projects: Project[]
  className?: string
}

export function ProjectsOverview({ projects, className }: ProjectsOverviewProps) {
  // 使用固定格式的日期显示，避免服务器和客户端差异
  const formatDate = (dateStr: string | Date) => {
    const date = dateStr instanceof Date ? dateStr : new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>项目概览</CardTitle>
        <CardDescription>您参与的项目列表</CardDescription>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无项目</p>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => (
              <div key={project.id} className="flex items-center justify-between">
                <div>
                  <Link href={`/projects/${project.id}`} className="font-medium hover:underline">
                    {project.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">{project.description || "无描述"}</p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatDate(project.updatedAt)}
                </div>
              </div>
            ))}
            {projects.length > 0 && (
              <div className="pt-2">
                <Link href="/projects" className="text-sm text-primary hover:underline">
                  查看全部项目
                </Link>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

