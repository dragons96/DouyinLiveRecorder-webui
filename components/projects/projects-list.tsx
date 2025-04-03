import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Project } from "@/types"

interface ProjectsListProps {
  projects: Project[]
}

export function ProjectsList({ projects }: ProjectsListProps) {
  return (
    <div className="grid gap-4">
      {projects.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">暂无项目</p>
          </CardContent>
        </Card>
      ) : (
        projects.map((project) => (
          <Card key={project.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle>
                  <Link href={`/projects/${project.id}`} className="hover:underline">
                    {project.name}
                  </Link>
                </CardTitle>
                <Badge>{project.users.length + project.managers.length} 成员</Badge>
              </div>
              <CardDescription>{project.description || "无描述"}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">创建于: </span>
                  {new Date(project.createdAt).toLocaleDateString()}
                </div>
                <div>
                  <span className="text-muted-foreground">更新于: </span>
                  {new Date(project.updatedAt).toLocaleDateString()}
                </div>
                <div>
                  <span className="text-muted-foreground">任务数: </span>
                  {project.tasks.length}
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

