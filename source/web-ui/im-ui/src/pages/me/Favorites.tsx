import { ChevronLeft, Trash2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useChatStore } from "@/stores/useChatStore"
import { MessageBubble } from "@/components/chat/MessageBubble"
import { useAuthStore } from "@/stores/useAuthStore"

export default function Favorites() {
  const navigate = useNavigate()
  const { favorites, removeFavorite } = useChatStore()
  const { user } = useAuthStore()

  const handleRemove = (id: string) => {
    removeFavorite(id)
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-2 px-4 py-3 border-b sticky top-0 bg-background z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-lg font-semibold">收藏</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {favorites.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground flex-col gap-2">
            <span className="text-4xl">⭐</span>
            <p>暂无收藏内容</p>
          </div>
        ) : (
          favorites.map((msg) => (
            <div key={msg.id} className="relative group border rounded-lg p-3 bg-card hover:shadow-sm transition-all">
              <div className="absolute right-2 top-2 z-10">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleRemove(msg.id)}>
                    <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="pr-10 pointer-events-none opacity-90 scale-[0.9] origin-top-left">
                 <MessageBubble 
                    message={msg} 
                    isMe={msg.senderId === user?.id} 
                    sender={undefined}
                 />
              </div>
              
              <div className="text-xs text-muted-foreground mt-2 pt-2 border-t flex justify-between items-center">
                <span>{msg.senderId === user?.id ? "我" : "对方"}</span>
                <span>{new Date(msg.timestamp).toLocaleString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
