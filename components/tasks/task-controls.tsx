"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Play, Square, Trash } from "lucide-react"
import type { RecordingTask } from "@/types"
import { toast } from "sonner"

interface TaskControlsProps {
  task: RecordingTask
  isAdmin: boolean
}

export function TaskControls({ task, isAdmin }: TaskControlsProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleStartTask = async () => {
    if (!isAdmin) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/tasks/${task.id}/start`, {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "启动任务失败")
      }

      toast.success("任务已启动")
      
      // 使用 router.refresh() 刷新数据
      router.refresh()
      
      // 2秒后重新加载页面，确保数据同步
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (error: any) {
      toast.error(error.message || "启动任务失败")
    } finally {
      setIsLoading(false)
    }
  }

  const handleStopTask = async () => {
    if (!isAdmin) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/tasks/${task.id}/stop`, {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || "停止任务失败")
      }

      toast.success("任务已停止")
      
      // 使用 router.refresh() 刷新数据
      router.refresh()
      
      // 2秒后重新加载页面，确保数据同步
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (error: any) {
      console.error("Error stopping task:", error)
      toast.error(error.message || "停止任务失败")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteTask = async () => {
    if (!isAdmin) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "删除任务失败")
      }

      toast.success("任务已删除")
      router.push(`/projects/${task.projectId}`)
    } catch (error: any) {
      console.error("Error deleting task:", error)
      toast.error(error.message || "删除任务失败")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>任务控制</CardTitle>
        <CardDescription>管理录制任务的运行状态</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdmin ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Button onClick={handleStartTask} disabled={task.status === "RUNNING" || isLoading} className="w-full">
                {isLoading ? (
                  <span className="h-4 w-4 mr-2 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                启动任务
              </Button>
              <Button
                onClick={handleStopTask}
                disabled={task.status !== "RUNNING" || isLoading}
                variant="secondary"
                className="w-full"
              >
                {isLoading ? (
                  <span className="h-4 w-4 mr-2 rounded-full border-2 border-gray-700 border-t-transparent animate-spin"></span>
                ) : (
                  <Square className="mr-2 h-4 w-4" />
                )}
                停止任务
              </Button>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full" disabled={isLoading}>
                  <Trash className="mr-2 h-4 w-4" />
                  删除任务
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认删除</AlertDialogTitle>
                  <AlertDialogDescription>
                    您确定要删除此录制任务吗？此操作无法撤销，所有相关的日志记录也将被删除。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteTask}>确认删除</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : (
          <p className="text-center text-muted-foreground">您没有权限控制此任务</p>
        )}
      </CardContent>
    </Card>
  )
}

