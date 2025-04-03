"use client"

import { useEffect, useState } from "react"
import { signOut } from "next-auth/react"
import { SidebarNav } from "@/components/layout/sidebar-nav"
import { Header } from "@/components/layout/header"
import { UserNav } from "@/components/layout/user-nav"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface User {
  id: string
  name: string
  email: string
  role: string
  image?: string
}

interface AppShellProps {
  children: React.ReactNode
  user: User
}

export function AppShell({ children, user }: AppShellProps) {
  const [needsRelogin, setNeedsRelogin] = useState(false)

  // 检查是否有角色更改信号
  useEffect(() => {
    const checkSessionUpdate = async () => {
      try {
        const response = await fetch('/api/auth/check-session-update', {
          method: 'GET',
          credentials: 'include',
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.needsRelogin) {
            setNeedsRelogin(true);
            toast.info("您的用户权限已更改，请重新登录以应用更改", {
              action: {
                label: "立即登出",
                onClick: () => handleSignOut(),
              },
              duration: Infinity,
            });
          }
        }
      } catch (error) {
        console.error("Failed to check session update", error);
      }
    };
    
    checkSessionUpdate();
    
    // 设置轮询以检查会话更新
    const interval = setInterval(checkSessionUpdate, 60000); // 每分钟检查一次
    
    return () => clearInterval(interval);
  }, []);

  const handleSignOut = async () => {
    await signOut({ redirect: true, callbackUrl: "/login" });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header>
        <UserNav user={user} />
      </Header>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 border-r bg-muted/40 h-[calc(100vh-4rem)] overflow-hidden">
          <SidebarNav userRole={user.role} />
        </div>
        <main className="flex-1 overflow-y-auto p-6">
          {needsRelogin && (
            <div className="mb-4 p-4 bg-yellow-100 dark:bg-yellow-900 rounded-md">
              <div className="flex justify-between items-center">
                <p className="text-sm">您的用户权限已更改，请重新登录以应用更改</p>
                <Button size="sm" onClick={handleSignOut}>立即登出</Button>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  )
} 