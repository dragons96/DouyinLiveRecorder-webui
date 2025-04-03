import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { RecordingTask } from "@/types"

interface RecentTasksProps {
  tasks: RecordingTask[]
  className?: string
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | null | undefined;

export function RecentTasks({ tasks, className }: RecentTasksProps) {
  // 将任务状态映射为展示文本
  const getStatusDisplay = (status: string) => {
    switch (status.toLowerCase()) {
      case "running":
        return { text: "运行中", variant: "default" as BadgeVariant }
      case "paused":
        return { text: "已暂停", variant: "secondary" as BadgeVariant }
      case "completed":
        return { text: "已完成", variant: "outline" as BadgeVariant }
      case "failed":
        return { text: "失败", variant: "destructive" as BadgeVariant }
      default:
        return { text: "未启动", variant: "outline" as BadgeVariant }
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>最近任务</CardTitle>
        <CardDescription>最近更新的录制任务</CardDescription>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无任务</p>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => {
              const statusDisplay = getStatusDisplay(task.status);
              return (
                <div key={task.id} className="flex items-center justify-between">
                  <div>
                    <Link href={`/projects/${task.projectId}/tasks/${task.id}`} className="font-medium hover:underline">
                      {task.name}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={statusDisplay.variant}>
                        {statusDisplay.text}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{task.project.name}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="pt-2">
              <Link href="/projects" className="text-sm text-primary hover:underline">
                查看全部任务
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

