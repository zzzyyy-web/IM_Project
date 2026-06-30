import { useNavigate, useParams } from "react-router-dom"
import { ChevronLeft, MessageSquare, MoreHorizontal, Phone, Globe } from "lucide-react"
import { useChatStore } from "@/stores/useChatStore"
import { useAuthStore } from "@/stores/useAuthStore"
import { mockUsers } from "@/utils/mock"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"

export default function UserProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { createSession, sessions } = useChatStore()
  const { user: currentUser } = useAuthStore()
  
  // In real app, fetch user details
  const user = id === currentUser?.id ? currentUser : mockUsers.find(u => u.id === id)

  if (!user) {
    return <div className="flex h-full items-center justify-center">User not found</div>
  }

  const handleSendMessage = () => {
    // Check if session exists
    const existingSession = sessions.find(s => s.targetId === user.id && s.type === "single")
    if (existingSession) {
      navigate(`/chat/${existingSession.id}`)
    } else {
      createSession(user.id, "single")
      // In a real app, we'd wait for the ID, but mock createSession is synchronous or we can find it
      const newSession = useChatStore.getState().sessions.find(s => s.targetId === user.id && s.type === "single")
      if (newSession) navigate(`/chat/${newSession.id}`)
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 z-10 bg-background/95 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-6 w-6" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col px-6 pt-4 pb-8">
          <div className="flex items-start gap-4 mb-6">
             <Avatar className="h-20 w-20 rounded-lg border">
               <AvatarImage src={user.avatar} />
               <AvatarFallback>{user.name[0]}</AvatarFallback>
             </Avatar>
             <div className="flex-1 pt-1">
               <h1 className="text-xl font-bold">{user.name}</h1>
               <p className="text-sm text-muted-foreground mt-1">ID: {user.id.slice(0, 8)}</p>
               <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                 <Globe className="h-3 w-3" /> 地区: 北京
               </p>
             </div>
          </div>
          
          <Separator className="my-4" />
          
          <div className="space-y-6">
             <div className="flex justify-between items-center cursor-pointer hover:opacity-70">
               <span className="font-medium">设置备注和标签</span>
               <ChevronLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
             </div>
             
             <div className="flex justify-between items-center cursor-pointer hover:opacity-70">
               <span className="font-medium">朋友权限</span>
               <ChevronLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
             </div>
             
             <div className="space-y-2">
               <div className="flex justify-between items-start">
                  <span className="font-medium shrink-0 w-20">个性签名</span>
                  <p className="text-sm text-muted-foreground text-right flex-1">
                    {user.id === currentUser?.id ? "Edit your signature..." : (user.signature || "这个家伙很懒，什么都没留下")}
                  </p>
               </div>
               <div className="flex justify-between items-center pt-2">
                  <span className="font-medium shrink-0 w-20">朋友圈</span>
                  <div className="flex items-center gap-1">
                     <div className="h-12 w-12 bg-muted rounded"></div>
                     <div className="h-12 w-12 bg-muted rounded"></div>
                     <div className="h-12 w-12 bg-muted rounded"></div>
                     <ChevronLeft className="h-4 w-4 rotate-180 text-muted-foreground ml-2" />
                  </div>
               </div>
               <div className="flex justify-between items-center pt-2">
                  <span className="font-medium shrink-0 w-20">更多信息</span>
                  <ChevronLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
               </div>
             </div>
          </div>
  
          <Separator className="my-6" />
  
          <div className="flex flex-col gap-3">
             <Button className="w-full gap-2 font-medium" size="lg" onClick={handleSendMessage}>
               <MessageSquare className="h-5 w-5" />
               发消息
             </Button>
             <Button variant="secondary" className="w-full gap-2 font-medium" size="lg">
               <Phone className="h-5 w-5" />
               音视频通话
             </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
