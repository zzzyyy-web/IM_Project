import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Search, UserPlus, Users, ChevronRight, Folder, ChevronDown, ChevronRight as ChevronRightIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useChatStore } from "@/stores/useChatStore"
import { useAuthStore } from "@/stores/useAuthStore"
import { cn } from "@/lib/utils"
import type { User } from "@/types"

export default function ContactList() {
  const navigate = useNavigate()
  const { users } = useChatStore()
  const { user: currentUser } = useAuthStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("org")

  const allUsers = Object.values(users).filter(u => u.id !== currentUser?.id)

  const officialAccounts = allUsers.filter(u => u.isOfficial)
  const robotAccounts = allUsers.filter(u => u.isRobot)
  const regularUsers = allUsers.filter(u => !u.isOfficial && !u.isRobot)

  // Group users by initial
  const groupedUsers = regularUsers.reduce((acc, user) => {
    const initial = (user.name[0] || "#").toUpperCase()
    // Simple check for English letters, otherwise '#'
    const key = /[A-Z]/.test(initial) ? initial : "#"
    if (!acc[key]) acc[key] = []
    acc[key].push(user)
    return acc
  }, {} as Record<string, User[]>)

  const sortedInitials = Object.keys(groupedUsers).sort()

  const filteredUsers = allUsers.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const UserListItem = ({ user }: { user: User }) => (
    <div 
      className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/50"
      onClick={() => navigate(`/contact/profile/${user.id}`)}
    >
      <Avatar>
        <AvatarImage src={user.avatar} />
        <AvatarFallback>{user.name[0]}</AvatarFallback>
      </Avatar>
      <div className="flex-1 overflow-hidden">
        <h3 className="font-medium truncate flex items-center gap-1">
          {user.name}
          {user.isOfficial && <span className="text-[10px] bg-blue-100 text-blue-600 px-1 rounded border border-blue-200">官方</span>}
          {user.isRobot && <span className="text-[10px] bg-orange-100 text-orange-600 px-1 rounded border border-orange-200">机器人</span>}
        </h3>
        <p className="truncate text-sm text-muted-foreground">{user.signature || "暂无签名"}</p>
      </div>
    </div>
  )

  // Mock Organization Data
  const orgData = {
    name: "月之暗面科技有限公司",
    total: 128,
    children: [
      {
        name: "产品部",
        count: 28,
        children: [
          { name: "设计组", count: 12 },
          { name: "产品组", count: 16 }
        ]
      },
      {
        name: "研发部",
        count: 64,
        children: [
          { name: "前端组", count: 20 },
          { name: "后端组", count: 30 },
          { name: "测试组", count: 14 }
        ]
      },
      {
        name: "市场部",
        count: 15,
        children: []
      }
    ]
  }

  const OrgItem = ({ item, level = 0 }: { item: any, level?: number }) => {
    const [isOpen, setIsOpen] = useState(false)
    const hasChildren = item.children && item.children.length > 0

    return (
      <div>
        <div 
          className={cn(
            "flex items-center gap-2 px-4 py-3 hover:bg-muted/50 cursor-pointer select-none",
            level > 0 && "pl-8"
          )}
          onClick={() => hasChildren && setIsOpen(!isOpen)}
        >
          {hasChildren ? (
            isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
          ) : (
            <div className="w-4" />
          )}
          <Folder className="h-5 w-5 text-blue-500 fill-blue-100" />
          <span className="flex-1 font-medium text-sm">{item.name}</span>
          <span className="text-xs text-muted-foreground">({item.count})</span>
        </div>
        {isOpen && hasChildren && (
          <div>
            {item.children.map((child: any) => (
              <OrgItem key={child.name} item={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  const ContactItem = ({ user }: { user: User }) => (
    <div 
      onClick={() => navigate(`/contact/profile/${user.id}`)}
      className="flex cursor-pointer items-center gap-3 border-b bg-background px-4 py-3 hover:bg-muted/50"
    >
      <div className="relative">
        <Avatar className="h-10 w-10">
          <AvatarImage src={user.avatar} />
          <AvatarFallback>{user.name[0]}</AvatarFallback>
        </Avatar>
        {user.status === 'online' && (
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
        )}
        {user.status === 'busy' && (
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-orange-500 border-2 border-background" />
        )}
      </div>
      <div className="flex-1">
        <h3 className="font-medium flex items-center gap-2">
          {user.name}
          <span className="text-xs text-muted-foreground font-normal">
            {user.status === 'online' ? '[在线]' : user.status === 'busy' ? '[忙碌]' : '[离线]'}
          </span>
        </h3>
        {user.signature && (
           <p className="truncate text-xs text-muted-foreground">{user.signature}</p>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="flex flex-col border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="relative flex-1 mr-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={activeTab === 'org' ? "搜索部门、成员" : "搜索联系人"}
              className="pl-9 bg-muted/50 border-none focus-visible:ring-1"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigate("/contact/new")}>
            <UserPlus className="h-5 w-5" />
          </Button>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2 rounded-none bg-transparent p-0 border-t">
            <TabsTrigger 
              value="org" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              组织架构
            </TabsTrigger>
            <TabsTrigger 
              value="contacts" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              联系人
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <ScrollArea className="flex-1">
        {activeTab === 'org' ? (
          <div className="pb-4">
             <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/10">
               <span className="font-semibold text-sm">{orgData.name}</span>
               <span className="text-xs text-muted-foreground">{orgData.total}人</span>
             </div>
             {orgData.children.map(dept => (
               <OrgItem key={dept.name} item={dept} />
             ))}
             {/* Mock members at root level or mixed in */}
             <div className="mt-4 px-4 py-2 text-xs font-semibold text-muted-foreground bg-muted/20">常用联系人</div>
             {allUsers.slice(0, 5).map(user => <ContactItem key={user.id} user={user} />)}
          </div>
        ) : (
          <>
            {/* Functional Items */}
            {!searchQuery && (
              <div className="flex flex-col border-b">
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer" onClick={() => navigate("/contact/new")}>
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-orange-500 text-white">
                    <UserPlus className="h-6 w-6" />
                  </div>
                  <span className="flex-1 font-medium">新的朋友</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50" />
                </div>
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer" onClick={() => navigate("/contact/groups")}>
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-green-500 text-white">
                    <Users className="h-6 w-6" />
                  </div>
                  <span className="flex-1 font-medium">群聊</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50" />
                </div>
              </div>
            )}

            {/* Contact List */}
            {searchQuery ? (
               <div className="flex flex-col">
                 {filteredUsers.length === 0 && <div className="p-8 text-center text-muted-foreground">无结果</div>}
                 {filteredUsers.map(user => <UserListItem key={user.id} user={user} />)}
               </div>
            ) : (
              <div className="flex flex-col">
                 {/* Special Categories */}
                 {(officialAccounts.length > 0 || robotAccounts.length > 0) && (
                   <div>
                     {officialAccounts.length > 0 && (
                       <div>
                          <div className="bg-muted/30 px-4 py-1 text-xs font-semibold text-muted-foreground">官方账号</div>
                          {officialAccounts.map(user => <UserListItem key={user.id} user={user} />)}
                       </div>
                     )}
                     {robotAccounts.length > 0 && (
                       <div>
                          <div className="bg-muted/30 px-4 py-1 text-xs font-semibold text-muted-foreground">机器人</div>
                          {robotAccounts.map(user => <UserListItem key={user.id} user={user} />)}
                       </div>
                     )}
                   </div>
                 )}

                 {sortedInitials.map(initial => (
                   <div key={initial}>
                     <div className="bg-muted/30 px-4 py-1 text-xs font-semibold text-muted-foreground sticky top-0 z-0 backdrop-blur-sm">
                       {initial}
                     </div>
                     {groupedUsers[initial].map(user => (
                       <UserListItem key={user.id} user={user} />
                     ))}
                   </div>
                 ))}
                 <div className="py-8 text-center text-xs text-muted-foreground">
                   共 {allUsers.length} 位联系人
                 </div>
              </div>
            )}
          </>
        )}
      </ScrollArea>
    </div>
  )
}
