import { useState, useRef, useEffect, forwardRef, useImperativeHandle, ForwardedRef } from "react"
import { 
  Smile, 
  Paperclip, 
  Mic, 
  Send, 
  Image as ImageIcon, 
  Plus, 
  Keyboard,
  Camera,
  FileText,
  User as UserIcon,
  MapPin,
  X,
  Scissors
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ImageEditor } from "@/components/common/ImageEditor"
import { cn } from "@/lib/utils"

import type { Message } from "@/types"

interface ChatInputProps {
  onSendMessage: (content: string, type: "text" | "image" | "file" | "voice" | "card", extra?: any) => void
  replyingTo?: Message | null
  onCancelReply?: () => void
  editingMessage?: Message | null
  onUpdateMessage?: (messageId: string, content: string) => void
  onCancelEdit?: () => void
  mentionUsers?: { id: string, name: string, avatar: string }[]
  onTyping?: (isTyping: boolean) => void
  defaultMessage?: string
  onMessageChange?: (message: string) => void
  onScreenshot?: () => void
}

export type ChatInputRef = {
  focus: () => void
  insertText: (text: string) => void
}

export const ChatInput = forwardRef(({ 
    onSendMessage, 
    replyingTo, 
    onCancelReply,
    editingMessage,
    onUpdateMessage,
    onCancelEdit,
    mentionUsers = [],
    onTyping,
    defaultMessage = "",
    onMessageChange,
    onScreenshot
}: ChatInputProps, ref: ForwardedRef<ChatInputRef>) => {
  const [message, setMessage] = useState(defaultMessage)
  const [mode, setMode] = useState<'text' | 'voice'>('text')

  useEffect(() => {
    setMessage(defaultMessage)
  }, [defaultMessage])

  useEffect(() => {
    if (!editingMessage && onMessageChange) {
        onMessageChange(message)
    }
  }, [message, editingMessage]) // Removed onMessageChange from deps

  const [isRecording, setIsRecording] = useState(false)
  const [recordDuration, setRecordDuration] = useState(0)
  const [showMore, setShowMore] = useState(false)
  const [imageEditorOpen, setImageEditorOpen] = useState(false)
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null)
  const [mentionOpen, setMentionOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    insertText: (text: string) => {
        setMessage(prev => prev + text)
        inputRef.current?.focus()
    }
  }))

  // Mock emojis
  const emojis = ["😀", "😂", "🥰", "😎", "🤔", "😅", "😭", "👍", "🙏", "ok", "👋", "🎉", "🔥", "💔", "👻", "👀", "💩", "💪", "🤝", "🥳"]

  const handleSend = () => {
    if (!message.trim()) return
    
    if (editingMessage && onUpdateMessage) {
        onUpdateMessage(editingMessage.id, message)
    } else {
        onSendMessage(message, "text", replyingTo ? { quoteId: replyingTo.id } : undefined)
    }
    setMessage("")
    onCancelReply?.()
    onCancelEdit?.()
    onTyping?.(false)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    inputRef.current?.focus()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVal = e.target.value
      setMessage(newVal)
      if (newVal.endsWith('@')) {
          setMentionOpen(true)
      }

      // Typing indicator logic
      onTyping?.(true)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => {
          onTyping?.(false)
      }, 8000) // 8 seconds timeout
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    
    // Simple mention trigger: if @ is pressed
    if (e.key === '@') {
        setMentionOpen(true)
    }
  }

  const handleMentionSelect = (user: { id: string, name: string }) => {
    setMessage(prev => prev + user.name + " ")
    setMentionOpen(false)
    inputRef.current?.focus()
  }

  // Focus input when replying or editing
  useEffect(() => {
    if (replyingTo) {
      inputRef.current?.focus()
    }
  }, [replyingTo])

  useEffect(() => {
    if (editingMessage) {
      setMessage(editingMessage.content)
      setMode('text')
      inputRef.current?.focus()
    }
  }, [editingMessage])

  // Voice Logic
  const startRecording = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setIsRecording(true)
    setRecordDuration(0)
    timerRef.current = setInterval(() => {
      setRecordDuration(prev => {
        if (prev >= 60) {
          if (timerRef.current) clearInterval(timerRef.current)
          setIsRecording(false)
          onSendMessage("语音消息 (60s)", "voice", { voiceDuration: 60 })
          return 60
        }
        return prev + 1
      })
    }, 1000)
  }

  const handleStopRecording = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    stopRecording()
  }

  const stopRecording = () => {
    if (!isRecording) return
    setIsRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
    
    if (recordDuration < 1) {
      alert("录制时间太短")
      return
    }
    
    // Mock send voice
    onSendMessage(`语音消息 (${recordDuration}s)`, "voice", { voiceDuration: recordDuration })
  }

  // File/Image handlers
  const handleFileSelect = (type: 'image' | 'file') => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = type === 'image' ? 'image/*' : '*'
    if (type === 'image') {
        input.multiple = true
    }

    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files
      if (files && files.length > 0) {
        if (type === 'image') {
          if (files.length === 1) {
             const url = URL.createObjectURL(files[0])
             setSelectedImageSrc(url)
             setImageEditorOpen(true)
          } else {
             // Limit to 9 images
             const count = Math.min(files.length, 9)
             if (files.length > 9) {
                 // In a real app, use toast
                 alert("最多只能发送9张图片")
             }
             
             Array.from(files).slice(0, count).forEach((file, index) => {
                 const url = URL.createObjectURL(file)
                 // Stagger sending slightly
                 setTimeout(() => {
                     onSendMessage("图片", "image", { fileUrl: url })
                 }, index * 100)
             })
          }
        } else {
          // Mock upload for single file
          const file = files[0]
          onSendMessage(file.name, "file", { 
             fileName: file.name,
             fileSize: file.size,
             fileUrl: URL.createObjectURL(file)
          })
        }
      }
    }
    input.click()
  }

  const handleEditorSave = (blob: Blob) => {
    const url = URL.createObjectURL(blob)
    onSendMessage("图片", "image", { fileUrl: url })
    setSelectedImageSrc(null)
  }

  const handleCardSelect = () => {
    // Mock card selection
    onSendMessage("个人名片", "card", {
      cardInfo: {
        userId: "user_007",
        name: "詹姆斯·邦德",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=James",
        signature: "007 Agent"
      }
    })
    setShowMore(false)
  }

  return (
    <div className="flex flex-col border-t bg-background relative z-20">
      {editingMessage && (
        <div className="bg-muted/50 px-4 py-2 flex items-center justify-between border-b text-sm">
          <div className="flex items-center gap-2 text-muted-foreground truncate">
            <span className="font-medium text-primary">编辑:</span>
            <span className="truncate max-w-[200px]">{editingMessage.content}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted" onClick={() => {
              setMessage("")
              onCancelEdit?.()
          }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {replyingTo && !editingMessage && (
        <div className="bg-muted/50 px-4 py-2 flex items-center justify-between border-b text-sm">
          <div className="flex items-center gap-2 text-muted-foreground truncate">
            <span className="font-medium text-primary">回复:</span>
            <span className="truncate max-w-[200px]">{replyingTo.content}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted" onClick={onCancelReply}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Recording Overlay */}
      {isRecording && (
        <div className="fixed inset-0 bg-black/50 z-50 flex flex-col items-center justify-center text-white select-none">
           <div className="bg-primary p-8 rounded-full animate-pulse mb-4">
             <Mic className="h-12 w-12" />
           </div>
           <p className="text-lg font-medium">正在录音... {recordDuration}s</p>
           <p className="text-sm opacity-70 mt-2">松手发送，上滑取消</p>
        </div>
      )}

      <div className="flex items-end gap-2 p-3 pb-safe">
        <Button 
          variant="ghost" 
          size="icon" 
          className="shrink-0 text-muted-foreground mb-0.5" 
          onClick={() => setMode(mode === 'text' ? 'voice' : 'text')}
        >
          {mode === 'text' ? <Mic className="h-6 w-6" /> : <Keyboard className="h-6 w-6" />}
        </Button>
        
        <div className="flex-1 min-h-[40px] flex items-center">
          <Popover open={mentionOpen} onOpenChange={setMentionOpen}>
            <PopoverTrigger asChild>
                <span className="hidden">@</span>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-0" align="start" side="top">
                <div className="p-2 border-b text-xs font-medium text-muted-foreground">
                    选择提醒的人
                </div>
                <div className="max-h-48 overflow-y-auto">
                    {mentionUsers.map(user => (
                        <div 
                            key={user.id} 
                            className="flex items-center gap-2 p-2 hover:bg-muted/50 cursor-pointer text-sm"
                            onClick={() => handleMentionSelect(user)}
                        >
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] overflow-hidden">
                                {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : user.name[0]}
                            </div>
                            <span>{user.name}</span>
                        </div>
                    ))}
                    {mentionUsers.length === 0 && (
                        <div className="p-4 text-center text-xs text-muted-foreground">无成员</div>
                    )}
                </div>
            </PopoverContent>
          </Popover>

          {mode === 'text' ? (
            <Input
              ref={inputRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="发送消息..."
              className="border-none bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary/50 min-h-[40px] py-2"
            />
          ) : (
            <Button 
              className={cn("flex-1", isRecording && "bg-destructive text-destructive-foreground animate-pulse")}
              onMouseDown={startRecording}
              onMouseUp={handleStopRecording}
              onTouchStart={startRecording}
              onTouchEnd={handleStopRecording}
            >
              {isRecording ? `松开发送 (${recordDuration}s)` : "按住说话"}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1 mb-0.5">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground">
                <Smile className="h-6 w-6" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2" align="end" side="top">
              <div className="grid grid-cols-8 gap-1 h-48 overflow-y-auto">
                {emojis.map((emoji) => (
                  <button
                    key={emoji}
                    className="text-xl hover:bg-muted rounded p-1 transition-colors"
                    onClick={() => setMessage((prev) => prev + emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {message.trim() ? (
             <Button onClick={handleSend} size="icon" className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90">
               <Send className="h-4 w-4" />
             </Button>
          ) : (
            <Button 
              variant="ghost" 
              size="icon" 
              className={cn("shrink-0 text-muted-foreground", showMore && "bg-muted text-foreground")}
              onClick={() => setShowMore(!showMore)}
            >
              {showMore ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
            </Button>
          )}
        </div>
      </div>

      {/* More Panel */}
      {showMore && (
        <div className="grid grid-cols-4 gap-4 p-4 bg-muted/30 border-t animate-in slide-in-from-bottom-10 duration-200">
           <PanelItem icon={ImageIcon} label="相册" onClick={() => handleFileSelect('image')} />
           <PanelItem icon={Camera} label="拍摄" onClick={() => handleFileSelect('image')} />
           <PanelItem icon={FileText} label="文件" onClick={() => handleFileSelect('file')} />
           <PanelItem icon={UserIcon} label="名片" onClick={handleCardSelect} />
           <PanelItem icon={MapPin} label="位置" onClick={() => alert("位置功能待实现")} />
           <PanelItem icon={Scissors} label="截屏" onClick={() => {
              onScreenshot?.()
              setShowMore(false)
           }} />
        </div>
      )}

      {selectedImageSrc && (
        <ImageEditor 
          open={imageEditorOpen}
          onOpenChange={setImageEditorOpen}
          imageSrc={selectedImageSrc}
          onSave={handleEditorSave}
        />
      )}
    </div>
  )
})

function PanelItem({ icon: Icon, label, onClick }: { icon: any, label: string, onClick: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={onClick}>
      <div className="w-12 h-12 bg-background rounded-xl flex items-center justify-center border shadow-sm group-hover:bg-muted transition-colors">
         <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
