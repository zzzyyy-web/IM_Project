import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { MessageSquare, Users, Briefcase, User, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuthStore } from "@/stores/useAuthStore"
import { useChatStore } from "@/stores/useChatStore"
import { Button } from "@/components/ui/button"

export default function MainLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { sessions } = useChatStore()

  // Calculate total unread count
  const unreadCount = sessions.reduce((acc, session) => acc + (session.unreadCount || 0), 0)

  const tabs = [
    {
      id: "chat",
      label: "消息",
      icon: MessageSquare,
      path: "/",
      badge: unreadCount > 0 ? (unreadCount > 99 ? "99+" : unreadCount) : undefined
    },
    {
      id: "contact",
      label: "通讯录",
      icon: Users,
      path: "/contact",
    },
    {
      id: "workspace",
      label: "工作台",
      icon: Briefcase,
      path: "/workspace",
    },
    {
      id: "me",
      label: "我",
      icon: User,
      path: "/me",
    },
  ]

  const NavItem = ({ tab, isActive, isDesktop = false }: { tab: any, isActive: boolean, isDesktop?: boolean }) => (
    <button
      onClick={() => navigate(tab.path)}
      className={cn(
        "flex items-center justify-center transition-colors relative", // Added relative
        isDesktop 
          ? "w-12 h-12 rounded-xl mb-4 hover:bg-white/10" 
          : "flex-1 flex-col gap-1 py-2",
        isActive
          ? (isDesktop ? "bg-primary text-primary-foreground" : "text-primary")
          : (isDesktop ? "text-gray-400 hover:text-white" : "text-muted-foreground hover:text-foreground")
      )}
      title={isDesktop ? tab.label : undefined}
    >
      <div className="relative">
        <tab.icon
          className={cn(
            isDesktop ? "h-6 w-6" : "h-6 w-6",
            isActive && !isDesktop && "fill-current"
          )}
        />
        {tab.badge && (
          <span className="absolute -top-2 -right-2 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground z-10">
            {tab.badge}
          </span>
        )}
      </div>
      {!isDesktop && <span className="text-xs font-medium">{tab.label}</span>}
    </button>
  )

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Desktop Sidebar (visible on md and up) */}
      <aside className="hidden md:flex flex-col items-center w-16 bg-[#2E2E2E] py-6">
        <div className="mb-8">
           <Avatar className="h-10 w-10 cursor-pointer hover:opacity-80" onClick={() => navigate("/me")}>
             <AvatarImage src={user?.avatar} />
             <AvatarFallback>{user?.name?.[0]}</AvatarFallback>
           </Avatar>
        </div>
        
        <nav className="flex-1 flex flex-col w-full items-center">
          {tabs.map((tab) => (
            <NavItem 
              key={tab.id} 
              tab={tab} 
              isActive={location.pathname === tab.path || (tab.path !== "/" && location.pathname.startsWith(tab.path))}
              isDesktop
            />
          ))}
        </nav>

        <div className="flex flex-col gap-4 mb-4">
           <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/10" onClick={() => navigate("/settings")}>
             <Settings className="h-6 w-6" />
           </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
        <main className="flex-1 overflow-hidden relative">
          <Outlet />
        </main>

        {/* Mobile Bottom Nav (hidden on md and up) */}
        <nav className="md:hidden border-t bg-background pb-safe">
          <div className="flex h-16 items-center justify-around px-2">
            {tabs.map((tab) => (
              <NavItem 
                key={tab.id} 
                tab={tab} 
                isActive={location.pathname === tab.path || (tab.path !== "/" && location.pathname.startsWith(tab.path))} 
              />
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
