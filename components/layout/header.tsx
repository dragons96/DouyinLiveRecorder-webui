"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface HeaderProps {
  children: React.ReactNode
}

export function Header({ children }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background shadow-sm">
      <div className="h-16 px-6 flex items-center justify-between">
        <div className="flex items-center">
          <a href="/" className="flex items-center">
            <span className="font-bold text-lg md:text-xl bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">直播录制管理系统</span>
          </a>
        </div>
        <div className="flex items-center gap-2">
          {children}
        </div>
      </div>
    </header>
  )
} 