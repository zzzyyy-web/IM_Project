import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ChevronLeft, MoreHorizontal, Phone, Video, Trash2, Forward, Star, X, Share2 } from "lucide-react"
import { useChatStore } from "@/stores/useChatStore"
import { useAuthStore } from "@/stores/useAuthStore"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MessageBubble } from "@/components/chat/MessageBubble"
import { ChatInput } from "@/components/chat/ChatInput"
import { ImageViewer } from "@/components/common/ImageViewer"
import { generateMessages } from "@/utils/mock"
import { currentUser as mockCurrentUser } from "@/utils/mock"
import { ContactSelector } from "@/components/common/ContactSelector"
import type { User, Group } from "@/types"

export default function ChatRoom() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { 
    sessions, 
    messages, 
    addMessage, 
    setMessages, 
    users, 
    groups, 
    deleteMessage, 
    recallMessage, 
    forwardMessages, 
    updateMessage, 
    addFavorite,
    markMessageAsRead,
    toggleLikeMessage,
    editMessage,
    typingStatus,
    setTyping,
    setDraft,
    resendMessage
  } = useChatStore()
  // Fallback to mockCurrentUser if auth store is empty (for dev)
  const { user } = useAuthStore()
  const currentUser = user || mockCurrentUser
  
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerImageIndex, setViewerImageIndex] = useState(0)
  
  // Forwarding
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false)
  const [forwardingMessageIds, setForwardingMessageIds] = useState<string[]>([])
  const [forwardingMode, setForwardingMode] = useState<'single' | 'combine'>('single')

  // Multi-select mode
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set())
  const [replyingTo, setReplyingTo] = useState<any | null>(null)
  const [editingMessage, setEditingMessage] = useState<any | null>(null)
  const [typingUser, setTypingUser] = useState<string | null>(null)
  
  const [readStatusOpen, setReadStatusOpen] = useState(false)
  const [readStatusUsers, setReadStatusUsers] = useState<User[]>([])

  // Get typing users for current session
  const currentTypingUsers = id && typingStatus[id] ? typingStatus[id].filter(t => t.userId !== currentUser.id) : []
  const typingText = currentTypingUsers.length > 0 
      ? (session?.type === 'group' 
          ? `${currentTypingUsers.map(u => u.username).join(', ')} 正在输入...`
          : "对方正在输入...")
      : null

  const handleCall = (type: 'voice' | 'video') => {
      alert(`${type === 'voice' ? '语音' : '视频'}通话已发起`)
      addMessage(id, {
          id: `sys-${Date.now()}`,
          sessionId: id,
          senderId: 'system',
          content: `你发起了${type === 'voice' ? '语音' : '视频'}通话`,
          type: 'system',
          timestamp: Date.now(),
          status: 'sent'
      })
  }

  const handleReadStatusClick = (readBy: string[]) => {
      const readUsers = readBy.map(uid => Object.values(users).find(u => u.id === uid)).filter(Boolean) as User[]
      setReadStatusUsers(readUsers)
      setReadStatusOpen(true)
  }

  const handleLoadMore = () => {
      if (!id) return
      // Mock loading history
      const oldMessages = generateMessages(id, [id, currentUser.id], 10)
      // Adjust timestamps to be older
      const oldestTimestamp = sessionMessages[0]?.timestamp || Date.now()
      const history = oldMessages.map((m, i) => ({
          ...m,
          id: `history-${Date.now()}-${i}`,
          timestamp: oldestTimestamp - (10 - i) * 60000
      }))
      
      setMessages(id, [...history, ...sessionMessages])
  }

  useEffect(() => {
    if (id) {
      // Clear selection when session changes
      setIsMultiSelectMode(false)
      setSelectedMessageIds(new Set())
      setReplyingTo(null)
      setEditingMessage(null)
    }
  }, [id])

  const session = sessions.find((s) => s.id === id)
  const mentionUsers = session?.type === 'group' && groups[session.targetId]
      ? groups[session.targetId].members.map(uid => Object.values(users).find(u => u.id === uid)).filter(Boolean) as User[]
      : []

  const sessionMessages = id ? (messages[id] || []) : []
  
  const images = sessionMessages
    .filter(m => m.type === 'image' && m.fileUrl)
    .map(m => m.fileUrl!)

  useEffect(() => {
    if (id && (!messages[id] || messages[id].length === 0)) {
       // Mock fetch messages
       const initialMsgs = generateMessages(id, [id, currentUser.id], 15)
       setMessages(id, initialMsgs)
    }
  }, [id, messages, setMessages, currentUser.id])

  useEffect(() => {
    // Scroll to bottom logic would go here
    // In a real app, use a ref to scroll
  }, [sessionMessages])

  if (!session) {
    return <div className="flex h-full items-center justify-center">未找到会话</div>
  }

  const handleSendMessage = (content: string, type: "text" | "image" | "file" | "voice" | "card", extra?: any) => {
      if (!id) return
      
      setDraft(id, "") // Clear draft

      const newMessage = {
          id: Date.now().toString(),
          sessionId: id,
          senderId: currentUser.id,
          content,
          type: type as any,
          timestamp: Date.now(),
          status: "sending" as const,
          // Merge extra properties (fileUrl, fileName, fileSize, voiceDuration, cardInfo)
          ...extra
      }
      addMessage(id, newMessage)
      
      // Simulate sending success
      setTimeout(() => {
        updateMessage(id, newMessage.id, { status: 'sent' })
      }, 500)

      // Simulate read
      setTimeout(() => {
        updateMessage(id, newMessage.id, { status: 'read', isRead: true })
      }, 1500)
      
      // Mock typing
      if (session.type === 'single') {
        setTimeout(() => {
          // setTypingUser(session.name)
          setTyping(id, session.targetId, session.name, true)
        }, 800)
      }

      // Mock reply
      setTimeout(() => {
          // setTypingUser(null)
          setTyping(id, session.targetId, session.name, false)
          let replyContent = `收到: ${content}`
          if (type === 'voice') replyContent = "收到语音"
          if (type === 'image') replyContent = "收到图片"
          if (type === 'file') replyContent = "收到文件"
          if (type === 'card') replyContent = "收到名片"

          const reply: any = {
              id: (Date.now() + 1).toString(),
              sessionId: id,
              senderId: session.targetId,
              content: replyContent,
              type: "text" as const,
              timestamp: Date.now(),
              status: "read" as const,
          }
          addMessage(id, reply)
          
          // Mark as read by me immediately
          if (session.type === 'group') {
             markMessageAsRead(id, reply.id, currentUser.id)
          }
      }, 2000) // Longer delay to simulate typing
  }

  const handlePreviewImage = (url: string) => {
    // Force re-render viewer by key or ensure images array is stable
    const index = images.indexOf(url)
    if (index !== -1) {
      setViewerImageIndex(index)
      setViewerOpen(true)
    }
  }

  // Message Actions
  const toggleSelectMessage = (msgId: string, checked: boolean) => {
    const newSelected = new Set(selectedMessageIds)
    if (checked) {
      newSelected.add(msgId)
    } else {
      newSelected.delete(msgId)
    }
    setSelectedMessageIds(newSelected)
  }

  const handleDeleteMessages = () => {
    if (!id) return
    const newMessages = sessionMessages.filter(m => !selectedMessageIds.has(m.id))
    setMessages(id, newMessages)
    setIsMultiSelectMode(false)
    setSelectedMessageIds(new Set())
  }
  
  const handleDeleteSingleMessage = (msgId: string) => {
    if (!id) return
    deleteMessage(id, msgId)
  }

  const handleRecallMessage = (msgId: string) => {
     if (!id) return
     recallMessage(id, msgId)
  }

  const handleForwardMessages = (mode: 'single' | 'combine' = 'single') => {
    setForwardingMode(mode)
    setForwardingMessageIds(Array.from(selectedMessageIds))
    setForwardDialogOpen(true)
  }

  const handleSingleForward = (msgId: string) => {
    setForwardingMode('single')
    setForwardingMessageIds([msgId])
    setForwardDialogOpen(true)
  }

  const handleForwardConfirm = (targets: (User | Group)[]) => {
    if (!id || forwardingMessageIds.length === 0) return
    const targetIds = targets.map(t => t.id)
    forwardMessages(id, forwardingMessageIds, targetIds, forwardingMode)
    setForwardDialogOpen(false)
    setForwardingMessageIds([])
    setIsMultiSelectMode(false)
    setSelectedMessageIds(new Set())
  }

  const handleScreenshot = () => {
    if (!id) return
    const newMessage: Message = {
        id: Date.now().toString(),
        sessionId: id,
        senderId: 'system',
        content: `${currentUser.name} 进行了截屏`,
        type: "system",
        timestamp: Date.now(),
        status: "read"
    }
    // Only send if screenshot notification is enabled (mock check)
    if (session.isScreenshotNotificationEnabled !== false) {
       addMessage(id, newMessage)
    }
  }

  const handleFavoriteMessages = () => {
    selectedMessageIds.forEach(id => {
      const msg = sessionMessages.find(m => m.id === id)
      if (msg) addFavorite(msg)
    })
    setIsMultiSelectMode(false)
    setSelectedMessageIds(new Set())
  }

  return (
    <div className="flex h-full flex-col bg-background relative">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-3 bg-background/95 backdrop-blur z-10 sticky top-0">
        <div className="flex items-center gap-2">
          {isMultiSelectMode ? (
            <Button variant="ghost" onClick={() => {
              setIsMultiSelectMode(false)
              setSelectedMessageIds(new Set())
            }}>取消</Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          )}
          
          <div className="flex items-center gap-2">
             {!isMultiSelectMode && (
               <Avatar className="h-8 w-8">
                  <AvatarImage src={session.avatar} />
                  <AvatarFallback>{session.name[0]}</AvatarFallback>
               </Avatar>
             )}
             <div>
                 <h2 className="text-sm font-semibold">
                   {isMultiSelectMode ? `已选择 ${selectedMessageIds.size} 条` : session.name}
                 </h2>
                 {!isMultiSelectMode && typingText && (
                   <p className="text-[10px] text-primary mt-0.5 leading-none animate-pulse">
                     {typingText}
                   </p>
                 )}
                 {!isMultiSelectMode && !typingText && session.type === 'single' && users[session.targetId] && (
                   <div className="flex items-center gap-1.5 mt-0.5">
                     <span className={`h-1.5 w-1.5 rounded-full ${users[session.targetId].status === 'online' ? 'bg-green-500' : users[session.targetId].status === 'busy' ? 'bg-orange-500' : 'bg-gray-400'}`} />
                     <p className="text-[10px] text-muted-foreground leading-none">
                       {users[session.targetId].status === 'online' ? '在线' : users[session.targetId].status === 'busy' ? '忙碌' : '离线'}
                     </p>
                   </div>
                 )}
                 {!isMultiSelectMode && !typingText && session.type === 'group' && groups[session.targetId] && (
                   <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">
                     {groups[session.targetId].members.length} 人 ({groups[session.targetId].members.filter(uid => users[uid]?.status === 'online').length} 在线)
                   </p>
                 )}
             </div>
          </div>
        </div>
        {!isMultiSelectMode && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => handleCall('voice')}>
              <Phone className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleCall('video')}>
              <Video className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate(`/chat/settings/${id}`)}>
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </div>
        )}
      </header>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col gap-4 pb-4">
          <div className="flex justify-center mb-2">
            <Button variant="ghost" size="sm" onClick={handleLoadMore} className="text-xs text-muted-foreground">
              查看更多历史消息
            </Button>
          </div>
          {sessionMessages.map((message) => {
            const isMe = message.senderId === currentUser.id
            const senderUser = Object.values(users).find(u => u.id === message.senderId)
            let sender = isMe ? currentUser : senderUser

            // Handle Group Alias
            if (!isMe && session.type === 'group' && senderUser && groups[session.targetId]) {
                const alias = groups[session.targetId].memberAliases?.[message.senderId]
                if (alias) {
                    sender = { ...senderUser, name: alias }
                }
            }

            const quotedMessage = message.quoteId ? sessionMessages.find(m => m.id === message.quoteId) : undefined
            
            return (
              <MessageBubble
                key={message.id}
                message={message}
                isMe={isMe}
                isGroup={session.type === 'group'}
                sender={sender}
                quotedMessage={quotedMessage}
                onPreviewImage={handlePreviewImage}
                isMultiSelectMode={isMultiSelectMode}
                isSelected={selectedMessageIds.has(message.id)}
                onSelect={() => toggleSelectMessage(message.id, !selectedMessageIds.has(message.id))}
                onDelete={() => handleDeleteSingleMessage(message.id)}
                onRecall={() => handleRecallMessage(message.id)}
                onReply={() => setReplyingTo(message)}
                onEdit={() => setEditingMessage(message)}
                onAvatarClick={(userId) => navigate(`/contact/profile/${userId}`)}
                onForward={() => handleSingleForward(message.id)}
                onFavorite={() => addFavorite(message)}
                onLike={() => toggleLikeMessage(session.id, message.id, currentUser.id)}
                onReadStatusClick={() => handleReadStatusClick(message.readBy || [])}
                onResend={() => id && resendMessage(id, message.id)}
                onEnterMultiSelect={() => {
                  setIsMultiSelectMode(true)
                  toggleSelectMessage(message.id, true)
                }}
              />
            )
          })}
        </div>
      </ScrollArea>

      {/* Input or Multi-select Actions */}
      {isMultiSelectMode ? (
        <div className="grid grid-cols-4 gap-4 border-t bg-background/95 backdrop-blur p-4 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-30">
           <div className="flex flex-col items-center gap-1 cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors" onClick={() => handleForwardMessages('single')}>
             <Forward className="h-5 w-5" />
             <span className="text-[10px]">逐条转发</span>
           </div>
           <div className="flex flex-col items-center gap-1 cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors" onClick={() => handleForwardMessages('combine')}>
             <Share2 className="h-5 w-5" />
             <span className="text-[10px]">合并转发</span>
           </div>
           <div className="flex flex-col items-center gap-1 cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors" onClick={handleFavoriteMessages}>
             <Star className="h-5 w-5" />
             <span className="text-[10px]">收藏</span>
           </div>
           <div className="flex flex-col items-center gap-1 cursor-pointer text-destructive hover:bg-destructive/10 p-2 rounded transition-colors" onClick={handleDeleteMessages}>
             <Trash2 className="h-5 w-5" />
             <span className="text-[10px]">删除</span>
           </div>
        </div>
      ) : (
        <ChatInput 
          onSendMessage={handleSendMessage} 
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          editingMessage={editingMessage}
          onUpdateMessage={(msgId, content) => {
              if (id) {
                editMessage(id, msgId, content)
                setEditingMessage(null)
              }
          }}
          onCancelEdit={() => setEditingMessage(null)}
          mentionUsers={mentionUsers}
          onTyping={(isTyping) => id && setTyping(id, currentUser.id, currentUser.name, isTyping)}
          defaultMessage={session?.draft}
          onMessageChange={(draft) => id && setDraft(id, draft)}
          onScreenshot={handleScreenshot}
        />
      )}

      <Dialog open={readStatusOpen} onOpenChange={setReadStatusOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>已读成员</DialogTitle>
            </DialogHeader>
            <div className="max-h-60 overflow-y-auto">
                {readStatusUsers.length > 0 ? (
                    readStatusUsers.map(user => (
                        <div key={user.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-md">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={user.avatar} />
                                <AvatarFallback>{user.name[0]}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{user.name}</span>
                        </div>
                    ))
                ) : (
                    <div className="p-4 text-center text-muted-foreground text-sm">暂无已读成员</div>
                )}
            </div>
        </DialogContent>
      </Dialog>

      {/* Image Viewer */}
      <ImageViewer 
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        images={images}
        initialIndex={viewerImageIndex}
      />
      
      <ContactSelector
        open={forwardDialogOpen}
        onOpenChange={setForwardDialogOpen}
        onSelect={handleForwardConfirm}
        title="选择转发对象"
        includeGroups={true}
      />
    </div>
  )
}
