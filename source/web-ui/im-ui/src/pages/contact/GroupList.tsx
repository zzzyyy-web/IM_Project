import { useNavigate } from "react-router-dom"
import { useState } from "react"
import { ChevronLeft, Search, Users, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useChatStore } from "@/stores/useChatStore"
import { ContactSelector } from "@/components/common/ContactSelector"
import type { User, Group } from "@/types"

export default function GroupList() {
  const navigate = useNavigate()
  const { sessions, createGroup } = useChatStore()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  
  // Filter only group sessions
  const groups = sessions.filter(s => s.type === 'group')

  const handleCreateGroup = (selected: (User | Group)[]) => {
      if (selected.length === 0) return
      const name = prompt("请输入群名称", "新建群聊") || "新建群聊"
      // Assume selected are Users
      const memberIds = selected.map(s => s.id)
      // Add current user
      createGroup(name, [...memberIds, '1'])
      setIsCreateOpen(false)
      
      // Navigate to new group
      // Delay slightly to ensure store update
      setTimeout(() => {
          const newState = useChatStore.getState()
          if (newState.activeSessionId) {
              navigate(`/chat/${newState.activeSessionId}`)
          }
      }, 100)
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center justify-between border-b px-4 py-3 bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-2 flex-1">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="relative flex-1 mr-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索群聊"
              className="pl-9 bg-muted/50 border-none h-9"
            />
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsCreateOpen(true)}>
           <Plus className="h-5 w-5" />
        </Button>
      </header>

      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {groups.length > 0 ? (
            groups.map(group => (
              <div 
                key={group.id}
                onClick={() => navigate(`/chat/${group.id}`)}
                className="flex cursor-pointer items-center gap-3 border-b bg-background px-4 py-3 hover:bg-muted/50"
              >
                <Avatar className="h-12 w-12 rounded-lg">
                  <AvatarImage src={group.avatar} />
                  <AvatarFallback>{group.name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-medium">{group.name}</h3>
                  <p className="truncate text-xs text-muted-foreground">
                    {group.lastMessage?.content || "暂无消息"}
                  </p>
                </div>
              </div>
            ))
          ) : (
             <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
               <Users className="h-12 w-12 mb-4 opacity-20" />
               <p>暂无群聊</p>
             </div>
          )}
        </div>
      </ScrollArea>

      <ContactSelector 
         open={isCreateOpen} 
         onOpenChange={setIsCreateOpen}
         onSelect={handleCreateGroup}
         title="发起群聊"
         excludeIds={['1']} // Exclude self from selection list (optional)
      />
    </div>
  )
}
