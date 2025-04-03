"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useSession } from "next-auth/react"
import type { Project } from "@/types"

interface ProjectDetailsProps {
  project: Project
  isSuperAdmin: boolean
}

export function ProjectDetails({ project, isSuperAdmin }: ProjectDetailsProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description || "")
  const [isLoading, setIsLoading] = useState(false)

  // 判断用户是否是项目管理员
  const isProjectAdmin = project.managers.some(manager => manager.id === session?.user?.id)
  
  // 合并两种管理员权限
  const isAdmin = isSuperAdmin || isProjectAdmin

  const handleSave = async () => {
    if (!isAdmin) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
        }),
      })

      if (!response.ok) {
        throw new Error("更新项目失败")
      }

      setIsEditing(false)
      router.refresh()
    } catch (error) {
      console.error("更新项目错误:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // 如果session不存在，不显示内容
  if (!session) {
    return null
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>项目信息</CardTitle>
          <CardDescription>查看和管理项目基本信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">项目名称</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">项目描述</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <h3 className="font-medium">项目名称</h3>
                <p>{project.name}</p>
              </div>
              <div>
                <h3 className="font-medium">项目描述</h3>
                <p>{project.description || "无描述"}</p>
              </div>
              <div>
                <h3 className="font-medium">创建时间</h3>
                <p>{new Date(project.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <h3 className="font-medium">更新时间</h3>
                <p>{new Date(project.updatedAt).toLocaleString()}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium">成员数量</h3>
                  <p>{project.users.length} 名成员</p>
                </div>
                <div>
                  <h3 className="font-medium">管理员数量</h3>
                  <p>{project.managers.length} 名管理员</p>
                </div>
              </div>
              <div>
                <h3 className="font-medium">任务数量</h3>
                <p>{project.tasks.length} 个录制任务</p>
              </div>
            </>
          )}
        </CardContent>
        {isAdmin && (
          <CardFooter>
            {isEditing ? (
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isLoading}>
                  取消
                </Button>
                <Button onClick={handleSave} disabled={isLoading}>
                  {isLoading ? "保存中..." : "保存"}
                </Button>
              </div>
            ) : (
              <Button onClick={() => setIsEditing(true)} className="ml-auto">
                编辑项目
              </Button>
            )}
          </CardFooter>
        )}
      </Card>
    </div>
  )
}

