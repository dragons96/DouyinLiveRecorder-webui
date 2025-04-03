"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import type { User } from "@/types"
import { toast } from "sonner"

interface UsersListProps {
  users: User[]
}

export function UsersList({ users }: UsersListProps) {
  const router = useRouter()
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [role, setRole] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleOpenDialog = (user: User) => {
    setSelectedUser(user)
    setRole(user.role || "USER")
  }

  const handleUpdateRole = async () => {
    if (!selectedUser) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/users/${selectedUser.id}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update user role")
      }

      const data = await response.json()
      
      // 如果更新了当前用户自己的角色，发送信号强制刷新
      const refreshResponse = await fetch(`/api/auth/refresh-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (refreshResponse.ok) {
        toast.success(`用户角色已更新为 ${role === "SUPER_ADMIN" ? "超级管理员" : "普通用户"}`)
        toast.info("已通知用户重新登录以使更改生效")
      } else {
        toast.success("用户角色已更新")
      }

      setSelectedUser(null)
      router.refresh()
    } catch (error) {
      console.error("Error updating user role:", error)
      toast.error("更新角色失败")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>系统用户</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.image || ""} alt={user.name || ""} />
                    <AvatarFallback>{user.name?.charAt(0) || user.email.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {user.projects && user.projects.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          参与项目: {user.projects.length}
                        </Badge>
                      )}
                      {user.managedProjects && user.managedProjects.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          管理项目: {user.managedProjects.length}
                        </Badge>
                      )}
                      {user.tasks && user.tasks.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          任务: {user.tasks.length}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm">
                    {user.role === "SUPER_ADMIN" ? "超级管理员" : "普通用户"}
                  </span>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => handleOpenDialog(user)}>
                        修改角色
                      </Button>
                    </DialogTrigger>
                    {selectedUser && (
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>修改用户角色</DialogTitle>
                          <DialogDescription>
                            为用户 {selectedUser.name || selectedUser.email} 分配新的系统角色
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label htmlFor="role">角色</Label>
                            <Select value={role} onValueChange={setRole}>
                              <SelectTrigger id="role">
                                <SelectValue placeholder="选择角色" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="SUPER_ADMIN">超级管理员</SelectItem>
                                <SelectItem value="USER">普通用户</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setSelectedUser(null)}>
                            取消
                          </Button>
                          <Button onClick={handleUpdateRole} disabled={isLoading}>
                            {isLoading ? "更新中..." : "更新角色"}
                          </Button>
                        </div>
                      </DialogContent>
                    )}
                  </Dialog>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

