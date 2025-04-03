"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCcw, PlusCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

interface TaskLogsProps {
  initialLogs: Array<{
    id: string
    message: string
    level: string
    createdAt: Date
  }>
  taskId: string
  canManageLogs?: boolean
}

export function TaskLogs({ initialLogs, taskId, canManageLogs = false }: TaskLogsProps) {
  const [logs, setLogs] = useState(initialLogs)
  const [isLoading, setIsLoading] = useState(false)
  const [isAddingLog, setIsAddingLog] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newLogMessage, setNewLogMessage] = useState("")
  const [newLogLevel, setNewLogLevel] = useState("INFO")

  const getLevelBadge = (level: string) => {
    switch (level.toUpperCase()) {
      case "ERROR":
        return <Badge variant="destructive">错误</Badge>
      case "WARNING":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">警告</Badge>
      case "INFO":
      default:
        return <Badge variant="secondary">信息</Badge>
    }
  }

  const refreshLogs = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/logs`)
      if (!res.ok) throw new Error("获取日志失败")
      const data = await res.json()
      setLogs(data)
    } catch (error) {
      console.error("无法刷新日志:", error)
      toast.error("刷新日志失败")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddLog = async () => {
    if (!newLogMessage.trim()) {
      toast.error("日志消息不能为空")
      return
    }

    setIsAddingLog(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: newLogMessage,
          level: newLogLevel,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || "添加日志失败")
      }

      // 添加成功后刷新日志列表
      await refreshLogs()
      
      // 重置表单
      setNewLogMessage("")
      setNewLogLevel("INFO")
      setIsDialogOpen(false)
      
      toast.success("日志添加成功")
    } catch (error) {
      console.error("添加日志失败:", error)
      toast.error(error instanceof Error ? error.message : "添加日志失败")
    } finally {
      setIsAddingLog(false)
    }
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>任务日志</CardTitle>
        <div className="flex items-center space-x-2">
          {canManageLogs && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  添加日志
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>添加任务日志</DialogTitle>
                  <DialogDescription>
                    为当前任务添加一条日志记录，记录任务执行过程中的重要信息。
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="log-level">日志级别</Label>
                    <Select
                      value={newLogLevel}
                      onValueChange={setNewLogLevel}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择日志级别" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INFO">信息</SelectItem>
                        <SelectItem value="WARNING">警告</SelectItem>
                        <SelectItem value="ERROR">错误</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="log-message">日志内容</Label>
                    <Input
                      id="log-message"
                      value={newLogMessage}
                      onChange={(e) => setNewLogMessage(e.target.value)}
                      placeholder="输入日志内容..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                    disabled={isAddingLog}
                  >
                    取消
                  </Button>
                  <Button 
                    onClick={handleAddLog}
                    disabled={isAddingLog}
                  >
                    {isAddingLog ? "添加中..." : "添加日志"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshLogs}
            disabled={isLoading}
          >
            <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            暂无日志记录
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="border rounded-md p-3 flex flex-col md:flex-row md:items-center gap-2 text-sm"
              >
                <div className="shrink-0 w-20">
                  {getLevelBadge(log.level)}
                </div>
                <div className="flex-1 break-words">
                  {log.message}
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  {formatDate(log.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

