import { 
  LayoutGrid, 
  FileText, 
  Calendar, 
  Mail, 
  Cloud, 
  CheckSquare, 
  Users, 
  BarChart, 
  Video, 
  Globe,
  MoreHorizontal
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

export default function Workspace() {
  const apps = [
    { name: "审批", icon: CheckSquare, color: "bg-blue-500" },
    { name: "打卡", icon: Calendar, color: "bg-orange-500" },
    { name: "汇报", icon: FileText, color: "bg-green-500" },
    { name: "日程", icon: Calendar, color: "bg-indigo-500" },
    { name: "企业邮箱", icon: Mail, color: "bg-blue-600" },
    { name: "云盘", icon: Cloud, color: "bg-yellow-500" },
    { name: "通讯录", icon: Users, color: "bg-green-600" },
    { name: "视频会议", icon: Video, color: "bg-blue-400" },
    { name: "报表", icon: BarChart, color: "bg-purple-500" },
    { name: "公告", icon: Globe, color: "bg-red-500" },
  ]

  const recentApps = apps.slice(0, 4)

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center justify-between border-b px-4 py-3 bg-background sticky top-0 z-10">
        <h1 className="text-lg font-semibold">工作台</h1>
        <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
      </header>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Banner */}
          <div className="mb-6 overflow-hidden rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-lg">
            <h2 className="text-xl font-bold">欢迎开始新的一天</h2>
            <p className="mt-1 text-blue-100">待办事项: 3 个未完成任务</p>
          </div>

          {/* Recent Apps */}
          <div className="mb-6">
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">常用应用</h3>
            <div className="grid grid-cols-4 gap-4">
              {recentApps.map((app) => (
                <div key={app.name} className="flex flex-col items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${app.color} text-white shadow-sm`}>
                    <app.icon className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-medium">{app.name}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator className="my-6" />

          {/* All Apps */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">企业应用</h3>
            <div className="grid grid-cols-4 gap-y-6 gap-x-4">
              {apps.map((app) => (
                <div key={app.name} className="flex flex-col items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${app.color} text-white shadow-sm`}>
                    <app.icon className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-medium">{app.name}</span>
                </div>
              ))}
              <div className="flex flex-col items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <LayoutGrid className="h-6 w-6" />
                </div>
                <span className="text-xs font-medium">全部应用</span>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
