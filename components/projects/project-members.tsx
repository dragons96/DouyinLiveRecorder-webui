"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UserPlus, X, Search, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { Project, User } from "@/types"

interface ProjectMembersProps {
  project: Project
  isAdmin: boolean
}

interface UserSearchResult {
  id: string
  name: string | null
  email: string
  image: string | null
}

export function ProjectMembers({ project, isAdmin }: ProjectMembersProps) {
  const router = useRouter()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [userId, setUserId] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [role, setRole] = useState("USER")
  const [isLoading, setIsLoading] = useState(false)
  const [open, setOpen] = useState(false)

  // 合并管理员和普通用户列表
  const allMembers = [...project.managers, ...project.users]

  // 当打开下拉框或搜索查询更改时，搜索用户
  useEffect(() => {
    const fetchUsers = async () => {
      // 如果下拉框未打开，不执行搜索
      if (!open) return

      setIsSearching(true)
      try {
        const url = new URL('/api/users/search', window.location.origin)
        
        // 添加排除当前项目成员的条件
        url.searchParams.append('excludeProjectId', project.id)
        
        // 如果有搜索词，添加搜索条件
        if (searchQuery) {
          url.searchParams.append('query', searchQuery)
        }
        
        const response = await fetch(url.toString())
        if (!response.ok) {
          throw new Error("获取用户列表失败")
        }
        
        const data = await response.json()
        setSearchResults(data)
      } catch (error) {
        console.error("获取用户列表错误:", error)
        toast.error("获取用户列表失败")
      } finally {
        setIsSearching(false)
      }
    }

    // 打开下拉框时立即获取用户列表
    if (open) {
      fetchUsers()
    }

    // 搜索词变化时，使用防抖
    const debounce = setTimeout(() => {
      if (searchQuery && open) {
        fetchUsers()
      }
    }, 300)

    return () => clearTimeout(debounce)
  }, [searchQuery, open, project.id])

  const handleAddMember = async () => {
    if (!isAdmin || !userId) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/projects/${project.id}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          role,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "添加成员失败")
      }

      toast.success("成员添加成功")
      setIsAddDialogOpen(false)
      setUserId("")
      setSearchQuery("")
      setRole("USER")
      router.refresh()
    } catch (error) {
      console.error("添加成员错误:", error)
      toast.error(error instanceof Error ? error.message : "添加成员失败")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveMember = async (userId: string, isManager: boolean) => {
    if (!isAdmin) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/projects/${project.id}/members/${userId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isManager,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "删除成员失败")
      }

      toast.success("成员已移除")
      router.refresh()
    } catch (error) {
      console.error("移除成员错误:", error)
      toast.error(error instanceof Error ? error.message : "移除成员失败")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>项目成员</CardTitle>
          <CardDescription>管理项目成员和权限</CardDescription>
        </div>
        {isAdmin && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                添加成员
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加项目成员</DialogTitle>
                <DialogDescription>选择用户和角色以添加到项目</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="user">选择用户</Label>
                  <Popover open={open} onOpenChange={(value) => {
                    setOpen(value)
                    // 当下拉框关闭时，清除搜索内容
                    if (!value) {
                      setSearchQuery("")
                    }
                  }}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                      >
                        {userId ? (
                          searchResults.find(user => user.id === userId)?.name || 
                          searchResults.find(user => user.id === userId)?.email || 
                          "选择用户..."
                        ) : (
                          "选择用户..."
                        )}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="搜索用户..."
                          value={searchQuery}
                          onValueChange={setSearchQuery}
                          className="h-9"
                        />
                        {isSearching && (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        )}
                        <CommandList className="max-h-[300px]">
                          <CommandEmpty>未找到用户</CommandEmpty>
                          <CommandGroup heading="用户列表">
                            {searchResults.map((user) => (
                              <CommandItem
                                key={user.id}
                                value={user.id}
                                onSelect={(value) => {
                                  setUserId(value)
                                  setOpen(false)
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={user.image || ""} alt={user.name || ""} />
                                    <AvatarFallback>{user.name?.charAt(0) || user.email.charAt(0)}</AvatarFallback>
                                  </Avatar>
                                  <div className="text-sm">
                                    {user.name && <span className="font-medium">{user.name}</span>}
                                    <span className={cn("text-muted-foreground", user.name ? "ml-2" : "")}>
                                      {user.email}
                                    </span>
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">角色</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger id="role">
                      <SelectValue placeholder="选择角色" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MANAGER">项目管理员</SelectItem>
                      <SelectItem value="USER">普通成员</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddMember} disabled={isLoading || !userId}>
                  {isLoading ? "添加中..." : "添加成员"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {allMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无成员</p>
          ) : (
            allMembers.map((user) => {
              const isManager = project.managers.some((manager) => manager.id === user.id)
              return (
                <div key={user.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.image || ""} alt={user.name || ""} />
                      <AvatarFallback>{user.name?.charAt(0) || user.email.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm">{isManager ? "项目管理员" : "普通成员"}</span>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveMember(user.id, isManager)}
                        disabled={isLoading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}

