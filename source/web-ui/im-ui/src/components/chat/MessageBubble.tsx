import { format } from "date-fns"
import {
  Check,
  CheckCheck,
  Flame,
  Copy,
  Forward,
  Star,
  Trash2,
  Undo2,
  Edit,
  ListChecks,
  Reply,
  AlertCircle,
  ThumbsUp
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Message, User } from "@/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { useState, useEffect, useRef } from "react"
import { VoiceMessage } from "./MessageTypes/VoiceMessage"
import { FileMessage } from "./MessageTypes/FileMessage"
import { CardMessage } from "./MessageTypes/CardMessage"

interface MessageBubbleProps {
  message: Message
  isMe: boolean
  sender?: User
  onPreviewImage?: (url: string) => void
  isMultiSelectMode?: boolean
  isSelected?: boolean
  onSelect?: (checked: boolean) => void
  onDelete?: () => void
  onRecall?: () => void
  onForward?: () => void
  onFavorite?: () => void
  onEnterMultiSelect?: () => void
  onReply?: () => void
  onEdit?: () => void
  onLike?: () => void
  onAvatarClick?: (userId: string) => void
  onReadStatusClick?: () => void
  quotedMessage?: Message
  isGroup?: boolean
  onResend?: () => void
}

export function MessageBubble({
  message,
  isMe,
  isGroup: propIsGroup,
  sender,
  onPreviewImage,
  isMultiSelectMode,
  isSelected,
  onSelect,
  onDelete,
  onRecall,
  onForward,
  onFavorite,
  onEnterMultiSelect,
  onReply,
  onEdit,
  onLike,
  onAvatarClick,
  onReadStatusClick,
  quotedMessage,
  onResend
}: MessageBubbleProps) {
  const isGroup = propIsGroup ?? message.sessionId.includes('group')
  const [isRevealed, setIsRevealed] = useState(false)
  const [isBurned, setIsBurned] = useState(false)
  const [burnCountdown, setBurnCountdown] = useState(10)
  const burnIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (burnIntervalRef.current) {
        clearInterval(burnIntervalRef.current)
      }
    }
  }, [])

  const isMessageBurned = message.isReadAfterBurn && isBurned

  if (message.type === 'system' || message.isRecall) {
    return (
      <div className="flex justify-center my-2 w-full">
        <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full select-none">
          {message.content}
        </span>
      </div>
    )
  }

  const handleReveal = () => {
    console.log('[阅后即焚] handleReveal called', { isMe, messageId: message.id, isRevealed, isBurned })
    if (message.isReadAfterBurn && !isRevealed && !isBurned && !isMe) {
      console.log('[阅后即焚] Starting countdown for message:', message.id)
      setIsRevealed(true)
      setBurnCountdown(10)

      burnIntervalRef.current = setInterval(() => {
        setBurnCountdown(prev => {
          console.log('[阅后即焚] Countdown:', prev - 1)
          if (prev <= 1) {
            if (burnIntervalRef.current) {
              clearInterval(burnIntervalRef.current)
              burnIntervalRef.current = null
            }
            console.log('[阅后即焚] Countdown finished, recalling message:', message.id)
            setIsBurned(true)
            onRecall?.()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
  }

  const handleCopy = () => {
    if (message.type === 'text' && !message.isReadAfterBurn) {
      navigator.clipboard.writeText(message.content)
    }
  }

  const renderQuote = () => {
    if (!quotedMessage) return null

    let content = quotedMessage.content
    if (quotedMessage.type === 'image') content = '[图片]'
    if (quotedMessage.type === 'voice') content = '[语音]'
    if (quotedMessage.type === 'file') content = '[文件]'
    if (quotedMessage.type === 'card') content = '[名片]'

    return (
      <div className="mb-2 rounded bg-muted/40 p-2 text-xs text-muted-foreground border-l-2 border-primary/50 select-none">
        <div className="font-medium mb-0.5 opacity-70">回复消息</div>
        <div className="line-clamp-2 italic">{content}</div>
      </div>
    )
  }

  const renderContent = () => {
    if (message.isReadAfterBurn) {
      if (isMessageBurned) {
        return (
          <div className="flex items-center gap-2 text-muted-foreground italic">
            <Flame className="h-4 w-4" /> 消息已焚毁
          </div>
        )
      }
      if (!isRevealed && !isMe) {
        return (
          <div className="flex items-center gap-2 cursor-pointer" onClick={handleReveal}>
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="text-orange-500 font-medium">点击查看 (阅后即焚)</span>
          </div>
        )
      }
      if (isRevealed && !isBurned && !isMe) {
        const textContent = message.type === 'text' ? message.content : `[${message.type === 'image' ? '图片' : message.type === 'voice' ? '语音' : message.type}]`
        return (
          <div className="relative">
            <p className="whitespace-pre-wrap break-words text-sm">{textContent}</p>
            <div className="absolute -top-1 -right-1 flex items-center gap-1 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              <Flame className="h-3 w-3" />
              <span>{burnCountdown}s</span>
            </div>
          </div>
        )
      }
    }

    switch (message.type) {
      case "text": {
        const formatText = (text: string) => {
          const urlRegex = /(https?:\/\/[^\s]+)/g
          const phoneRegex = /(1[3-9]\d{9})/g
          const mentionRegex = /(@[\u4e00-\u9fa5\w\-\.]+)/g

          const parts = text.split(urlRegex)

          return parts.map((part, index) => {
            if (part.match(urlRegex)) {
              return (
                <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all" onClick={(e) => e.stopPropagation()}>
                  {part}
                </a>
              )
            }

            const subParts = part.split(phoneRegex)
            return subParts.map((subPart, subIndex) => {
              if (subPart.match(phoneRegex)) {
                return (
                  <a key={`${index}-${subIndex}`} href={`tel:${subPart}`} className="text-blue-500 hover:underline" onClick={(e) => e.stopPropagation()}>
                    {subPart}
                  </a>
                )
              }

              const mentionParts = subPart.split(mentionRegex)
              return mentionParts.map((mPart, mIndex) => {
                if (mPart.match(mentionRegex)) {
                  return (
                    <span key={`${index}-${subIndex}-${mIndex}`} className="text-blue-500 cursor-pointer hover:underline" onClick={(e) => {
                      e.stopPropagation()
                    }}>
                      {mPart}
                    </span>
                  )
                }
                return mPart
              })
            })
          })
        }
        return <p className="whitespace-pre-wrap break-words text-sm">{formatText(message.content)}</p>
      }
      case "image":
        return (
          <div className="cursor-pointer overflow-hidden rounded-lg" onClick={() => onPreviewImage?.(message.fileUrl || "")}>
            <img
              src={message.fileUrl}
              alt="Image"
              className="max-h-64 max-w-full object-cover"
              loading="lazy"
            />
          </div>
        )
      case "voice":
        return <VoiceMessage duration={message.voiceDuration} isMe={isMe} />
      case "file":
        return <FileMessage name={message.fileName} size={message.fileSize} url={message.fileUrl} isMe={isMe} />
      case "card":
        return <CardMessage {...message.cardInfo!} />
      default:
        return <p className="text-sm">不支持的消息类型</p>
    }
  }

  return (
    <div
      className={cn(
        "flex w-full mb-4 gap-2 group relative",
        isMe ? "flex-row-reverse" : "flex-row",
        isSelected && "bg-muted/30 -mx-4 px-4 py-2"
      )}
    >
      {isMultiSelectMode && (
        <div className="flex items-center justify-center px-2">
          <Checkbox checked={isSelected} onCheckedChange={(c) => onSelect?.(!!c)} />
        </div>
      )}

      <Avatar
        className="h-9 w-9 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={(e) => {
          e.stopPropagation()
          onAvatarClick?.(sender?.id || "")
        }}
      >
        <AvatarImage src={sender?.avatar} alt={sender?.name} />
        <AvatarFallback>{sender?.name?.slice(0, 2)}</AvatarFallback>
      </Avatar>

      <div className={cn("flex max-w-[70%] flex-col", isMe ? "items-end" : "items-start")}>
        {!isMe && message.sessionId.includes('group') && (
          <span className="mb-1 ml-1 text-xs text-muted-foreground">{sender?.name}</span>
        )}

        <ContextMenu>
          <ContextMenuTrigger>
            <div
              className={cn(
                "relative rounded-2xl px-4 py-2.5 shadow-sm transition-all",
                isMe
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-white dark:bg-muted text-foreground rounded-tl-sm border",
                message.type === 'image' ? "p-1 bg-transparent border-0 shadow-none" : ""
              )}
            >
              {renderQuote()}
              {renderContent()}

              {(message.likes?.length || 0) > 0 && (
                <div className="flex items-center gap-1 mt-1 pt-1 border-t border-border/50">
                  <ThumbsUp className="h-3 w-3 text-primary fill-primary" />
                  <span className="text-[10px] text-muted-foreground">{message.likes?.length}</span>
                </div>
              )}

              {message.isReadAfterBurn && !isBurned && (
                <div className="absolute -top-1 -right-1">
                  <Flame className="h-3 w-3 text-orange-500 fill-orange-500" />
                </div>
              )}
            </div>
          </ContextMenuTrigger>

          <ContextMenuContent className="w-48">
            {message.type === 'text' && (
              <ContextMenuItem onClick={handleCopy}>
                <Copy className="mr-2 h-4 w-4" /> 复制
              </ContextMenuItem>
            )}
            <ContextMenuItem onClick={onReply}>
              <Reply className="mr-2 h-4 w-4" /> 引用
            </ContextMenuItem>
            <ContextMenuItem onClick={onForward}>
              <Forward className="mr-2 h-4 w-4" /> 转发
            </ContextMenuItem>
            <ContextMenuItem onClick={onFavorite}>
              <Star className="mr-2 h-4 w-4" /> 收藏
            </ContextMenuItem>
            {isMe && message.type === 'text' && (
              <ContextMenuItem onClick={onEdit}>
                <Edit className="mr-2 h-4 w-4" /> 编辑
              </ContextMenuItem>
            )}
            <ContextMenuItem onClick={onLike}>
              <ThumbsUp className="mr-2 h-4 w-4" /> 点赞
            </ContextMenuItem>
            <ContextMenuItem onClick={onEnterMultiSelect}>
              <ListChecks className="mr-2 h-4 w-4" /> 多选
            </ContextMenuItem>
            <ContextMenuSeparator />
            {isMe && Date.now() - message.timestamp < 3 * 60 * 1000 && (
              <ContextMenuItem onClick={onRecall} className="text-orange-500 focus:text-orange-500">
                <Undo2 className="mr-2 h-4 w-4" /> 撤回
              </ContextMenuItem>
            )}
            <ContextMenuItem onClick={onDelete} className="text-red-500 focus:text-red-500">
              <Trash2 className="mr-2 h-4 w-4" /> 删除
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        <div className={cn("mt-1 flex items-center gap-1 text-[10px] text-muted-foreground", isMe ? "justify-end" : "justify-start")}>
          {message.isEdited && <span className="text-[10px] text-muted-foreground/70">(已编辑)</span>}
          <span>{format(message.timestamp, "HH:mm")}</span>
          {isMe && !isGroup && (
            message.status === 'read' ? <CheckCheck className="h-3 w-3 text-primary" /> : <Check className="h-3 w-3" />
          )}
          {isMe && isGroup && (
            <span
              className={cn(
                "text-[10px] cursor-pointer hover:underline",
                (message.readBy?.length || 0) > 0 ? "text-primary" : "text-muted-foreground"
              )}
              onClick={(e) => {
                e.stopPropagation()
                onReadStatusClick?.()
              }}
            >
              {(message.readBy?.length || 0) > 0 ? `${message.readBy?.length}人已读` : "未读"}
            </span>
          )}
        </div>
      </div>

      {isMe && message.status === 'failed' && (
        <div
          className="flex items-center justify-center cursor-pointer text-destructive hover:bg-destructive/10 p-1 rounded-full transition-colors"
          title="发送失败，点击重发"
          onClick={(e) => {
            e.stopPropagation()
            if (confirm("确认重发此消息？")) {
              onResend?.()
            }
          }}
        >
          <AlertCircle className="h-5 w-5" />
        </div>
      )}
    </div>
  )
}