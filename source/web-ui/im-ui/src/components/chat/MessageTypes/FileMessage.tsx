import { FileText, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"

interface FileMessageProps {
  name?: string
  size?: number
  url?: string
  isMe: boolean
}

function formatSize(bytes: number = 0) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export function FileMessage({ name = "未知文件", size = 0, url }: { name?: string, size?: number, url?: string, isMe: boolean }) {
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleDownload = () => {
     if (url) {
        setDownloading(true)
        let p = 0
        const interval = setInterval(() => {
          p += 10
          setProgress(p)
          if (p >= 100) {
            clearInterval(interval)
            setDownloading(false)
            
            const link = document.createElement('a')
            link.href = url
            link.download = name
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
          }
        }, 100)
     }
  }

  return (
    <div className={`flex items-center gap-3 p-1 min-w-[200px]`}>
       <div className={`p-3 rounded-lg bg-secondary/50`}>
          <FileText className="h-8 w-8" />
       </div>
       <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate max-w-[150px]">{name}</p>
          <div className="flex items-center gap-2">
            <p className="text-xs opacity-70">{formatSize(size)}</p>
            {downloading && <p className="text-xs text-primary">{progress}%</p>}
          </div>
       </div>
       {url && (
         <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
         </Button>
       )}
    </div>
  )
}
