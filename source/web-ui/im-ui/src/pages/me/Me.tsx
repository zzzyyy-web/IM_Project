import { useNavigate } from "react-router-dom"
import { 
  ChevronRight, 
  Settings, 
  QrCode, 
  Wallet, 
  Smile, 
  Image as ImageIcon,
  FileText,
  HelpCircle,
  LogOut,
  Star
} from "lucide-react"
import { useAuthStore } from "@/stores/useAuthStore"
import { useChatStore } from "@/stores/useChatStore"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function Me() {
  const navigate = useNavigate()
  const { user: authUser, logout } = useAuthStore()
  const { users } = useChatStore()
  
  // In a real app, authUser would come from the auth store
  // For now, we'll use the first user from the mock store as the "current user" if authUser is not set
  const currentUser = authUser || Object.values(users)[0] || {
    id: "u_me",
    name: "当前用户",
    avatar: "https://github.com/shadcn.png",
    status: "online"
  }

  const handleLogout = () => {
    logout()
    navigate("/auth/login")
  }

  const MenuItem = ({ 
    icon: Icon, 
    label, 
    onClick,
    value
  }: { 
    icon: import("lucide-react").LucideIcon, 
    label: string, 
    onClick?: () => void,
    value?: string
  }) => (
    <div 
      onClick={onClick}
      className="flex cursor-pointer items-center justify-between bg-background px-4 py-3 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        {value && <span className="text-xs">{value}</span>}
        <ChevronRight className="h-4 w-4 opacity-50" />
      </div>
    </div>
  )

  if (!currentUser) return null

  return (
    <div className="flex h-full flex-col bg-muted/20">
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 pb-8">
          {/* Profile Header */}
          <div 
            className="mt-4 flex items-center gap-4 bg-background px-6 py-8 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => navigate(`/contact/profile/${currentUser.id}`)}
          >
            <Avatar className="h-16 w-16 rounded-lg">
              <AvatarImage src={currentUser.avatar} />
              <AvatarFallback>{currentUser.name[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-xl font-bold">{currentUser.name}</h2>
              <div className="mt-1 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">ID: {currentUser.id.slice(0, 8)}</p>
                <QrCode className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground opacity-50" />
          </div>

          {/* Services */}
          <div className="flex flex-col divide-y border-y">
            <MenuItem 
              icon={Wallet} 
              label="服务" 
              value="支付"
              onClick={() => {}} 
            />
          </div>

          {/* Features */}
          <div className="flex flex-col divide-y border-y">
            <MenuItem 
              icon={Star} 
              label="收藏" 
              onClick={() => navigate("/me/favorites")} 
            />
            <MenuItem 
              icon={FileText} 
              label="朋友圈" 
              onClick={() => {}} 
            />
            <MenuItem 
              icon={Wallet} 
              label="卡包" 
              onClick={() => {}} 
            />
            <MenuItem 
              icon={Smile} 
              label="表情" 
              onClick={() => {}} 
            />
          </div>

          {/* Settings */}
          <div className="flex flex-col divide-y border-y">
            <MenuItem 
              icon={Settings} 
              label="设置" 
              onClick={() => navigate("/settings")} 
            />
            <MenuItem 
              icon={HelpCircle} 
              label="帮助与反馈" 
              onClick={() => {}} 
            />
          </div>
          
          <div className="flex flex-col border-y bg-background">
             <Button 
               variant="ghost" 
               className="h-12 w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
               onClick={handleLogout}
             >
               <LogOut className="mr-2 h-4 w-4" />
               退出登录
             </Button>
           </div>
        </div>
      </ScrollArea>
    </div>
  )
}
