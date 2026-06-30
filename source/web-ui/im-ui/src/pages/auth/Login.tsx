import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { MessageSquare, ShieldCheck, Smartphone } from "lucide-react"
import { useAuthStore } from "@/stores/useAuthStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  const [isLoading, setIsLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [loginMethod, setLoginMethod] = useState("phone") // phone or password
  
  const [formData, setFormData] = useState({
    phone: "",
    code: "",
    username: "",
    password: ""
  })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreed) {
      alert("请先阅读并同意服务协议")
      return
    }
    
    setIsLoading(true)
    // Simulate network request
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Mock login logic
    const success = true 
    
    if (success) {
      login({ 
        id: "user-1", 
        name: "当前用户", 
        avatar: "https://github.com/shadcn.png",
        status: "online" 
      })
      navigate("/")
    } else {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      {/* Header */}
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <MessageSquare className="h-8 w-8 fill-current" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">企业通信</h1>
          <p className="text-sm text-muted-foreground">安全 · 高效 · 智能</p>
        </div>

        <div className="w-full max-w-sm space-y-4">
          <Tabs defaultValue="phone" className="w-full" onValueChange={setLoginMethod}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="phone">手机号登录</TabsTrigger>
              <TabsTrigger value="password">密码登录</TabsTrigger>
            </TabsList>
            
            <form onSubmit={handleLogin} className="mt-4 space-y-4">
              <TabsContent value="phone" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">手机号</Label>
                  <div className="flex gap-2">
                    <Button variant="outline" type="button" className="w-[80px]">+86</Button>
                    <Input 
                      id="phone" 
                      placeholder="请输入手机号" 
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      required={loginMethod === 'phone'}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">验证码</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="code" 
                      placeholder="请输入验证码" 
                      value={formData.code}
                      onChange={(e) => setFormData({...formData, code: e.target.value})}
                      required={loginMethod === 'phone'}
                    />
                    <Button variant="outline" type="button" className="w-[100px]">获取验证码</Button>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="password" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">账号</Label>
                  <Input 
                    id="username" 
                    placeholder="请输入手机号/邮箱" 
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    required={loginMethod === 'password'}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">密码</Label>
                    <Button variant="link" className="h-auto p-0 text-xs text-muted-foreground" type="button">
                      忘记密码?
                    </Button>
                  </div>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="请输入密码" 
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    required={loginMethod === 'password'}
                  />
                </div>
              </TabsContent>

              <Button className="w-full mt-6" type="submit" disabled={isLoading}>
                {isLoading ? "登录中..." : "登录"}
              </Button>
            </form>
          </Tabs>

          <div className="flex items-center space-x-2">
            <Checkbox id="terms" checked={agreed} onCheckedChange={(checked: boolean) => setAgreed(checked)} />
            <label
              htmlFor="terms"
              className="text-xs text-muted-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              已阅读并同意 <span className="text-primary cursor-pointer">《用户协议》</span> 和 <span className="text-primary cursor-pointer">《隐私政策》</span>
            </label>
          </div>
          
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                其他登录方式
              </span>
            </div>
          </div>
          
          <div className="flex justify-center gap-4">
             <Button variant="outline" size="icon" className="rounded-full">
               <Smartphone className="h-4 w-4" />
             </Button>
             <Button variant="outline" size="icon" className="rounded-full">
               <ShieldCheck className="h-4 w-4" />
             </Button>
          </div>
        </div>
      </div>
      
      <div className="pb-8 text-center text-xs text-muted-foreground opacity-50">
        © 2024 IM 团队。保留所有权利。
      </div>
    </div>
  )
}
