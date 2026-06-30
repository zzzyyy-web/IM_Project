import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Search, ChevronLeft, MessageSquare, FileText, User as UserIcon, Users } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useChatStore } from "@/stores/useChatStore"
import { format } from "date-fns"

export default function GlobalSearch() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const filterSessionId = searchParams.get('sessionId')
  const [query, setQuery] = useState("")
  const { users, groups, messages, sessions } = useChatStore()

  // 1. Contacts
  const contactResults = filterSessionId ? [] : Object.values(users).filter(u => 
    u.name.toLowerCase().includes(query.toLowerCase()) || 
    (u.phone && u.phone.includes(query))
  )

  // 2. Groups
  const groupResults = filterSessionId ? [] : Object.values(groups).filter(g => 
    g.name.toLowerCase().includes(query.toLowerCase())
  )

  // 3. Messages
  const messageResults = Object.entries(messages)
    .filter(([sessionId]) => !filterSessionId || sessionId === filterSessionId)
    .flatMap(([sessionId, msgs]) => 
    msgs.filter(m => m.type === 'text' && m.content.toLowerCase().includes(query.toLowerCase()))
        .map(m => {
            const session = sessions.find(s => s.id === sessionId)
            return { sessionId, sessionName: session?.name || '未知会话', message: m }
        })
  )

  // 4. Files
  const fileResults = Object.entries(messages)
    .filter(([sessionId]) => !filterSessionId || sessionId === filterSessionId)
    .flatMap(([sessionId, msgs]) => 
    msgs.filter(m => m.type === 'file' && m.fileName?.toLowerCase().includes(query.toLowerCase()))
        .map(m => {
            const session = sessions.find(s => s.id === sessionId)
            return { sessionId, sessionName: session?.name || '未知会话', message: m }
        })
  )

  // 5. Images
  const imageResults = Object.entries(messages)
    .filter(([sessionId]) => !filterSessionId || sessionId === filterSessionId)
    .flatMap(([sessionId, msgs]) => 
    msgs.filter(m => m.type === 'image')
        .map(m => {
            const session = sessions.find(s => s.id === sessionId)
            return { sessionId, sessionName: session?.name || '未知会话', message: m }
        })
  )

  const SearchResultItem = ({ 
    icon, 
    title, 
    subtitle, 
    time,
    onClick 
  }: { 
    icon: React.ReactNode, 
    title: string, 
    subtitle?: string, 
    time?: string,
    onClick?: () => void 
  }) => (
    <div 
      onClick={onClick}
      className="flex cursor-pointer items-center gap-3 border-b bg-background px-4 py-3 hover:bg-muted/50"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted overflow-hidden">
        {icon}
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="flex justify-between items-center">
            <h3 className="font-medium truncate">{title}</h3>
            {time && <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">{time}</span>}
        </div>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  )

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-2 border-b bg-background px-4 py-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={filterSessionId ? "搜索聊天记录" : "搜索联系人、群聊、聊天记录、文件"}
            className="pl-9 bg-muted/50 border-none h-9 focus-visible:ring-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        {query && (
            <Button variant="ghost" size="sm" onClick={() => setQuery("")} className="px-2">
            清空
            </Button>
        )}
      </header>

      <div className="flex-1 overflow-hidden flex flex-col">
        {query ? (
          <Tabs defaultValue={filterSessionId ? "messages" : "all"} className="h-full flex flex-col">
            <div className="px-4 py-2 border-b bg-background shrink-0">
              <TabsList className="w-full justify-start overflow-x-auto h-9 bg-transparent p-0">
                {!filterSessionId && <TabsTrigger value="all" className="data-[state=active]:bg-muted/50 data-[state=active]:shadow-none rounded-full px-4 h-8">全部</TabsTrigger>}
                {!filterSessionId && <TabsTrigger value="contacts" className="data-[state=active]:bg-muted/50 data-[state=active]:shadow-none rounded-full px-4 h-8">联系人 ({contactResults.length})</TabsTrigger>}
                {!filterSessionId && <TabsTrigger value="groups" className="data-[state=active]:bg-muted/50 data-[state=active]:shadow-none rounded-full px-4 h-8">群组 ({groupResults.length})</TabsTrigger>}
                <TabsTrigger value="messages" className="data-[state=active]:bg-muted/50 data-[state=active]:shadow-none rounded-full px-4 h-8">聊天记录 ({messageResults.length})</TabsTrigger>
                <TabsTrigger value="files" className="data-[state=active]:bg-muted/50 data-[state=active]:shadow-none rounded-full px-4 h-8">文件 ({fileResults.length})</TabsTrigger>
                <TabsTrigger value="images" className="data-[state=active]:bg-muted/50 data-[state=active]:shadow-none rounded-full px-4 h-8">图片 ({imageResults.length})</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              <div className="pb-4">
                  <TabsContent value="all" className="m-0">
                    {/* Contacts Section */}
                    {contactResults.length > 0 && (
                    <div className="mb-2">
                        <div className="px-4 py-2 text-xs font-semibold text-muted-foreground bg-muted/30">联系人</div>
                        {contactResults.slice(0, 3).map(user => (
                        <SearchResultItem 
                            key={user.id} 
                            icon={<Avatar><AvatarImage src={user.avatar} /><AvatarFallback>{user.name[0]}</AvatarFallback></Avatar>} 
                            title={user.name} 
                            subtitle={user.phone}
                            onClick={() => navigate(`/contact/profile/${user.id}`)}
                        />
                        ))}
                        {contactResults.length > 3 && <div className="px-4 py-2 text-center text-xs text-blue-500 cursor-pointer hover:bg-muted/20">查看更多联系人</div>}
                    </div>
                    )}
                    
                    {/* Groups Section */}
                    {groupResults.length > 0 && (
                    <div className="mb-2">
                        <div className="px-4 py-2 text-xs font-semibold text-muted-foreground bg-muted/30">群组</div>
                        {groupResults.slice(0, 3).map(group => (
                        <SearchResultItem 
                            key={group.id} 
                            icon={<Avatar><AvatarImage src={group.avatar} /><AvatarFallback>{group.name[0]}</AvatarFallback></Avatar>} 
                            title={group.name} 
                            subtitle={`${group.members.length} 位成员`}
                            onClick={() => navigate(`/chat/${group.id}`)} // Ideally navigate to group profile, but chat is fine
                        />
                        ))}
                    </div>
                    )}

                    {/* Messages Section */}
                    {messageResults.length > 0 && (
                    <div className="mb-2">
                        <div className="px-4 py-2 text-xs font-semibold text-muted-foreground bg-muted/30">聊天记录</div>
                        {messageResults.slice(0, 3).map(({sessionId, sessionName, message}) => (
                        <SearchResultItem 
                            key={message.id} 
                            icon={<MessageSquare className="h-5 w-5 text-muted-foreground" />} 
                            title={sessionName} 
                            subtitle={message.content}
                            time={format(message.timestamp, 'MM-dd HH:mm')}
                            onClick={() => navigate(`/chat/${sessionId}`)}
                        />
                        ))}
                    </div>
                    )}

                    {/* Files Section */}
                    {fileResults.length > 0 && (
                    <div className="mb-2">
                        <div className="px-4 py-2 text-xs font-semibold text-muted-foreground bg-muted/30">文件</div>
                        {fileResults.slice(0, 3).map(({sessionId, sessionName, message}) => (
                        <SearchResultItem 
                            key={message.id} 
                            icon={<FileText className="h-5 w-5 text-blue-500" />} 
                            title={message.fileName || '未知文件'} 
                            subtitle={`来自: ${sessionName}`}
                            time={format(message.timestamp, 'MM-dd HH:mm')}
                            onClick={() => navigate(`/chat/${sessionId}`)}
                        />
                        ))}
                    </div>
                    )}

                    {contactResults.length === 0 && groupResults.length === 0 && messageResults.length === 0 && fileResults.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                            <Search className="h-10 w-10 mb-2 opacity-20" />
                            <p>未找到相关内容</p>
                        </div>
                    )}
                    {/* Images Preview */}
                    {imageResults.length > 0 && (
                        <div className="mb-4">
                            <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/30">图片</div>
                            <div className="grid grid-cols-3 gap-2 px-4">
                              {imageResults.slice(0, 3).map((item, i) => (
                                  <div key={i} className="aspect-square bg-muted rounded-md overflow-hidden cursor-pointer" onClick={() => navigate(`/chat/${item.sessionId}`)}>
                                      <img src={item.message.fileUrl} className="w-full h-full object-cover" />
                                  </div>
                              ))}
                            </div>
                        </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="contacts" className="m-0">
                    {contactResults.map(user => (
                    <SearchResultItem 
                        key={user.id} 
                        icon={<Avatar><AvatarImage src={user.avatar} /><AvatarFallback>{user.name[0]}</AvatarFallback></Avatar>} 
                        title={user.name} 
                        subtitle={user.phone}
                        onClick={() => navigate(`/contact/profile/${user.id}`)}
                    />
                    ))}
                    {contactResults.length === 0 && <div className="p-8 text-center text-muted-foreground">无结果</div>}
                  </TabsContent>

                  <TabsContent value="groups" className="m-0">
                    {groupResults.map(group => (
                    <SearchResultItem 
                        key={group.id} 
                        icon={<Avatar><AvatarImage src={group.avatar} /><AvatarFallback>{group.name[0]}</AvatarFallback></Avatar>} 
                        title={group.name} 
                        subtitle={`${group.members.length} 位成员`}
                        onClick={() => navigate(`/chat/${group.id}`)}
                    />
                    ))}
                    {groupResults.length === 0 && <div className="p-8 text-center text-muted-foreground">无结果</div>}
                  </TabsContent>
                  
                  <TabsContent value="messages" className="m-0">
                    {messageResults.map(({sessionId, sessionName, message}) => (
                    <SearchResultItem 
                        key={message.id} 
                        icon={<MessageSquare className="h-5 w-5 text-muted-foreground" />} 
                        title={sessionName} 
                        subtitle={message.content}
                        time={format(message.timestamp, 'MM-dd HH:mm')}
                        onClick={() => navigate(`/chat/${sessionId}`)}
                    />
                    ))}
                    {messageResults.length === 0 && <div className="p-8 text-center text-muted-foreground">无结果</div>}
                  </TabsContent>

                  <TabsContent value="files" className="m-0">
                    {fileResults.map((item, i) => (
                    <SearchResultItem 
                        key={i} 
                        icon={<div className="bg-blue-100 text-blue-600 w-full h-full flex items-center justify-center"><FileText className="w-5 h-5" /></div>} 
                        title={item.message.fileName || '未知文件'} 
                        subtitle={item.sessionName}
                        time={format(item.message.timestamp, 'MM-dd HH:mm')}
                        onClick={() => navigate(`/chat/${item.sessionId}`)}
                    />
                    ))}
                  </TabsContent>

                  <TabsContent value="images" className="m-0">
                    <div className="grid grid-cols-3 gap-2 p-4">
                      {imageResults.map((item, i) => (
                          <div key={i} className="aspect-square bg-muted rounded-md overflow-hidden cursor-pointer relative group" onClick={() => navigate(`/chat/${item.sessionId}`)}>
                              <img src={item.message.fileUrl} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <span className="text-white text-xs truncate px-2">{item.sessionName}</span>
                              </div>
                          </div>
                      ))}
                    </div>
                  </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
            <Search className="h-12 w-12 mb-4" />
            <p>搜索联系人、群聊、聊天记录、文件</p>
          </div>
        )}
      </div>
    </div>
  )
}
