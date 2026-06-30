import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronLeft, Search, UserPlus, Check, X, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { faker } from "@faker-js/faker"
import { useChatStore } from "@/stores/useChatStore"
import type { User } from "@/types"

export default function NewFriends() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const { addUser } = useChatStore()

  // Mock friend requests
  const [requests, setRequests] = useState(
    Array.from({ length: 5 }).map((_, i) => ({
      id: `req-${i}-${Date.now()}`,
      name: faker.person.fullName(),
      avatar: faker.image.avatar(),
      message: "请求添加你为好友",
      status: "pending" as "pending" | "accepted" | "rejected"
    }))
  )

  const handleAction = (id: string, action: "accept" | "reject") => {
    if (action === "accept") {
        const req = requests.find(r => r.id === id)
        if (req) {
            // Add to contacts store
            const newUser: User = {
                id: req.id,
                name: req.name,
                avatar: req.avatar,
                status: 'online',
                phone: faker.phone.number(),
                email: faker.internet.email(),
                bio: faker.person.bio()
            }
            addUser(newUser)
        }
    }

    setRequests(requests.map(req => 
      req.id === id ? { ...req, status: action === "accept" ? "accepted" : "rejected" } : req
    ))
  }

  const handleAddFriend = () => {
      const id = prompt("请输入对方账号/手机号")
      if (id) {
          // Mock adding a request
          const newReq = {
              id: `req-new-${Date.now()}`,
              name: `用户 ${id}`,
              avatar: faker.image.avatar(),
              message: "请求添加你为好友",
              status: "pending" as const
          }
          setRequests([newReq, ...requests])
      }
  }

  const filteredRequests = requests.filter(req => 
      req.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.message.includes(searchQuery)
  )

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-2 border-b px-4 py-3 bg-background/95 backdrop-blur sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-lg font-semibold flex-1">新的朋友</h1>
        <Button variant="ghost" size="sm" onClick={handleAddFriend}>
           添加朋友
        </Button>
      </header>

      <div className="px-4 py-3 border-b bg-muted/10">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索手机号/账号"
            className="pl-9 bg-background border-none h-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {filteredRequests.length > 0 ? (
            filteredRequests.map(req => (
              <div 
                key={req.id}
                className="flex items-center gap-3 border-b bg-background px-4 py-3"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={req.avatar} />
                  <AvatarFallback>{req.name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-medium">{req.name}</h3>
                  <p className="truncate text-xs text-muted-foreground">{req.message}</p>
                </div>
                
                {req.status === "pending" ? (
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-8 w-8 p-0 rounded-full border-red-200 hover:bg-red-50 hover:text-red-600 text-muted-foreground"
                      onClick={() => handleAction(req.id, "reject")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      className="h-8 w-8 p-0 rounded-full"
                      onClick={() => handleAction(req.id, "accept")}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground px-2">
                    {req.status === "accepted" ? "已添加" : "已拒绝"}
                  </span>
                )}
              </div>
            ))
          ) : (
             <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
               <UserPlus className="h-12 w-12 mb-4 opacity-20" />
               <p>暂无新的朋友请求</p>
             </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
