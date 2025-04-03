"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  FolderKanban,
  Users,
  Settings,
  ClipboardList,
  Laptop,
  Plus,
  Server,
  Cpu,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface NavItemProps {
  item: NavItem
  pathname: string
  level?: number
  openGroups: Record<string, boolean>
  handleToggleGroup: (group: string) => void
}

interface NavItem {
  title: string
  href?: string
  icon?: React.ReactNode
  children?: NavItem[]
}

interface SidebarNavProps {
  userRole: string
}

export function SidebarNav({ userRole }: SidebarNavProps) {
  const pathname = usePathname()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    admin: userRole === "SUPER_ADMIN",
  })
  const [platforms, setPlatforms] = useState<{ id: string; name: string }[]>([])

  // 获取所有平台
  useEffect(() => {
    const fetchPlatforms = async () => {
      if (userRole !== "SUPER_ADMIN") return
      
      try {
        const response = await fetch("/api/platforms")
        if (response.ok) {
          const data = await response.json()
          setPlatforms(data.map((platform: any) => ({
            id: platform.id,
            name: platform.name,
          })))
        }
      } catch (error) {
        console.error("Error fetching platforms:", error)
      }
    }

    fetchPlatforms()
  }, [userRole])

  const handleToggleGroup = (group: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }))
  }

  const navItems: NavItem[] = [
    {
      title: "控制面板",
      href: "/dashboard",
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      title: "录制任务",
      href: "/tasks",
      icon: <Laptop className="h-5 w-5" />,
    },
    // 所有用户都可以看到工作节点菜单，直接作为一级菜单
    {
      title: "工作节点",
      href: "/admin/worker-nodes",
      icon: <Server className="h-5 w-5" />,
    }
  ]

  const adminNavItems: NavItem[] = [
    {
      title: "系统管理",
      icon: <Settings className="h-5 w-5" />,
      children: [
        {
          title: "用户管理",
          href: "/admin/users",
          icon: <Users className="h-4 w-4" />,
        },
        {
          title: "平台管理",
          href: "/admin/platforms",
          icon: <Laptop className="h-4 w-4" />,
        },
        {
          title: "项目管理",
          icon: <FolderKanban className="h-4 w-4" />,
          children: [
            {
              title: "项目列表",
              href: "/projects",
              icon: <ClipboardList className="h-4 w-4" />,
            },
            {
              title: "创建项目",
              href: "/projects/new",
              icon: <Plus className="h-4 w-4" />,
            },
          ],
        },
      ],
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <nav className="grid gap-2 px-2">
        {navItems.map((item, index) => (
          <NavItemComponent
            key={index}
            item={item}
            pathname={pathname}
            openGroups={openGroups}
            handleToggleGroup={handleToggleGroup}
          />
        ))}
      </nav>
      {userRole === "SUPER_ADMIN" && (
        <nav className="grid gap-2 px-2">
          {adminNavItems.map((item, index) => (
            <NavItemComponent
              key={index}
              item={item}
              pathname={pathname}
              openGroups={openGroups}
              handleToggleGroup={handleToggleGroup}
            />
          ))}
        </nav>
      )}
    </div>
  )
}

// 渲染单个导航项的组件
function NavItemComponent({ item, pathname, level = 0, openGroups, handleToggleGroup }: NavItemProps) {
  const isActive = item.href ? pathname === item.href : false
  const hasChildren = item.children && item.children.length > 0
  const groupKey = item.title.toLowerCase()
  const isOpen = openGroups[groupKey]

  if (hasChildren) {
    return (
      <Collapsible 
        open={isOpen} 
        onOpenChange={() => handleToggleGroup(groupKey)}
        className="w-full"
      >
        <CollapsibleTrigger className="w-full">
          <div
            className={cn(
              "flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
              level > 0 ? "pl-5" : ""
            )}
          >
            <div className="flex items-center">
              {item.icon}
              <span className="ml-2">{item.title}</span>
            </div>
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pl-2">
            {item.children?.map((child, index) => (
              <NavItemComponent
                key={index}
                item={child}
                pathname={pathname}
                level={level + 1}
                openGroups={openGroups}
                handleToggleGroup={handleToggleGroup}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  return (
    <Link 
      href={item.href || "#"} 
      className={cn(
        "flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
        isActive ? "bg-accent text-accent-foreground" : "",
        level > 0 ? "pl-5" : ""
      )}
    >
      {item.icon}
      <span className="ml-2">{item.title}</span>
    </Link>
  )
} 