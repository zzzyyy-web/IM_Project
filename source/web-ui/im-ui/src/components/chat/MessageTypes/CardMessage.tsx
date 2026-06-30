import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User as UserIcon } from "lucide-react"

interface CardMessageProps {
  userId: string
  name: string
  avatar: string
  signature?: string
  isMe: boolean
}

export function CardMessage({ name, avatar, signature, isMe }: CardMessageProps) {
  return (
    <div className="w-[200px]">
       <div className="flex items-center gap-3 pb-3 border-b border-white/20 mb-2">
          <Avatar className="h-10 w-10">
             <AvatarImage src={avatar} />
             <AvatarFallback>{name[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
             <p className="text-sm font-medium truncate">{name}</p>
             <p className="text-xs opacity-70 truncate">{signature || "暂无签名"}</p>
          </div>
       </div>
       <div className="text-xs opacity-60 flex items-center gap-1">
          <UserIcon className="h-3 w-3" /> 个人名片
       </div>
    </div>
  )
}
