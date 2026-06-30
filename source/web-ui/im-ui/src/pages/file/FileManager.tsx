import { useNavigate } from "react-router-dom"
import { ChevronLeft, FileText, Image as ImageIcon, Music, Video, MoreHorizontal, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { faker } from "@faker-js/faker"

// Mock files
const mockFiles = Array.from({ length: 15 }).map((_, i) => {
  const type = faker.helpers.arrayElement(['doc', 'image', 'video', 'audio'])
  return {
    id: `file-${i}`,
    name: faker.system.fileName(),
    size: faker.number.int({ min: 100, max: 10000 }) + ' KB',
    date: faker.date.recent().toLocaleDateString(),
    type,
    author: faker.person.fullName()
  }
})

export default function FileManager() {
  const navigate = useNavigate()

  const getIcon = (type: string) => {
    switch (type) {
      case 'image': return <ImageIcon className="h-8 w-8 text-blue-500" />
      case 'video': return <Video className="h-8 w-8 text-purple-500" />
      case 'audio': return <Music className="h-8 w-8 text-orange-500" />
      default: return <FileText className="h-8 w-8 text-gray-500" />
    }
  }

  const FileItem = ({ file }: { file: typeof mockFiles[0] }) => (
    <div className="flex items-center gap-3 px-4 py-3 bg-background border-b hover:bg-muted/50 cursor-pointer">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-muted/30">
        {getIcon(file.type)}
      </div>
      <div className="flex-1 overflow-hidden">
        <h4 className="truncate font-medium text-sm">{file.name}</h4>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{file.size}</span>
          <span>•</span>
          <span>{file.author}</span>
          <span>•</span>
          <span>{file.date}</span>
        </div>
      </div>
      <Button variant="ghost" size="icon">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </div>
  )

  return (
    <div className="flex h-full flex-col bg-muted/20">
      <header className="flex items-center justify-between border-b bg-background px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <h2 className="font-semibold">文件管理</h2>
        </div>
        <div className="flex gap-2">
           <Button variant="ghost" size="icon">
             <Search className="h-5 w-5" />
           </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Tabs defaultValue="recent" className="flex-1 flex flex-col">
          <div className="bg-background px-4 pb-2">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="recent">最近</TabsTrigger>
              <TabsTrigger value="local">本机</TabsTrigger>
              <TabsTrigger value="cloud">云盘</TabsTrigger>
            </TabsList>
          </div>
          
          <ScrollArea className="flex-1">
            <TabsContent value="recent" className="mt-0">
               <div className="px-4 py-2 text-xs text-muted-foreground bg-muted/20">本周</div>
               {mockFiles.map(file => <FileItem key={file.id} file={file} />)}
            </TabsContent>
            <TabsContent value="local" className="mt-0">
               <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                 <p>暂无本地文件</p>
               </div>
            </TabsContent>
            <TabsContent value="cloud" className="mt-0">
               <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                 <p>需登录云盘查看</p>
               </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  )
}
