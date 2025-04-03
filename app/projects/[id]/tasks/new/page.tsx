"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { useEffect } from "react"

interface NewTaskPageProps {
  params: {
    id: string
  }
}

export default function NewTaskPage({ params }: NewTaskPageProps) {
  const router = useRouter()
  const { id } = params;
  
  const [isLoading, setIsLoading] = useState(false)
  const [platforms, setPlatforms] = useState<{ id: string; name: string }[]>([])
  const [platformId, setPlatformId] = useState("")

  useEffect(() => {
    // 获取平台列表
    const fetchPlatforms = async () => {
      try {
        const response = await fetch("/api/platforms")
        if (!response.ok) throw new Error("获取平台列表失败")
        const data = await response.json()
        setPlatforms(data)
        if (data.length > 0) {
          setPlatformId(data[0].id)
        }
      } catch (error) {
        console.error("Error fetching platforms:", error)
        toast.error("获取平台列表失败")
      }
    }

    fetchPlatforms()
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)

    const formData = new FormData(event.currentTarget)
    const data = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      platformId: platformId,
      projectId: id,
    }

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error("创建任务失败")
      }

      toast.success("任务创建成功")
      router.push(`/tasks`)
      router.refresh()
    } catch (error) {
      toast.error("创建任务失败")
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <DashboardShell>
      <DashboardHeader heading="新建录制任务" text="创建一个新的直播录制任务" />
      <Card>
        <CardHeader>
          <CardTitle>任务信息</CardTitle>
          <CardDescription>填写直播任务的基本信息</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">任务名称</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">任务描述</Label>
              <Textarea id="description" name="description" rows={4} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform">直播平台</Label>
              <Select value={platformId} onValueChange={setPlatformId}>
                <SelectTrigger id="platform">
                  <SelectValue placeholder="选择直播平台" />
                </SelectTrigger>
                <SelectContent>
                  {platforms.map((platform) => (
                    <SelectItem key={platform.id} value={platform.id}>
                      {platform.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {platforms.length === 0 && (
                <p className="text-sm text-muted-foreground">暂无可用平台，请先添加直播平台</p>
              )}
            </div>
            <Button type="submit" disabled={isLoading || platforms.length === 0}>
              {isLoading ? "创建中..." : "创建任务"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </DashboardShell>
  )
}

