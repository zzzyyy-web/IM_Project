import { useNavigate } from "react-router-dom"
import { ChevronLeft, Moon, Sun, Monitor, ChevronRight, Trash2, Globe } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function GeneralSettings() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()

  const SettingGroup = ({ title, children }: { title?: string, children: React.ReactNode }) => (
    <div className="mb-6">
      {title && <h3 className="mb-2 px-4 text-xs font-semibold text-muted-foreground">{title}</h3>}
      <div className="flex flex-col divide-y border-y bg-background">
        {children}
      </div>
    </div>
  )

  const SettingItem = ({ 
    label, 
    value, 
    onClick, 
    action,
    icon: Icon
  }: { 
    label: string, 
    value?: string, 
    onClick?: () => void, 
    action?: React.ReactNode,
    icon?: any
  }) => (
    <div 
      className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        {value && <span className="text-sm">{value}</span>}
        {action || <ChevronRight className="h-4 w-4 opacity-50" />}
      </div>
    </div>
  )

  return (
    <div className="flex h-full flex-col bg-muted/20">
      <header className="flex items-center gap-2 border-b bg-background px-4 py-3 sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h2 className="font-semibold">通用设置</h2>
      </header>

      <ScrollArea className="flex-1 py-4">
        <SettingGroup title="外观">
          <div className="flex items-center justify-between px-4 py-3">
             <span className="text-sm font-medium">主题模式</span>
             <Select value={theme} onValueChange={(val: any) => setTheme(val)}>
               <SelectTrigger className="w-[140px] h-8">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="light">
                   <div className="flex items-center gap-2">
                     <Sun className="h-4 w-4" /> 浅色模式
                   </div>
                 </SelectItem>
                 <SelectItem value="dark">
                   <div className="flex items-center gap-2">
                     <Moon className="h-4 w-4" /> 深色模式
                   </div>
                 </SelectItem>
                 <SelectItem value="system">
                   <div className="flex items-center gap-2">
                     <Monitor className="h-4 w-4" /> 跟随系统
                   </div>
                 </SelectItem>
               </SelectContent>
             </Select>
          </div>
          <SettingItem label="字体大小" value="标准" onClick={() => alert("字体大小设置功能暂未实现")} />
          <SettingItem label="聊天背景" onClick={() => alert("请在具体会话中设置聊天背景")} />
        </SettingGroup>

        <SettingGroup title="语言与地区">
          <SettingItem label="多语言" value="简体中文" icon={Globe} onClick={() => alert("多语言切换功能暂未实现")} />
        </SettingGroup>

        <SettingGroup title="存储">
          <SettingItem label="存储空间管理" value="已用 128MB" onClick={() => {
              // Mock Storage Calculation
              alert("正在计算存储空间...\n共占用: 128MB\n其中:\n图片: 80MB\n视频: 30MB\n文件: 18MB")
          }}/>
          <SettingItem label="清空缓存" onClick={() => {
              if (confirm("确定要清空所有缓存吗？这将删除所有临时文件，但不会删除聊天记录。")) {
                  alert("缓存已清空")
              }
          }} action={<Trash2 className="h-4 w-4" />} />
        </SettingGroup>

        <SettingGroup>
          <SettingItem label="关于我们" value="v1.0.0" />
          <SettingItem label="帮助与反馈" />
        </SettingGroup>
      </ScrollArea>
    </div>
  )
}
