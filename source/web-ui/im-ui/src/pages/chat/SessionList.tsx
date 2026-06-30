import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Plus, Pin, Trash2, VolumeX, Check, Scan, UserPlus, Users, Wifi, WifiOff } from "lucide-react"
import { useChatStore } from "@/stores/useChatStore"
import { formatTime } from "@/utils/date"
import { cn } from "@/lib/utils"
import { ContactSelector } from "@/components/common/ContactSelector"
import type { User, Group } from "@/types"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"

export default function SessionList() {
  const navigate = useNavigate()
  const { sessions, deleteSession, createGroup } = useChatStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false)
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline' | 'connecting'>('online')

  // Simulate network status change
  useEffect(() => {
      const timer = setInterval(() => {
          const statuses: ('online' | 'offline' | 'connecting')[] = ['online', 'online', 'online', 'connecting', 'online']
          setNetworkStatus(statuses[Math.floor(Math.random() * statuses.length)])
      }, 10000)
      return () => clearInterval(timer)
  }, [])

  const handleCreateGroup = (selected: (User | Group)[]) => {
      if (selected.length === 0) return
      const name = prompt("请输入群名称", "新建群聊") || "新建群聊"
      const memberIds = selected.map(s => s.id)
      createGroup(name, [...memberIds, '1']) // Add self
      setIsCreateGroupOpen(false)
      // Navigate will happen via store update or manual timeout, better to wait
      setTimeout(() => {
          const newState = useChatStore.getState()
          if (newState.activeSessionId) {
              navigate(`/chat/${newState.activeSessionId}`)
          }
      }, 100)
  }

  const filteredSessions = sessions.filter((session) =>
    session.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const pinnedSessions = filteredSessions.filter((s) => s.isPinned)
  const regularSessions = filteredSessions.filter((s) => !s.isPinned)

  const handleSessionClick = (id: string) => {
    navigate(`/chat/${id}`)
  }

  const SessionItem = ({ session }: { session: typeof sessions[0] }) => (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          onClick={() => handleSessionClick(session.id)}
          className={cn(
            "flex cursor-pointer items-center gap-3 border-b p-3 transition-colors hover:bg-accent/50 animate-in fade-in slide-in-from-bottom-2 duration-300",
            session.isPinned && "bg-muted/30"
          )}
        >
          <div className="relative">
            <Avatar className="h-12 w-12">
              <AvatarImage src={session.avatar} alt={session.name} />
              <AvatarFallback>{session.name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            {/* Status Indicator (Mocked as online for now, ideally from user status) */}
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-green-500" />
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex justify-between">
              <h3 className="truncate font-medium">{session.name}</h3>
              <span className="text-xs text-muted-foreground">
                {session.lastMessage ? formatTime(session.lastMessage.timestamp) : ""}
              </span>
            </div>
            <div className="flex justify-between">
              <p className="truncate text-sm text-muted-foreground">
                {session.draft ? (
                    <span className="text-red-500 mr-1">[草稿] {session.draft}</span>
                ) : (
                    (() => {
                        if (!session.lastMessage) return "暂无消息"
                        const msg = session.lastMessage
                        if (msg.type === 'image') return '[图片]'
                        if (msg.type === 'voice') return '[语音]'
                        if (msg.type === 'video') return '[视频]'
                        if (msg.type === 'file') return '[文件]'
                        if (msg.type === 'card') return '[名片]'
                        if (msg.type === 'record') return '[聊天记录]'
                        return msg.content
                    })()
                )}
              </p>
              {session.isMuted && <VolumeX className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>

          {session.unreadCount > 0 && (
            <Badge
              variant={session.isMuted ? "secondary" : "destructive"}
              className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[10px]"
            >
              {session.unreadCount > 99 ? "99+" : session.unreadCount}
            </Badge>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem>
          <Pin className="mr-2 h-4 w-4" />
          {session.isPinned ? "取消置顶" : "置顶会话"}
        </ContextMenuItem>
        <ContextMenuItem>
          <Check className="mr-2 h-4 w-4" />
          标为已读
        </ContextMenuItem>
        <ContextMenuItem>
          <VolumeX className="mr-2 h-4 w-4" />
          {session.isMuted ? "开启通知" : "关闭通知"}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            deleteSession(session.id)
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          删除聊天
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {/* Search Bar - Navigates to Global Search */}
        <div className="relative flex-1 mr-4" onClick={() => navigate('/search')}>
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <div className="pl-9 h-9 flex items-center bg-muted/50 rounded-md text-muted-foreground text-sm cursor-text">
            搜索联系人、群聊、聊天记录
          </div>
        </div>

        {/* Add Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <Plus className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => setIsCreateGroupOpen(true)}>
              <Users className="mr-2 h-4 w-4" />
              创建群聊
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/contact/new')}>
              <UserPlus className="mr-2 h-4 w-4" />
              添加好友
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => alert("扫描功能尚未接入硬件")}>
              <Scan className="mr-2 h-4 w-4" />
              扫一扫
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Network Status Bar */}
      {networkStatus !== 'online' && (
        <div className={cn(
            "px-4 py-1 text-xs flex items-center justify-center animate-in slide-in-from-top-1",
            networkStatus === 'connecting' ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"
        )}>
           {networkStatus === 'connecting' ? (
               <><Wifi className="mr-1 h-3 w-3 animate-pulse" /> 收取中...</>
           ) : (
               <><WifiOff className="mr-1 h-3 w-3" /> 网络连接不可用</>
           )}
        </div>
      )}

      {/* Session List */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {pinnedSessions.map((session) => (
            <SessionItem key={session.id} session={session} />
          ))}
          {regularSessions.map((session) => (
            <SessionItem key={session.id} session={session} />
          ))}
          {filteredSessions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Search className="mb-2 h-8 w-8 opacity-20" />
              <p>无搜索结果</p>
            </div>
          )}
        </div>
      </ScrollArea>

      <ContactSelector 
        open={isCreateGroupOpen} 
        onOpenChange={setIsCreateGroupOpen}
        onSelect={handleCreateGroup}
        title="发起群聊"
        excludeIds={['1']} // Exclude self
      />
    </div>
  )
}
