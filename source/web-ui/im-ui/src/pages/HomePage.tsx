import { Button } from "@/components/ui/button"

export default function HomePage() {
  return (
    <div className="container mx-auto p-4 space-y-4">
      <h1 className="text-3xl font-bold">Welcome to Enterprise IM</h1>
      <p className="text-muted-foreground">This is the dashboard/chat list.</p>
      <Button variant="default">New Chat</Button>
    </div>
  )
}
