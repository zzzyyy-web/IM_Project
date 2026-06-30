import { useEffect, useMemo, useRef, useState } from "react"
import type { FormEvent, ReactNode } from "react"
import {
  blockUser,
  clearConversation,
  addGroupMembers,
  createGroup,
  createFriendRequest,
  createSocket,
  deleteFriend,
  editMessage,
  exitGroup,
  favoriteMessage,
  forwardMessage,
  getAdminMessages,
  getAdminOnlineUsers,
  getAdminOverview,
  getAdminUsers,
  getBlacklist,
  getCaptcha,
  getCompanySettings,
  getDraft,
  getFriendRequests,
  getFriends,
  getMessages,
  getGroups,
  getGroupMessages,
  getGroupReadMembers,
  getOrgTree,
  getSessions,
  getSettings,
  getUsers,
  login,
  markGroupRead,
  markMessagesRead,
  register,
  recallMessage,
  removeGroupMember,
  respondFriendRequest,
  searchIm,
  sendScreenshotNotice,
  saveDraft,
  transferGroupOwner,
  toggleMessageReaction,
  unblockUser,
  updateFriendRemark,
  updateGroup,
  updateGroupNickname,
  updateSessionSettings,
  updateSettings,
  updateUser,
  uploadAttachment,
  attachmentUrl,
  type Attachment,
  type AdminOverview,
  type CompanySettings,
  type DepartmentNode,
  type FriendRequest,
  type ImMessage,
  type ImGroup,
  type ImSession,
  type ImUser,
  type SearchResult,
  type UserSettings,
} from "@/lib/imClient"
import "./App.css"

type ViewMode = "sessions" | "friends" | "org" | "groups" | "requests" | "users" | "blacklist" | "profile" | "settings" | "admin"
type SocketStatus = "connecting" | "online" | "offline"

function App() {
  const [token, setToken] = useState(() => window.localStorage.getItem("im-token") || "")
  const [currentUser, setCurrentUser] = useState<ImUser | null>(() => {
    const cached = window.localStorage.getItem("im-current-user")
    const cachedToken = window.localStorage.getItem("im-token")
    return cached && cachedToken ? JSON.parse(cached) : null
  })

  useEffect(() => {
    document.documentElement.dataset.theme = window.localStorage.getItem("im-theme") || "system"
    document.documentElement.dataset.fontSize = window.localStorage.getItem("im-font-size") || "standard"
  }, [])

  function handleLogin(user: ImUser, nextToken: string) {
    window.localStorage.setItem("im-current-user", JSON.stringify(user))
    window.localStorage.setItem("im-token", nextToken)
    setCurrentUser(user)
    setToken(nextToken)
  }

  function handleLogout() {
    window.localStorage.removeItem("im-current-user")
    window.localStorage.removeItem("im-token")
    setCurrentUser(null)
    setToken("")
  }

  return currentUser ? (
    <Workspace
      currentUser={currentUser}
      token={token}
      onLogout={handleLogout}
      onUserUpdate={(user) => {
        window.localStorage.setItem("im-current-user", JSON.stringify(user))
        setCurrentUser(user)
      }}
    />
  ) : (
    <LoginPage onLogin={handleLogin} />
  )
}

function LoginPage({ onLogin }: { onLogin: (user: ImUser, token: string) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [captcha, setCaptcha] = useState("")
  const [captchaCode, setCaptchaCode] = useState("")
  const [captchaToken, setCaptchaToken] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function refreshCaptcha() {
    const item = await getCaptcha()
    setCaptchaCode(item.code)
    setCaptchaToken(item.captcha_token)
  }

  useEffect(() => {
    refreshCaptcha().catch(() => setCaptchaCode(""))
  }, [])

  function switchMode(nextMode: "login" | "register") {
    if (nextMode === mode) return
    setMode(nextMode)
    setUsername("")
    setPassword("")
    setCaptcha("")
    setError("")
    if (nextMode === "register") refreshCaptcha().catch(() => setCaptchaCode(""))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError("")
    try {
      const cleanUsername = username.trim()
      const result =
        mode === "login"
          ? await login(cleanUsername, password)
          : await register(cleanUsername, password, captcha.trim(), captchaToken)
      onLogin(result.user, result.token)
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败，请稍后重试")
      if (mode === "register") refreshCaptcha().catch(() => undefined)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand-mark">IM</div>
        <h1>{mode === "login" ? "登录" : "注册"}</h1>
        <p>密码要求：6-32 位，至少包含 1 个字母和 1 个数字。</p>
        <div className="auth-switch">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>登录</button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")}>注册</button>
        </div>
        <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="用户名" maxLength={32} autoFocus />
        <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="密码" type="password" maxLength={32} />
        {mode === "register" && (
          <div className="captcha-row">
            <input value={captcha} onChange={(event) => setCaptcha(event.target.value)} placeholder="验证码" maxLength={8} />
            <button type="button" onClick={refreshCaptcha} title="刷新验证码">{captchaCode || "--"}</button>
          </div>
        )}
        <button disabled={loading || !username.trim() || !password.trim() || (mode === "register" && !captcha.trim())}>
          {loading ? "提交中..." : mode === "login" ? "登录" : "创建账号"}
        </button>
        {error && <span className="form-error">{error}</span>}
      </form>
    </main>
  )
}

function Workspace({
  currentUser,
  token,
  onLogout,
  onUserUpdate,
}: {
  currentUser: ImUser
  token: string
  onLogout: () => void
  onUserUpdate: (user: ImUser) => void
}) {
  const [users, setUsers] = useState<ImUser[]>([])
  const [friends, setFriends] = useState<ImUser[]>([])
  const [blacklist, setBlacklist] = useState<ImUser[]>([])
  const [sessions, setSessions] = useState<ImSession[]>([])
  const [groups, setGroups] = useState<ImGroup[]>([])
  const [inbox, setInbox] = useState<FriendRequest[]>([])
  const [outbox, setOutbox] = useState<FriendRequest[]>([])
  const [company, setCompany] = useState<CompanySettings | null>(null)
  const [orgTree, setOrgTree] = useState<DepartmentNode[]>([])
  const [peer, setPeer] = useState("")
  const [messages, setMessages] = useState<ImMessage[]>([])
  const [content, setContent] = useState("")
  const [selectMode, setSelectMode] = useState(false)
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set())
  const [burnAfterRead, setBurnAfterRead] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(true)
  const [view, setView] = useState<ViewMode>("sessions")
  const [socketStatus, setSocketStatus] = useState<SocketStatus>("connecting")
  const [notice, setNotice] = useState("")
  const [sessionQuery, setSessionQuery] = useState("")
  const [globalQuery, setGlobalQuery] = useState("")
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [searchHistory, setSearchHistory] = useState<string[]>(() => JSON.parse(window.localStorage.getItem("im-search-history") || "[]"))
  const [activeSearchQuery, setActiveSearchQuery] = useState("")
  const [locatedMessageId, setLocatedMessageId] = useState("")
  const [typingPeer, setTypingPeer] = useState("")
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [uploading, setUploading] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const peerRef = useRef(peer)
  const typingTimerRef = useRef<number | null>(null)
  const lastTypingSentRef = useRef(0)

  const pendingInboxCount = inbox.filter((item) => item.status === "pending").length
  const activeSession = useMemo(() => sessions.find((item) => item.target_id === peer), [sessions, peer])
  const activeGroupId = peer.startsWith("group:") ? Number(peer.slice(6)) : 0
  const activeGroup = useMemo(() => groups.find((item) => item.id === activeGroupId) || null, [groups, activeGroupId])
  const isActiveGroupOwner = activeGroup?.owner === currentUser.username
  const activeFriend = useMemo(() => friends.find((item) => item.username === peer), [friends, peer])
  const activeUser = useMemo(() => activeFriend || users.find((item) => item.username === peer) || null, [activeFriend, users, peer])
  const friendNames = useMemo(() => new Set(friends.map((item) => item.username)), [friends])
  const pendingOutboxNames = useMemo(
    () => new Set(outbox.filter((item) => item.status === "pending").map((item) => item.to_user)),
    [outbox],
  )
  const totalUnread = useMemo(() => sessions.reduce((sum, item) => sum + item.unread_count, 0), [sessions])
  const activeHistoryFiles = useMemo(() => uniqueAttachments(messages.flatMap((message) => message.attachments || [])), [messages])
  const activeCommonGroups = useMemo(
    () => activeUser ? groups.filter((group) => group.members.some((member) => member.username === activeUser.username)) : [],
    [activeUser, groups],
  )
  const filteredSessions = useMemo(() => {
    const query = sessionQuery.trim().toLowerCase()
    if (!query) return sessions
    return sessions.filter((session) => {
      const last = session.last_message?.content || ""
      return `${displayName(session)} ${last}`.toLowerCase().includes(query)
    })
  }, [sessions, sessionQuery])

  useEffect(() => {
    refreshAll()
    const timer = window.setInterval(refreshAll, 5000)
    return () => window.clearInterval(timer)
  }, [currentUser.username])

  useEffect(() => {
    peerRef.current = peer
    setSelectedMessageIds(new Set())
    setSelectMode(false)
    setDetailsOpen(true)
  }, [peer])

  useEffect(() => {
    const socket = createSocket(currentUser.username, token)
    socketRef.current = socket
    setSocketStatus("connecting")
    socket.onopen = () => socketRef.current === socket && setSocketStatus("online")
    socket.onclose = () => socketRef.current === socket && setSocketStatus("offline")
    socket.onerror = () => socketRef.current === socket && setSocketStatus("offline")
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data) as ImMessage | { type: string; message?: string }
      if ("message" in data && data.type === "error") {
        setNotice(data.message || "消息发送失败")
        return
      }
      if (data.type === "friend_request") {
        refreshAll()
        setView("requests")
        setNotice("收到新的好友申请")
        return
      }
      if (data.type === "typing") {
        const event = data as { type: string; sender?: string }
        if (event.sender && event.sender === peerRef.current) {
          setTypingPeer(event.sender)
          if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current)
          typingTimerRef.current = window.setTimeout(() => setTypingPeer(""), 8000)
        }
        return
      }
      if (data.type === "message_update" || data.type === "message_recall") {
        const message = data as ImMessage
        setMessages((items) => items.map((item) => (item.id === message.id ? message : item)))
        refreshSessions()
        return
      }
      if (data.type === "message_reaction") {
        const message = data as ImMessage
        setMessages((items) => items.map((item) => (item.id === message.id ? message : item)))
        return
      }
      if (data.type === "screenshot_notice") {
        const notice = data as { reporter?: string }
        setNotice(`${notice.reporter || "对方"} 触发了截屏通知`)
        return
      }
      if (socketRef.current !== socket || (data.type !== "chat" && data.type !== "ack" && data.type !== "group_chat")) return
      const message = data as ImMessage
      refreshSessions()
      const currentPeer = peerRef.current
      const belongs =
        (message.group_id && currentPeer === `group:${message.group_id}`) ||
        (message.sender === currentUser.username && message.receiver === currentPeer) ||
        (message.sender === currentPeer && message.receiver === currentUser.username)
      if (!belongs) return
      setMessages((items) => (items.some((item) => item.id === message.id) ? items : [...items, message]))
    }
    return () => {
      if (socketRef.current === socket) socketRef.current = null
      socket.close()
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current)
    }
  }, [currentUser.username, token])

  useEffect(() => {
    if (!peer) {
      setMessages([])
      setContent("")
      return
    }
    getDraft(token, peer).then((draft) => {
      if (peerRef.current === peer && draft.content) setContent(draft.content)
    }).catch(() => undefined)
    if (peer.startsWith("group:")) {
      getGroupMessages(token, Number(peer.slice(6)))
        .then((items) => {
          setMessages(items)
          setTypingPeer("")
          if (items.length) return markGroupRead(token, Number(peer.slice(6)), items[items.length - 1].id)
          return undefined
        })
        .catch(() => setMessages([]))
      return
    }
    getMessages(token, currentUser.username, peer)
      .then((items) => {
        setMessages(items)
        setTypingPeer("")
        return markMessagesRead(token, currentUser.username, peer)
      })
      .then(refreshSessions)
      .catch(() => setMessages([]))
  }, [currentUser.username, peer, token])

  useEffect(() => {
    if (!peer) return
    const timer = window.setTimeout(() => {
      saveDraft(token, peer, content).catch(() => undefined)
    }, 800)
    return () => window.clearTimeout(timer)
  }, [content, peer, token])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function refreshAll() {
    try {
      const [nextUsers, nextFriends, nextBlacklist, nextSessions, nextGroups, nextInbox, nextOutbox, nextCompany, nextOrgTree] = await Promise.all([
        getUsers(token),
        getFriends(token, currentUser.username),
        getBlacklist(token, currentUser.username),
        getSessions(token, currentUser.username),
        getGroups(token),
        getFriendRequests(token, currentUser.username, "inbox"),
        getFriendRequests(token, currentUser.username, "outbox"),
        getCompanySettings(token),
        getOrgTree(token),
      ])
      setUsers(nextUsers)
      setFriends(nextFriends)
      setBlacklist(nextBlacklist)
      setSessions(nextSessions)
      setGroups(nextGroups)
      setInbox(nextInbox)
      setOutbox(nextOutbox)
      setCompany(nextCompany)
      setOrgTree(nextOrgTree)
    } catch {
      setNotice("数据刷新失败，请检查后端服务")
    }
  }

  async function refreshSessions() {
    setSessions(await getSessions(token, currentUser.username))
  }

  async function loadOlderMessages() {
    if (!peer || messages.length === 0 || loadingOlder) return
    setLoadingOlder(true)
    try {
      const older = peer.startsWith("group:")
        ? await getGroupMessages(token, Number(peer.slice(6)), messages[0].id, 30)
        : await getMessages(token, currentUser.username, peer, messages[0].id, 30)
      setMessages((items) => [...older.filter((item) => !items.some((old) => old.id === item.id)), ...items])
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "加载历史消息失败")
    } finally {
      setLoadingOlder(false)
    }
  }

  async function runGlobalSearch(event: FormEvent) {
    event.preventDefault()
    const query = globalQuery.trim()
    if (!query) {
      setSearchResult(null)
      setActiveSearchQuery("")
      return
    }
    try {
      setSearchResult(await searchIm(token, currentUser.username, query))
      setActiveSearchQuery(query)
      const nextHistory = [query, ...searchHistory.filter((item) => item !== query)].slice(0, 8)
      setSearchHistory(nextHistory)
      window.localStorage.setItem("im-search-history", JSON.stringify(nextHistory))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "搜索失败")
    }
  }

  function selectPeer(username: string) {
    setPeer(username)
    setView("sessions")
  }

  function selectGroup(groupId: number) {
    setPeer(`group:${groupId}`)
    setView("groups")
  }

  function locateSearchMessage(message: ImMessage) {
    const target = message.conversation_id?.startsWith("group:")
      ? message.conversation_id
      : message.sender === currentUser.username
        ? message.receiver
        : message.sender
    setPeer(target)
    setView(target.startsWith("group:") ? "groups" : "sessions")
    setLocatedMessageId(message.id)
    window.setTimeout(() => {
      document.getElementById(`message-${message.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 400)
  }

  async function handleCreateGroup() {
    const name = window.prompt("请输入群名称", "新群聊")
    if (!name?.trim()) return
    const raw = window.prompt("请输入成员用户名，多个用英文逗号分隔", friends.slice(0, 2).map((item) => item.username).join(","))
    const memberUsernames = (raw || "").split(",").map((item) => item.trim()).filter(Boolean)
    try {
      const group = await createGroup(token, { name: name.trim(), member_usernames: memberUsernames })
      setNotice("群聊已创建")
      await refreshAll()
      selectGroup(group.id)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "创建群聊失败")
    }
  }

  async function handleAddGroupMembers() {
    if (!activeGroup) return
    const raw = window.prompt("请输入要添加的用户名，多个用英文逗号分隔", "")
    const usernames = (raw || "").split(",").map((item) => item.trim()).filter(Boolean)
    if (!usernames.length) return
    try {
      await addGroupMembers(token, activeGroup.id, usernames)
      setNotice("群成员已添加")
      await refreshAll()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "添加群成员失败")
    }
  }

  async function handleUpdateGroupName() {
    if (!activeGroup) return
    const name = window.prompt("请输入新的群名称", activeGroup.name)
    if (name === null || !name.trim()) return
    try {
      await updateGroup(token, activeGroup.id, { name: name.trim() })
      setNotice("群名称已更新")
      await refreshAll()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "群名称更新失败")
    }
  }

  async function handleUpdateGroupAnnouncement() {
    if (!activeGroup) return
    const announcement = window.prompt("请输入群公告", activeGroup.announcement || "")
    if (announcement === null) return
    try {
      await updateGroup(token, activeGroup.id, { announcement: announcement.trim() })
      setNotice("群公告已更新")
      await refreshAll()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "群公告更新失败")
    }
  }

  async function handleUpdateGroupNickname() {
    if (!activeGroup) return
    const me = activeGroup.members.find((item) => item.username === currentUser.username)
    const nickname = window.prompt("请输入你的群内昵称", me?.group_nickname || currentUser.name || currentUser.username)
    if (nickname === null) return
    try {
      await updateGroupNickname(token, activeGroup.id, nickname.trim())
      setNotice("群昵称已更新")
      await refreshAll()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "群昵称更新失败")
    }
  }

  async function handleRemoveGroupMember() {
    if (!activeGroup) return
    const username = window.prompt("请输入要移除的成员用户名", "")
    if (!username?.trim()) return
    try {
      await removeGroupMember(token, activeGroup.id, username.trim())
      setNotice("群成员已移除")
      await refreshAll()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "移除群成员失败")
    }
  }

  async function handleTransferGroupOwner() {
    if (!activeGroup) return
    const username = window.prompt("请输入新群主用户名", "")
    if (!username?.trim()) return
    try {
      await transferGroupOwner(token, activeGroup.id, username.trim())
      setNotice("群主已转让")
      await refreshAll()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "转让群主失败")
    }
  }

  function handleMentionMember() {
    if (!activeGroup) return
    const username = window.prompt("请输入要 @ 的成员用户名", "")
    if (!username?.trim()) return
    setContent((value) => `${value}${value ? " " : ""}@${username.trim()} `)
  }

  async function handleExitGroup() {
    if (!activeGroup || !window.confirm(`确认退出群聊“${activeGroup.name}”？`)) return
    try {
      await exitGroup(token, activeGroup.id)
      setPeer("")
      setMessages([])
      setNotice("已退出群聊")
      await refreshAll()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "退出群聊失败")
    }
  }

  async function sendFriendRequest(toUser: string) {
    try {
      await createFriendRequest(token, currentUser.username, toUser, `我是 ${safeDisplayName(currentUser)}`)
      setNotice("好友申请已发送")
      await refreshAll()
      setView("requests")
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "好友申请发送失败")
    }
  }

  async function handleRequest(id: number, action: "accept" | "reject") {
    const remark = action === "accept" ? window.prompt("设置好友备注，可留空", "") || "" : ""
    try {
      await respondFriendRequest(token, id, action, remark)
      setNotice(action === "accept" ? "已通过好友申请" : "已拒绝好友申请")
      await refreshAll()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "处理好友申请失败")
    }
  }

  async function handleUpdateRemark() {
    if (!peer) return
    const remark = window.prompt("请输入新的好友备注", activeFriend?.remark || activeFriend?.name || "")
    if (remark === null) return
    await updateFriendRemark(token, currentUser.username, peer, remark.trim())
    await refreshAll()
  }

  async function handleDeleteFriend() {
    if (!peer || !window.confirm("确认删除该好友？")) return
    await deleteFriend(token, currentUser.username, peer)
    setPeer("")
    setMessages([])
    await refreshAll()
  }

  async function handleToggleBlacklist() {
    if (!peer) return
    if (activeFriend?.is_blocked) {
      await unblockUser(token, currentUser.username, peer)
      setNotice("已解除黑名单")
    } else {
      const reason = window.prompt("请输入拉黑原因，可留空", "") || ""
      await blockUser(token, currentUser.username, peer, reason)
      setNotice("已加入黑名单")
    }
    await refreshAll()
  }

  async function toggleSession(key: "pinned" | "muted") {
    if (!activeSession) return
    const nextValue = key === "pinned" ? !activeSession.is_pinned : !activeSession.is_muted
    await updateSessionSettings(token, currentUser.username, activeSession.target_id, { [key]: nextValue })
    await refreshSessions()
  }

  async function handleClearConversation() {
    if (!peer || !window.confirm("确认清空当前会话记录？")) return
    await clearConversation(token, currentUser.username, peer)
    setMessages([])
    await refreshSessions()
  }

  function handleSend(event: FormEvent) {
    event.preventDefault()
    const text = content.trim()
    if (!text || !peer || socketRef.current?.readyState !== WebSocket.OPEN) return
    if (peer.startsWith("group:")) {
      socketRef.current.send(JSON.stringify({ type: "group_chat", group_id: Number(peer.slice(6)), content: text, msg_type: "text" }))
    } else {
      socketRef.current.send(JSON.stringify({ type: "chat", receiver: peer, content: text, msg_type: "text", burn_after_read: burnAfterRead }))
    }
    setContent("")
    saveDraft(token, peer, "").catch(() => undefined)
  }

  async function handleAttachmentFiles(files: FileList | null, forcedType?: "image" | "file" | "audio") {
    if (!files || !peer || socketRef.current?.readyState !== WebSocket.OPEN) return
    const selected = Array.from(files).slice(0, forcedType === "image" ? 9 : 1)
    if (selected.length === 0) return
    setUploading(true)
    try {
      const uploaded = await Promise.all(selected.map((file) => uploadAttachment(token, file)))
      const msgType = forcedType || uploaded[0].category
      const title = uploaded.length === 1 ? uploaded[0].original_name : `${uploaded.length} 张图片`
      socketRef.current.send(JSON.stringify(peer.startsWith("group:")
        ? {
            type: "group_chat",
            group_id: Number(peer.slice(6)),
            content: title,
            msg_type: msgType,
            attachment_ids: uploaded.map((item) => item.id),
          }
        : {
            type: "chat",
            receiver: peer,
            content: title,
            msg_type: msgType,
            attachment_ids: uploaded.map((item) => item.id),
          }))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "附件上传失败")
    } finally {
      setUploading(false)
    }
  }

  function handleContentChange(value: string) {
    setContent(value)
    if (!peer || socketRef.current?.readyState !== WebSocket.OPEN) return
    const now = Date.now()
    if (now - lastTypingSentRef.current < 2000) return
    lastTypingSentRef.current = now
    socketRef.current.send(JSON.stringify({ type: "typing", receiver: peer }))
  }

  async function handleEditMessage(message: ImMessage) {
    if (message.recalled_at) return
    const next = window.prompt("编辑消息内容", message.content)
    if (next === null) return
    const content = next.trim()
    if (!content) {
      setNotice("消息内容不能为空")
      return
    }
    try {
      const updated = await editMessage(token, message.id, content)
      setMessages((items) => items.map((item) => (item.id === updated.id ? updated : item)))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "编辑消息失败")
    }
  }

  async function handleRecallMessage(message: ImMessage) {
    if (!window.confirm("确认撤回这条消息？")) return
    try {
      const updated = await recallMessage(token, message.id)
      setMessages((items) => items.map((item) => (item.id === updated.id ? updated : item)))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "撤回消息失败")
    }
  }

  function toggleMessageSelection(messageId: string) {
    setSelectedMessageIds((current) => {
      const next = new Set(current)
      if (next.has(messageId)) next.delete(messageId)
      else next.add(messageId)
      return next
    })
  }

  async function handleFavoriteMessage(message: ImMessage) {
    try {
      await favoriteMessage(token, message.id)
      setNotice("消息已收藏")
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "收藏消息失败")
    }
  }

  async function handleReactMessage(message: ImMessage) {
    try {
      const result = await toggleMessageReaction(token, message.id, "👍")
      setMessages((items) => items.map((item) => (item.id === result.message.id ? result.message : item)))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "消息点赞失败")
    }
  }

  async function handleReadMembers(message: ImMessage) {
    if (!message.group_id) return
    try {
      const result = await getGroupReadMembers(token, message.group_id, message.id)
      const read = result.read.map((item) => displayName(item)).join("、") || "暂无"
      const unread = result.unread.map((item) => displayName(item)).join("、") || "暂无"
      window.alert(`已读成员：${read}\n\n未读成员：${unread}`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "读取成员列表失败")
    }
  }

  async function handleScreenshotNotice() {
    if (!peer) return
    try {
      await sendScreenshotNotice(token, peer, peer.startsWith("group:") ? "" : peer)
      setNotice("截屏通知已发送")
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "截屏通知发送失败")
    }
  }

  async function handleForwardMessages(sourceMessages: ImMessage[]) {
    const raw = window.prompt("请输入转发目标用户名，多个用英文逗号分隔", "")
    const targets = (raw || "").split(",").map((item) => item.trim()).filter(Boolean)
    if (!targets.length) return
    try {
      for (const message of sourceMessages) {
        await forwardMessage(token, message.id, targets)
      }
      setNotice(`已转发 ${sourceMessages.length} 条消息`)
      setSelectedMessageIds(new Set())
      setSelectMode(false)
      await refreshSessions()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "转发消息失败")
    }
  }

  function handleForwardSelected() {
    const selected = messages.filter((message) => selectedMessageIds.has(message.id) && !message.recalled_at)
    if (!selected.length) {
      setNotice("请先选择要转发的消息")
      return
    }
    handleForwardMessages(selected)
  }

  function handleSendContactCard() {
    if (!peer || socketRef.current?.readyState !== WebSocket.OPEN) return
    const username = window.prompt("请输入要发送的名片用户名", currentUser.username)
    if (!username?.trim()) return
    const user = users.find((item) => item.username === username.trim()) || friends.find((item) => item.username === username.trim())
    const card = JSON.stringify({
      username: username.trim(),
      name: user?.name || username.trim(),
      avatar: user?.avatar || "",
      signature: user?.signature || "",
    })
    if (peer.startsWith("group:")) {
      socketRef.current.send(JSON.stringify({ type: "group_chat", group_id: Number(peer.slice(6)), content: card, msg_type: "card" }))
    } else {
      socketRef.current.send(JSON.stringify({ type: "chat", receiver: peer, content: card, msg_type: "card" }))
    }
  }

  return (
    <main className="im-shell">
      <aside className="side-panel">
        <header className="user-header">
          <div className="user-title">
            <img src={currentUser.avatar} alt="" />
            <div>
              <strong title={safeDisplayName(currentUser)}>{safeDisplayName(currentUser)}</strong>
              <span className={`status-dot ${socketStatus}`}>{socketStatusLabel(socketStatus)}</span>
            </div>
          </div>
          <button className="ghost-button" onClick={onLogout}>退出</button>
        </header>

        <form className="global-search" onSubmit={runGlobalSearch}>
          <input value={globalQuery} onChange={(event) => setGlobalQuery(event.target.value)} placeholder="搜索部门、成员、联系人、聊天记录" />
          <button>搜索</button>
        </form>
        {!searchResult && searchHistory.length > 0 && (
          <div className="search-history">
            <span>历史搜索</span>
            {searchHistory.map((item) => <button key={item} onClick={() => setGlobalQuery(item)}>{item}</button>)}
          </div>
        )}
        {searchResult && (
          <SearchSummary
            result={searchResult}
            query={activeSearchQuery}
            currentUser={currentUser.username}
            onSelectPeer={selectPeer}
            onLocateMessage={locateSearchMessage}
          />
        )}

        <nav className="mode-tabs">
          <button className={view === "sessions" ? "active" : ""} onClick={() => setView("sessions")}>
            消息 {totalUnread > 0 ? unreadText(totalUnread) : ""}
          </button>
          <button className={view === "friends" ? "active" : ""} onClick={() => setView("friends")}>联系人</button>
          <button className={view === "groups" ? "active" : ""} onClick={() => setView("groups")}>群聊</button>
          <button className={view === "org" ? "active" : ""} onClick={() => setView("org")}>组织架构</button>
          <button className={view === "requests" ? "active" : ""} onClick={() => setView("requests")}>
            好友申请 {pendingInboxCount ? unreadText(pendingInboxCount) : ""}
          </button>
          <button className={view === "users" ? "active" : ""} onClick={() => setView("users")}>用户</button>
          <button className={view === "blacklist" ? "active" : ""} onClick={() => setView("blacklist")}>黑名单</button>
          <button className={view === "profile" ? "active" : ""} onClick={() => setView("profile")}>我的</button>
          <button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}>设置</button>
          {currentUser.role === "admin" && <button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}>后台</button>}
        </nav>

        {notice && <p className="notice">{notice}</p>}
        <SidebarContent
          view={view}
          currentUser={currentUser}
          sessions={filteredSessions}
          friends={friends}
          groups={groups}
          company={company}
          orgTree={orgTree}
          users={users.filter((user) => user.username !== currentUser.username)}
          inbox={inbox}
          outbox={outbox}
          blacklist={blacklist}
          friendNames={friendNames}
          pendingOutboxNames={pendingOutboxNames}
          activePeer={peer}
          query={sessionQuery}
          onQueryChange={setSessionQuery}
          onRefresh={refreshAll}
          onSelectPeer={selectPeer}
          onSelectGroup={selectGroup}
          onCreateGroup={handleCreateGroup}
          onSendFriendRequest={sendFriendRequest}
          onRequestAction={handleRequest}
          onUnblock={async (username) => {
            await unblockUser(token, currentUser.username, username)
            await refreshAll()
          }}
        />
      </aside>

      {view === "admin" ? (
        <AdminPanel token={token} />
      ) : view === "profile" ? (
        <ProfilePanel currentUser={currentUser} token={token} onUserUpdate={onUserUpdate} />
      ) : view === "settings" ? (
        <SettingsPanel token={token} onLogout={onLogout} />
      ) : (
        <section className="chat-panel">
          <header className="chat-header">
            <div className="chat-title">
              <h2 title={activeGroup?.name || activeSession?.name || activeUser?.name || peer}>
                {activeGroup?.name || activeSession?.name || activeUser?.name || (peer ? `和 ${maskUsername(peer)} 聊天` : "选择一个会话开始聊天")}
              </h2>
              {activeGroup && <p>{activeGroup.members.length} 位成员 · {activeGroup.announcement || "暂无群公告"}</p>}
              {activeSession && (
                <p>
                  {typingPeer ? "对方正在输入..." : `${activeSession.is_pinned ? "已置顶" : "未置顶"} · ${activeSession.is_muted ? "免打扰" : "通知开启"}`}
                </p>
              )}
            </div>
            {activeGroup ? (
              <div className="chat-actions">
                <button className="ghost-button" onClick={() => setDetailsOpen((value) => !value)}>{detailsOpen ? "收起设置" : "群设置"}</button>
                <button className="ghost-button" onClick={handleMentionMember}>@成员</button>
                <button className="ghost-button" onClick={handleScreenshotNotice}>截屏通知</button>
              </div>
            ) : activeSession && (
              <div className="chat-actions">
                <button className="ghost-button" onClick={() => setDetailsOpen((value) => !value)}>{detailsOpen ? "收起资料" : "查看资料"}</button>
                <button className="ghost-button" onClick={() => toggleSession("pinned")}>{activeSession.is_pinned ? "取消置顶" : "置顶"}</button>
                <button className="ghost-button" onClick={() => toggleSession("muted")}>{activeSession.is_muted ? "开启通知" : "免打扰"}</button>
                <button className="ghost-button" onClick={handleScreenshotNotice}>截屏通知</button>
                <button className="danger-button" onClick={handleClearConversation}>清空</button>
              </div>
            )}
          </header>

          <div className="message-tools">
            <button className="ghost-button" onClick={() => setSelectMode((value) => !value)}>{selectMode ? "取消选择" : "批量选择"}</button>
            <button className="ghost-button" disabled={!selectedMessageIds.size} onClick={handleForwardSelected}>转发选中</button>
            <button className="ghost-button" onClick={handleSendContactCard}>发送名片</button>
            {!activeGroup && (
              <label className="burn-toggle">
                <input type="checkbox" checked={burnAfterRead} onChange={(event) => setBurnAfterRead(event.target.checked)} />
                阅后即焚
              </label>
            )}
          </div>

          <div className="message-list">
            {messages.length > 0 && (
              <button className="load-older" onClick={loadOlderMessages} disabled={loadingOlder}>
                {loadingOlder ? "加载中..." : "查看更早消息"}
              </button>
            )}
            {activeUser && !activeGroup && (
              detailsOpen ? (
                <FriendDetailPanel
                  user={activeUser}
                  isFriend={friendNames.has(activeUser.username)}
                  isPending={pendingOutboxNames.has(activeUser.username)}
                  commonGroups={activeCommonGroups}
                  files={activeHistoryFiles}
                  onSendFriendRequest={sendFriendRequest}
                  onMessage={selectPeer}
                  onUpdateRemark={handleUpdateRemark}
                  onToggleBlacklist={handleToggleBlacklist}
                  onDeleteFriend={handleDeleteFriend}
                  onSelectGroup={selectGroup}
                />
              ) : (
                <UserProfileCard
                  user={activeUser}
                  isFriend={friendNames.has(activeUser.username)}
                  isPending={pendingOutboxNames.has(activeUser.username)}
                  onSendFriendRequest={sendFriendRequest}
                  onMessage={selectPeer}
                  onUpdateRemark={handleUpdateRemark}
                />
              )
            )}
            {activeGroup && detailsOpen && (
              <GroupSettingsPanel
                group={activeGroup}
                currentUser={currentUser}
                files={activeHistoryFiles}
                isOwner={isActiveGroupOwner}
                onUpdateName={handleUpdateGroupName}
                onUpdateAnnouncement={handleUpdateGroupAnnouncement}
                onUpdateNickname={handleUpdateGroupNickname}
                onAddMembers={handleAddGroupMembers}
                onRemoveMember={handleRemoveGroupMember}
                onTransferOwner={handleTransferGroupOwner}
                onExitGroup={handleExitGroup}
                onSelectPeer={selectPeer}
              />
            )}
            {messages.length === 0 && <div className="empty-chat">{peer ? "暂无消息" : "请先从左侧选择好友、会话或群聊"}</div>}
            {messages.map((message) => {
              const isMine = message.sender === currentUser.username
              return (
                <article id={`message-${message.id}`} key={message.id} className={`${isMine ? "message mine" : "message"} ${locatedMessageId === message.id ? "located" : ""}`}>
                  {selectMode && (
                    <label className="message-select">
                      <input type="checkbox" checked={selectedMessageIds.has(message.id)} onChange={() => toggleMessageSelection(message.id)} />
                    </label>
                  )}
                  <div className="bubble" onDoubleClick={() => navigator.clipboard?.writeText(message.content)}>
                    {activeGroup && <strong className="message-sender">{groupMemberDisplayName(activeGroup, message.sender)}</strong>}
                    <MessageContent message={message} query={activeSearchQuery} onSelectPeer={selectPeer} />
                    {!message.recalled_at && <AttachmentPreview attachments={message.attachments || []} />}
                    <footer>
                      <time>{formatDateTime(message.created_at)}</time>
                      {message.burn_after_read && !message.burned_at && <span>阅后即焚</span>}
                      {message.burned_at && <span>已焚毁</span>}
                      {message.edited_at && !message.recalled_at && <span>已编辑</span>}
                      {activeGroup && isMine && !message.recalled_at && <button onClick={() => handleReadMembers(message)}>已读 {message.read_count ?? 0} / 未读 {message.unread_count ?? 0}</button>}
                      {(message.reactions || []).map((reaction) => (
                        <button key={reaction.emoji} className="reaction-chip" title={reaction.users.join("、")} onClick={() => handleReactMessage(message)}>
                          {reaction.emoji} {reaction.count}
                        </button>
                      ))}
                      {isMine && <span>{message.recalled_at ? "已撤回" : message.read_at ? "已读" : message.delivered ? "已发送" : "已保存"}</span>}
                      {!message.recalled_at && <button onClick={() => navigator.clipboard?.writeText(message.content)}>复制</button>}
                      {!message.recalled_at && <button onClick={() => handleReactMessage(message)}>点赞</button>}
                      {!message.recalled_at && <button onClick={() => handleFavoriteMessage(message)}>收藏</button>}
                      {!message.recalled_at && <button onClick={() => handleForwardMessages([message])}>转发</button>}
                      {isMine && !message.recalled_at && <button onClick={() => handleEditMessage(message)}>编辑</button>}
                      {isMine && !message.recalled_at && <button onClick={() => handleRecallMessage(message)}>撤回</button>}
                    </footer>
                  </div>
                </article>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {messages.length > 6 && <button className="back-bottom" onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}>回到底部</button>}

          <form className="composer" onSubmit={handleSend}>
            <label className="upload-button">
              图片
              <input type="file" accept="image/*" multiple onChange={(event) => handleAttachmentFiles(event.target.files, "image")} />
            </label>
            <label className="upload-button">
              文件
              <input type="file" onChange={(event) => handleAttachmentFiles(event.target.files, "file")} />
            </label>
            <label className="upload-button">
              语音
              <input type="file" accept="audio/*" onChange={(event) => handleAttachmentFiles(event.target.files, "audio")} />
            </label>
            <input
              value={content}
              onChange={(event) => handleContentChange(event.target.value)}
              placeholder={peer ? "输入消息，按 Enter 发送" : "请先选择联系人"}
              disabled={!peer || socketStatus !== "online"}
              maxLength={2000}
            />
            <button disabled={!peer || !content.trim() || socketStatus !== "online" || uploading}>{uploading ? "上传中" : "发送"}</button>
          </form>
        </section>
      )}
    </main>
  )
}

function SidebarContent({
  view,
  currentUser,
  sessions,
  friends,
  groups,
  company,
  orgTree,
  users,
  inbox,
  outbox,
  blacklist,
  friendNames,
  pendingOutboxNames,
  activePeer,
  query,
  onQueryChange,
  onRefresh,
  onSelectPeer,
  onSelectGroup,
  onCreateGroup,
  onSendFriendRequest,
  onRequestAction,
  onUnblock,
}: {
  view: ViewMode
  currentUser: ImUser
  sessions: ImSession[]
  friends: ImUser[]
  groups: ImGroup[]
  company: CompanySettings | null
  orgTree: DepartmentNode[]
  users: ImUser[]
  inbox: FriendRequest[]
  outbox: FriendRequest[]
  blacklist: ImUser[]
  friendNames: Set<string>
  pendingOutboxNames: Set<string>
  activePeer: string
  query: string
  onQueryChange: (value: string) => void
  onRefresh: () => void
  onSelectPeer: (username: string) => void
  onSelectGroup: (groupId: number) => void
  onCreateGroup: () => void
  onSendFriendRequest: (username: string) => void
  onRequestAction: (id: number, action: "accept" | "reject") => void
  onUnblock: (username: string) => void
}) {
  const [activeDepartmentId, setActiveDepartmentId] = useState<number | null>(currentUser.department_id || null)
  const [recentDepartmentIds, setRecentDepartmentIds] = useState<number[]>([])
  const flatDepartments = useMemo(() => flattenDepartments(orgTree), [orgTree])
  const activeDepartment = useMemo(
    () => flatDepartments.find((department) => department.id === activeDepartmentId) || null,
    [activeDepartmentId, flatDepartments],
  )
  const myDepartment = useMemo(
    () => flatDepartments.find((department) => department.id === currentUser.department_id) || null,
    [currentUser.department_id, flatDepartments],
  )
  const departmentBreadcrumb = useMemo(
    () => (activeDepartmentId ? findDepartmentPath(orgTree, activeDepartmentId).map((item) => item.name) : []),
    [activeDepartmentId, orgTree],
  )
  const recentDepartments = recentDepartmentIds
    .map((id) => flatDepartments.find((department) => department.id === id))
    .filter((department): department is DepartmentNode => Boolean(department))
  const groupedFriends = useMemo(() => groupUsersByInitial(friends), [friends])

  function selectDepartment(departmentId: number) {
    setActiveDepartmentId(departmentId)
    setRecentDepartmentIds((items) => [departmentId, ...items.filter((id) => id !== departmentId)].slice(0, 5))
  }

  if (view === "sessions") {
    return (
      <section className="stack">
        <div className="section-tools">
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索会话或消息" />
          <button onClick={onRefresh}>刷新</button>
        </div>
        <div className="peer-list">
          {sessions.map((session) => (
            <button key={session.id} className={activePeer === session.target_id ? "peer active" : "peer"} onClick={() => onSelectPeer(session.target_id)}>
              <div className="avatar-wrap"><img src={session.avatar} alt="" /><i className="online-dot" /></div>
              <span><strong title={displayName(session)}>{displayName(session)}</strong><small title={session.last_message?.content || ""}>{messagePreview(session.last_message)}</small></span>
              <em>
                {session.is_pinned && <b>置顶</b>}
                {session.is_muted && <b className="muted-dot">免打扰</b>}
                {session.last_message && <time>{smartTime(session.last_message.created_at)}</time>}
                {session.unread_count > 0 && <mark className={session.is_muted ? "muted" : ""}>{unreadText(session.unread_count)}</mark>}
              </em>
            </button>
          ))}
        </div>
        {sessions.length === 0 && <p className="empty-tip">暂无会话。先添加好友并发送消息。</p>}
      </section>
    )
  }

  if (view === "friends") {
    return (
      <section className="stack">
        <div className="directory-tabs"><button className="active">联系人</button><button onClick={() => onRefresh()}>刷新</button></div>
        <p className="list-summary">共 {friends.length} 位联系人</p>
        <div className="peer-list">
          {groupedFriends.map((group) => (
            <div key={group.letter} className="az-group">
              <div className="az-title">{group.letter}</div>
              {group.users.map((friend) => (
                <button key={friend.username} className={activePeer === friend.username ? "peer active" : "peer"} onClick={() => onSelectPeer(friend.username)}>
                  <div className="avatar-wrap"><img src={friend.avatar} alt="" /><i className={friend.status === "online" ? "online-dot" : "offline-dot"} /></div>
                  <span><strong title={displayName(friend)}>{displayName(friend)}</strong><small>{friend.signature || maskUsername(friend.username)}</small></span>
                  <em>{friend.is_blocked ? "已拉黑" : friend.status === "online" ? "在线" : "离线"}</em>
                </button>
              ))}
            </div>
          ))}
        </div>
        {friends.length === 0 && <p className="empty-tip">暂无联系人，可以从“用户”里发起好友申请。</p>}
      </section>
    )
  }

  if (view === "groups") {
    return (
      <section className="stack">
        <div className="section-tools">
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索群聊" />
          <button onClick={onCreateGroup}>建群</button>
        </div>
        <div className="peer-list">
          {groups
            .filter((group) => !query.trim() || group.name.toLowerCase().includes(query.trim().toLowerCase()))
            .map((group) => (
              <button key={group.id} className={activePeer === `group:${group.id}` ? "peer active" : "peer"} onClick={() => onSelectGroup(group.id)}>
                <div className="avatar-wrap"><div className="group-avatar">群</div></div>
                <span><strong title={group.name}>{group.name}</strong><small>{group.announcement || `${group.members.length} 位成员`}</small></span>
                <em>{group.dissolved ? "已解散" : `${group.members.length}人`}</em>
              </button>
            ))}
        </div>
        {groups.length === 0 && <p className="empty-tip">暂无群聊，点击“建群”创建一个群。</p>}
      </section>
    )
  }

  if (view === "org") {
    return (
      <section className="stack">
        <div className="directory-tabs"><button className="active">组织架构</button><button onClick={() => onRefresh()}>刷新</button></div>
        <p className="list-summary">{company?.name || "企业通讯录"}</p>
        <div className="org-toolbar">
          <button className={myDepartment && activeDepartmentId === myDepartment.id ? "active" : ""} disabled={!myDepartment} onClick={() => myDepartment && selectDepartment(myDepartment.id)}>
            我的部门{myDepartment ? `：${myDepartment.name}` : ""}
          </button>
          {activeDepartment && <span title={departmentBreadcrumb.join(" / ")}>当前位置：{departmentBreadcrumb.join(" / ")}</span>}
        </div>
        {recentDepartments.length > 0 && (
          <div className="recent-departments">
            <strong>最近查看</strong>
            {recentDepartments.map((department) => (
              <button key={department.id} onClick={() => selectDepartment(department.id)}>{department.name}</button>
            ))}
          </div>
        )}
        <div className="org-tree">
          {orgTree.length ? orgTree.map((node) => (
            <OrgTreeNode
              key={node.id}
              node={node}
              activePeer={activePeer}
              activeDepartmentId={activeDepartmentId}
              onSelectPeer={onSelectPeer}
              onSelectDepartment={selectDepartment}
            />
          )) : <p className="empty-tip">暂无组织架构，请管理员先在后台创建部门并分配员工。</p>}
        </div>
      </section>
    )
  }

  if (view === "requests") {
    const pendingInbox = inbox.filter((item) => item.status === "pending")
    return (
      <section className="stack">
        <h3>新的朋友 {pendingInbox.length ? unreadText(pendingInbox.length) : ""}</h3>
        {pendingInbox.map((item) => (
          <div key={item.id} className="request-card">
            <strong>{maskUsername(item.from_user)}</strong>
            <p>{item.message || "请求添加你为好友"}</p>
            <div className="row-actions">
              <button onClick={() => onRequestAction(item.id, "accept")}>同意</button>
              <button className="ghost-button" onClick={() => onRequestAction(item.id, "reject")}>拒绝</button>
            </div>
          </div>
        ))}
        {pendingInbox.length === 0 && <p className="empty-tip">暂无新的好友申请。</p>}
        <h3>申请记录</h3>
        {outbox.map((item) => (
          <div key={item.id} className="request-card muted">
            <strong>{maskUsername(item.to_user)}</strong>
            <p>{requestStatus(item.status)}</p>
          </div>
        ))}
        {outbox.length === 0 && <p className="empty-tip">暂无发出的申请。</p>}
      </section>
    )
  }

  if (view === "users") {
    return (
      <section className="peer-list">
        {users.map((user) => {
          const isFriend = friendNames.has(user.username)
          const isPending = pendingOutboxNames.has(user.username)
          return (
            <div key={user.username} className="user-card">
              <button className="peer plain" onClick={() => isFriend && onSelectPeer(user.username)}>
                <div className="avatar-wrap"><img src={user.avatar} alt="" /><i className={user.status === "online" ? "online-dot" : "offline-dot"} /></div>
                <span><strong title={safeDisplayName(user)}>{safeDisplayName(user)}</strong><small>{user.signature || maskUsername(user.username)}</small></span>
                <em>{user.status === "online" ? "在线" : "离线"}</em>
              </button>
              <button className="wide-button compact" disabled={isFriend || isPending || user.username === currentUser.username} onClick={() => onSendFriendRequest(user.username)}>
                {isFriend ? "已是好友" : isPending ? "等待验证" : "添加好友"}
              </button>
            </div>
          )
        })}
      </section>
    )
  }

  if (view === "blacklist") {
    return (
      <section className="stack">
        <h3>黑名单</h3>
        {blacklist.map((user) => (
          <div key={user.username} className="request-card">
            <strong title={safeDisplayName(user)}>{safeDisplayName(user)}</strong>
            <p>{user.reason || "未填写拉黑原因"}</p>
            <div className="row-actions"><button className="ghost-button" onClick={() => onUnblock(user.username)}>解除拉黑</button></div>
          </div>
        ))}
        {blacklist.length === 0 && <p className="empty-tip">暂无黑名单用户。</p>}
      </section>
    )
  }

  return <p className="empty-tip">请在右侧编辑个人资料。</p>
}

function OrgTreeNode({
  node,
  activePeer,
  activeDepartmentId,
  onSelectPeer,
  onSelectDepartment,
}: {
  node: DepartmentNode
  activePeer: string
  activeDepartmentId: number | null
  onSelectPeer: (username: string) => void
  onSelectDepartment: (departmentId: number) => void
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className={activeDepartmentId === node.id ? "org-node active" : "org-node"}>
      <button className="org-title" onClick={() => { onSelectDepartment(node.id); setOpen(!open) }}>
        <span>{open ? "▾" : "▸"}</span>
        <strong title={node.name}>{node.name}</strong>
        <em>{node.members.length} 人</em>
      </button>
      {open && (
        <div className="org-children">
          {node.members.map((member) => (
            <button key={member.username} className={activePeer === member.username ? "peer active" : "peer"} onClick={() => onSelectPeer(member.username)}>
              <div className="avatar-wrap"><img src={member.avatar} alt="" /><i className={member.status === "online" ? "online-dot" : "offline-dot"} /></div>
              <span><strong title={safeDisplayName(member)}>{safeDisplayName(member)}</strong><small>{member.position || "未设置职位"}</small></span>
              <em>{member.status === "online" ? "在线" : "离线"}</em>
            </button>
          ))}
          {node.children.map((child) => (
            <OrgTreeNode
              key={child.id}
              node={child}
              activePeer={activePeer}
              activeDepartmentId={activeDepartmentId}
              onSelectPeer={onSelectPeer}
              onSelectDepartment={onSelectDepartment}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SearchSummary({
  result,
  query,
  currentUser,
  onSelectPeer,
  onLocateMessage,
}: {
  result: SearchResult
  query: string
  currentUser: string
  onSelectPeer: (username: string) => void
  onLocateMessage: (message: ImMessage) => void
}) {
  const attachments = result.attachments || []
  const total = result.users.length + result.friends.length + result.sessions.length + result.messages.length + attachments.length + (result.departments?.length || 0) + (result.members?.length || 0)
  return (
    <section className="search-summary">
      <strong>搜索结果 {total}</strong>
      <SearchGroup title="部门" empty={!(result.departments || []).length}>
        {(result.departments || []).slice(0, 4).map((department) => <button key={`d-${department.id}`}>{highlightText(department.name, query)}</button>)}
      </SearchGroup>
      <SearchGroup title="成员" empty={!(result.members || []).length}>
        {(result.members || []).slice(0, 4).map((user) => <button key={`om-${user.username}`} onClick={() => onSelectPeer(user.username)}>{highlightText(safeDisplayName(user), query)} {user.position ? `· ${user.position}` : ""}</button>)}
      </SearchGroup>
      <SearchGroup title="联系人" empty={!result.friends.length}>
        {result.friends.slice(0, 4).map((user) => <button key={`f-${user.username}`} onClick={() => onSelectPeer(user.username)}>{highlightText(safeDisplayName(user), query)}</button>)}
      </SearchGroup>
      <SearchGroup title="会话" empty={!result.sessions.length}>
        {result.sessions.slice(0, 4).map((session) => <button key={`s-${session.id}`} onClick={() => onSelectPeer(session.target_id)}>{highlightText(displayName(session), query)}</button>)}
      </SearchGroup>
      <SearchGroup title="消息" empty={!result.messages.length}>
        {result.messages.slice(0, 4).map((message) => {
          const target = message.conversation_id?.startsWith("group:") ? message.conversation_id : message.sender === currentUser ? message.receiver : message.sender
          return <button key={`m-${message.id}`} onClick={() => onLocateMessage(message)}>{highlightText(`${maskUsername(target)}：${message.content}`, query)}</button>
        })}
      </SearchGroup>
      <SearchGroup title="文件" empty={!attachments.length}>
        {attachments.slice(0, 4).map((item) => (
          <a key={`a-${item.id}`} href={attachmentUrl(item)} target="_blank" rel="noreferrer">{highlightText(`${item.original_name} · ${formatBytes(item.size)}`, query)}</a>
        ))}
      </SearchGroup>
      {total === 0 && <span>无匹配结果</span>}
    </section>
  )
}

function SearchGroup({ title, empty, children }: { title: string; empty: boolean; children: ReactNode }) {
  if (empty) return null
  return (
    <div className="search-group">
      <span>{title}</span>
      {children}
    </div>
  )
}

function UserProfileCard({
  user,
  isFriend,
  isPending,
  onSendFriendRequest,
  onMessage,
  onUpdateRemark,
}: {
  user: ImUser
  isFriend: boolean
  isPending: boolean
  onSendFriendRequest: (username: string) => void
  onMessage?: (username: string) => void
  onUpdateRemark?: () => void
}) {
  return (
    <section className="profile-card">
      <img src={user.avatar} alt="" />
      <div>
        <strong title={safeDisplayName(user)}>{safeDisplayName(user)}</strong>
        <span>{maskUsername(user.username)} · {user.status === "online" ? "在线" : "离线"}</span>
        <p>{user.signature || "这个用户还没有填写签名"}</p>
      </div>
      <div className="profile-actions">
        {isFriend && <button onClick={() => onMessage?.(user.username)}>发消息</button>}
        {isFriend && <button className="ghost-button" onClick={onUpdateRemark}>设置备注</button>}
        {!isFriend && (
          <button disabled={isPending} onClick={() => onSendFriendRequest(user.username)}>
            {isPending ? "等待验证" : "添加好友"}
          </button>
        )}
      </div>
    </section>
  )
}

function FriendDetailPanel({
  user,
  isFriend,
  isPending,
  commonGroups,
  files,
  onSendFriendRequest,
  onMessage,
  onUpdateRemark,
  onToggleBlacklist,
  onDeleteFriend,
  onSelectGroup,
}: {
  user: ImUser
  isFriend: boolean
  isPending: boolean
  commonGroups: ImGroup[]
  files: Attachment[]
  onSendFriendRequest: (username: string) => void
  onMessage: (username: string) => void
  onUpdateRemark: () => void
  onToggleBlacklist: () => void
  onDeleteFriend: () => void
  onSelectGroup: (groupId: number) => void
}) {
  return (
    <section className="detail-card">
      <div className="detail-card-head">
        <img src={user.avatar} alt="" />
        <div>
          <strong title={safeDisplayName(user)}>{safeDisplayName(user)}</strong>
          <span>{maskUsername(user.username)} · {user.status === "online" ? "在线" : "离线"}</span>
          <p>{user.signature || "这个用户还没有填写签名"}</p>
        </div>
      </div>
      <div className="detail-grid">
        <InfoItem label="邮箱" value={user.email || "-"} />
        <InfoItem label="手机" value={user.phone || "-"} />
        <InfoItem label="职位" value={user.position || "-"} />
        <InfoItem label="部门" value={user.department_name || "-"} />
        <InfoItem label="关系来源" value={user.friend_source || "好友/联系人"} />
        <InfoItem label="添加时间" value={user.friend_created_at ? formatDateTime(user.friend_created_at) : "-"} />
      </div>
      <div className="detail-actions">
        {isFriend && <button onClick={() => onMessage(user.username)}>发消息</button>}
        {isFriend && <button className="ghost-button" onClick={onUpdateRemark}>设置备注</button>}
        {isFriend && <button className="ghost-button" onClick={onToggleBlacklist}>{user.is_blocked ? "解除拉黑" : "拉黑"}</button>}
        {!isFriend && <button disabled={isPending} onClick={() => onSendFriendRequest(user.username)}>{isPending ? "等待验证" : "添加好友"}</button>}
        {isFriend && <button className="danger-button" onClick={onDeleteFriend}>删除好友</button>}
      </div>
      <DetailSection title={`共同群聊 ${commonGroups.length}`}>
        {commonGroups.length ? commonGroups.map((group) => (
          <button className="mini-row" key={group.id} onClick={() => onSelectGroup(group.id)}>
            <span>{group.name}</span><em>{group.members.length}人</em>
          </button>
        )) : <p className="empty-tip compact">暂无共同群聊</p>}
      </DetailSection>
      <DetailSection title={`历史文件 ${files.length}`}>
        <MiniFileList files={files} />
      </DetailSection>
    </section>
  )
}

function GroupSettingsPanel({
  group,
  currentUser,
  files,
  isOwner,
  onUpdateName,
  onUpdateAnnouncement,
  onUpdateNickname,
  onAddMembers,
  onRemoveMember,
  onTransferOwner,
  onExitGroup,
  onSelectPeer,
}: {
  group: ImGroup
  currentUser: ImUser
  files: Attachment[]
  isOwner: boolean
  onUpdateName: () => void
  onUpdateAnnouncement: () => void
  onUpdateNickname: () => void
  onAddMembers: () => void
  onRemoveMember: () => void
  onTransferOwner: () => void
  onExitGroup: () => void
  onSelectPeer: (username: string) => void
}) {
  const me = group.members.find((member) => member.username === currentUser.username)
  return (
    <section className="detail-card group-settings-panel">
      <div className="detail-card-head">
        <div className="group-avatar large">群</div>
        <div>
          <strong title={group.name}>{group.name}</strong>
          <span>群主：{maskUsername(group.owner)} · {group.members.length} 位成员</span>
          <p>{group.announcement || "暂无群公告"}</p>
        </div>
      </div>
      <div className="detail-grid">
        <InfoItem label="我的群昵称" value={me?.group_nickname || currentUser.name || currentUser.username} />
        <InfoItem label="群状态" value={group.dissolved ? "已解散" : "正常"} />
        <InfoItem label="创建时间" value={formatDateTime(group.created_at)} />
        <InfoItem label="更新时间" value={formatDateTime(group.updated_at)} />
      </div>
      <div className="detail-actions">
        {isOwner && <button onClick={onUpdateName}>修改群名</button>}
        {isOwner && <button className="ghost-button" onClick={onUpdateAnnouncement}>编辑公告</button>}
        <button className="ghost-button" onClick={onUpdateNickname}>我的群昵称</button>
        {isOwner && <button className="ghost-button" onClick={onAddMembers}>添加成员</button>}
        {isOwner && <button className="ghost-button" onClick={onRemoveMember}>移除成员</button>}
        {isOwner && <button className="ghost-button" onClick={onTransferOwner}>转让群主</button>}
        <button className="danger-button" onClick={onExitGroup}>退出群聊</button>
      </div>
      <DetailSection title={`群成员 ${group.members.length}`}>
        <div className="member-grid">
          {group.members.map((member) => (
            <button key={member.username} onClick={() => onSelectPeer(member.username)}>
              <img src={member.avatar} alt="" />
              <span title={member.group_nickname || member.name}>{member.group_nickname || member.name}</span>
              <em>{member.group_role === "owner" ? "群主" : member.status === "online" ? "在线" : "离线"}</em>
            </button>
          ))}
        </div>
      </DetailSection>
      <DetailSection title={`群历史文件 ${files.length}`}>
        <MiniFileList files={files} />
      </DetailSection>
    </section>
  )
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="detail-section">
      <h3>{title}</h3>
      {children}
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return <div className="info-item"><span>{label}</span><strong title={value}>{value}</strong></div>
}

function MiniFileList({ files }: { files: Attachment[] }) {
  if (!files.length) return <p className="empty-tip compact">暂无历史文件</p>
  return (
    <div className="mini-file-list">
      {files.slice(0, 8).map((file) => (
        <a key={file.id} href={attachmentUrl(file)} target="_blank" rel="noreferrer">
          <b>{fileIcon(file.original_name)}</b>
          <span title={file.original_name}>{file.original_name}</span>
          <em>{formatBytes(file.size)}</em>
        </a>
      ))}
    </div>
  )
}

function MessageContent({ message, query, onSelectPeer }: { message: ImMessage; query: string; onSelectPeer: (username: string) => void }) {
  if (message.recalled_at) return <p>消息已撤回</p>
  if (message.burned_at) return <p>阅后即焚消息已销毁</p>
  if (message.msg_type === "card") {
    try {
      const card = JSON.parse(message.content) as { username?: string; name?: string; avatar?: string; signature?: string }
      const username = card.username || ""
      return (
        <div className="contact-card-message">
          {card.avatar && <img src={card.avatar} alt="" />}
          <span><strong>{card.name || username}</strong><small>{username}</small>{card.signature && <small>{card.signature}</small>}</span>
          {username && <button onClick={() => onSelectPeer(username)}>查看</button>}
        </div>
      )
    } catch {
      return <p>{highlightText(message.content, query)}</p>
    }
  }
  const url = firstUrl(message.content)
  return (
    <>
      <p>{highlightText(message.content, query)}</p>
      {url && (
        <a className="link-preview" href={url} target="_blank" rel="noreferrer">
          <strong>{new URL(url).hostname}</strong>
          <span>{url}</span>
        </a>
      )}
    </>
  )
}

function AttachmentPreview({ attachments }: { attachments: Attachment[] }) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [scale, setScale] = useState(1)
  if (attachments.length === 0) return null
  const images = attachments.filter((item) => item.category === "image")
  const audios = attachments.filter((item) => item.category === "audio")
  const files = attachments.filter((item) => item.category !== "image" && item.category !== "audio")
  const currentImage = previewIndex === null ? null : images[previewIndex]
  function openPreview(index: number) {
    setPreviewIndex(index)
    setScale(1)
  }
  function movePreview(offset: number) {
    if (previewIndex === null || images.length === 0) return
    setPreviewIndex((previewIndex + offset + images.length) % images.length)
    setScale(1)
  }
  return (
    <div className="attachment-preview">
      {images.length > 0 && (
        <div className="image-grid">
          {images.map((item, index) => (
            <button type="button" key={item.id} onClick={() => openPreview(index)}>
              <img src={attachmentUrl(item)} alt={item.original_name} />
            </button>
          ))}
        </div>
      )}
      {currentImage && (
        <div className="image-viewer" role="dialog" aria-modal="true">
          <div className="image-viewer-toolbar">
            <button onClick={() => movePreview(-1)}>上一张</button>
            <span>{(previewIndex || 0) + 1} / {images.length}</span>
            <button onClick={() => movePreview(1)}>下一张</button>
            <button onClick={() => setScale((value) => Math.min(value + 0.25, 3))}>放大</button>
            <button onClick={() => setScale((value) => Math.max(value - 0.25, 0.5))}>缩小</button>
            <a href={attachmentUrl(currentImage)} download={currentImage.original_name}>下载</a>
            <button onClick={() => setPreviewIndex(null)}>关闭</button>
          </div>
          <img style={{ transform: `scale(${scale})` }} src={attachmentUrl(currentImage)} alt={currentImage.original_name} />
        </div>
      )}
      {audios.map((item) => (
        <div className="audio-item" key={item.id}>
          <span>{item.original_name}</span>
          <audio controls src={attachmentUrl(item)} />
        </div>
      ))}
      {files.map((item) => (
        <a className="file-item" key={item.id} href={attachmentUrl(item)} target="_blank" rel="noreferrer">
          <b>{fileIcon(item.original_name)}</b>
          <span title={item.original_name}>
            {item.original_name}
            <small>{filePreviewText(item)}</small>
          </span>
          <em>{formatBytes(item.size)}</em>
        </a>
      ))}
    </div>
  )
}

function ProfilePanel({ currentUser, token, onUserUpdate }: { currentUser: ImUser; token: string; onUserUpdate: (user: ImUser) => void }) {
  const [name, setName] = useState(currentUser.name)
  const [email, setEmail] = useState(currentUser.email || "")
  const [phone, setPhone] = useState(currentUser.phone || "")
  const [signature, setSignature] = useState(currentUser.signature || "")
  const [avatar, setAvatar] = useState(currentUser.avatar || "")
  const [notice, setNotice] = useState("")

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const nextUser = await updateUser(token, currentUser.username, { name, email, phone, signature, avatar })
    onUserUpdate(nextUser)
    setNotice("资料已保存")
  }

  return (
    <section className="detail-panel">
      <header className="chat-header"><h2>我的资料</h2></header>
      <form className="profile-form" onSubmit={handleSubmit}>
        <img className="profile-avatar" src={avatar || currentUser.avatar} alt="" />
        <div className="detail-grid">
          <InfoItem label="账号" value={currentUser.username} />
          <InfoItem label="角色" value={currentUser.role || "user"} />
          <InfoItem label="在线状态" value={currentUser.status === "online" ? "在线" : "离线"} />
          <InfoItem label="部门" value={currentUser.department_name || "-"} />
        </div>
        <label>显示名称<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>头像地址<input value={avatar} onChange={(event) => setAvatar(event.target.value)} /></label>
        <label>邮箱<input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>手机号<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
        <label>签名<input value={signature} onChange={(event) => setSignature(event.target.value)} /></label>
        <button>保存资料</button>
        {notice && <p className="notice">{notice}</p>}
      </form>
    </section>
  )
}

function SettingsPanel({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [cacheBytes, setCacheBytes] = useState(() => estimateLocalCacheBytes())

  useEffect(() => {
    let active = true
    getSettings(token)
      .then((item) => {
        if (!active) return
        setSettings(item)
        applyLocalAppearance(item)
      })
      .catch((err: Error) => {
        if (active) setError(err.message || "设置加载失败")
      })
    return () => {
      active = false
    }
  }, [token])

  function updateField<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    setSettings((current) => (current ? { ...current, [key]: value } : current))
    setNotice("")
    setError("")
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!settings) return
    setSaving(true)
    setError("")
    try {
      const payload: Partial<UserSettings> = {
        notification_enabled: settings.notification_enabled,
        message_preview_enabled: settings.message_preview_enabled,
        mention_notify_enabled: settings.mention_notify_enabled,
        quiet_hours_enabled: settings.quiet_hours_enabled,
        quiet_hours_start: settings.quiet_hours_start,
        quiet_hours_end: settings.quiet_hours_end,
        theme: settings.theme,
        language: settings.language,
        font_size: settings.font_size,
        chat_background: settings.chat_background,
      }
      const next = await updateSettings(token, payload)
      setSettings(next)
      applyLocalAppearance(next)
      setNotice("设置已保存")
    } catch (err) {
      setError(err instanceof Error ? err.message : "设置保存失败")
    } finally {
      setSaving(false)
    }
  }

  function handleClearCache() {
    window.localStorage.removeItem("im-search-history")
    window.localStorage.removeItem("im-theme")
    window.localStorage.removeItem("im-font-size")
    setCacheBytes(estimateLocalCacheBytes())
    setNotice("本地缓存已清理，登录状态已保留")
  }

  function handleLogoutConfirm() {
    if (window.confirm("确定要退出当前账号吗？")) onLogout()
  }

  if (!settings) {
    return (
      <section className="detail-panel">
        <header className="chat-header"><h2>设置中心</h2></header>
        <div className="settings-panel">{error ? <p className="error-text">{error}</p> : <p>设置加载中...</p>}</div>
      </section>
    )
  }

  return (
    <section className="detail-panel">
      <header className="chat-header"><h2>设置中心</h2></header>
      <form className="settings-panel" onSubmit={handleSubmit}>
        <section className="settings-box">
          <h3>通知中心</h3>
          <label className="switch-row">
            <span><b>通知总开关</b><small>关闭后不再显示新消息通知提示</small></span>
            <input type="checkbox" checked={settings.notification_enabled} onChange={(event) => updateField("notification_enabled", event.target.checked)} />
          </label>
          <label className="switch-row">
            <span><b>消息预览</b><small>通知中是否展示消息摘要</small></span>
            <input type="checkbox" checked={settings.message_preview_enabled} onChange={(event) => updateField("message_preview_enabled", event.target.checked)} />
          </label>
          <label className="switch-row">
            <span><b>@提醒</b><small>群聊被 @ 时单独提醒</small></span>
            <input type="checkbox" checked={settings.mention_notify_enabled} onChange={(event) => updateField("mention_notify_enabled", event.target.checked)} />
          </label>
          <label className="switch-row">
            <span><b>免打扰</b><small>指定时间段降低提醒强度</small></span>
            <input type="checkbox" checked={settings.quiet_hours_enabled} onChange={(event) => updateField("quiet_hours_enabled", event.target.checked)} />
          </label>
          <div className="settings-grid two">
            <label>开始时间<input type="time" value={settings.quiet_hours_start} onChange={(event) => updateField("quiet_hours_start", event.target.value)} /></label>
            <label>结束时间<input type="time" value={settings.quiet_hours_end} onChange={(event) => updateField("quiet_hours_end", event.target.value)} /></label>
          </div>
        </section>

        <section className="settings-box">
          <h3>通用设置</h3>
          <div className="settings-grid">
            <label>主题模式
              <select value={settings.theme} onChange={(event) => updateField("theme", event.target.value)}>
                <option value="system">跟随系统</option>
                <option value="light">浅色</option>
                <option value="dark">深色</option>
              </select>
            </label>
            <label>语言
              <select value={settings.language} onChange={(event) => updateField("language", event.target.value)}>
                <option value="zh-CN">简体中文</option>
                <option value="en-US">English（占位）</option>
              </select>
            </label>
            <label>字体大小
              <select value={settings.font_size} onChange={(event) => updateField("font_size", event.target.value)}>
                <option value="small">小</option>
                <option value="standard">标准</option>
                <option value="large">大</option>
              </select>
            </label>
            <label>聊天背景
              <input value={settings.chat_background} onChange={(event) => updateField("chat_background", event.target.value)} placeholder="可填写图片地址，后续阶段应用到聊天区" />
            </label>
          </div>
        </section>

        <section className="settings-box">
          <h3>本地缓存</h3>
          <div className="cache-row">
            <span>当前浏览器缓存占用</span>
            <strong>{formatBytes(cacheBytes)}</strong>
            <button type="button" className="ghost-button" onClick={handleClearCache}>清理缓存</button>
          </div>
        </section>

        <div className="settings-actions">
          <button disabled={saving}>{saving ? "保存中..." : "保存设置"}</button>
          <button type="button" className="danger-button" onClick={handleLogoutConfirm}>退出登录</button>
        </div>
        {notice && <p className="notice">{notice}</p>}
        {error && <p className="error-text">{error}</p>}
      </form>
    </section>
  )
}

function AdminPanel({ token }: { token: string }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [users, setUsers] = useState<ImUser[]>([])
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const [messages, setMessages] = useState<ImMessage[]>([])

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    const [nextOverview, nextUsers, nextOnlineUsers, nextMessages] = await Promise.all([
      getAdminOverview(token),
      getAdminUsers(token),
      getAdminOnlineUsers(token),
      getAdminMessages(token),
    ])
    setOverview(nextOverview)
    setUsers(nextUsers)
    setOnlineUsers(nextOnlineUsers)
    setMessages(nextMessages)
  }

  return (
    <section className="admin-panel">
      <header className="chat-header admin-header"><h2>后台概览</h2><button className="ghost-button" onClick={refresh}>刷新</button></header>
      <div className="admin-content">
        <div className="metric-grid">
          <Metric label="用户" value={overview?.users ?? 0} />
          <Metric label="会话" value={overview?.conversations ?? 0} />
          <Metric label="消息" value={overview?.messages ?? 0} />
          <Metric label="好友关系" value={overview?.friendships ?? 0} />
          <Metric label="待处理申请" value={overview?.pending_friend_requests ?? 0} />
          <Metric label="在线" value={overview?.online_users ?? 0} />
        </div>
        <div className="admin-columns">
          <section className="admin-box"><h3>用户管理</h3>{users.map((user) => <div key={user.username} className="table-row"><span title={user.name}>{user.name}</span><b>{user.status}</b></div>)}</section>
          <section className="admin-box"><h3>在线用户</h3><div className="tag-list">{onlineUsers.length ? onlineUsers.map((item) => <span key={item}>{item}</span>) : <em>暂无在线用户</em>}</div></section>
        </div>
        <section className="admin-box">
          <h3>消息审计</h3>
          <div className="audit-list">
            {messages.map((message) => (
              <article key={message.id}><strong>{maskUsername(message.sender)} 到 {maskUsername(message.receiver)}</strong><p>{message.content}</p><time>{formatDateTime(message.created_at)}</time></article>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="metric-card"><span>{label}</span><strong>{value}</strong></div>
}

function estimateLocalCacheBytes() {
  let total = 0
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index) || ""
    const value = window.localStorage.getItem(key) || ""
    total += key.length + value.length
  }
  return total * 2
}

function applyLocalAppearance(settings: Pick<UserSettings, "theme" | "font_size">) {
  const theme = settings.theme || "system"
  const fontSize = settings.font_size || "standard"
  document.documentElement.dataset.theme = theme
  document.documentElement.dataset.fontSize = fontSize
  window.localStorage.setItem("im-theme", theme)
  window.localStorage.setItem("im-font-size", fontSize)
}

function messagePreview(message?: ImMessage | null) {
  if (!message) return "暂无消息"
  if (message.msg_type && message.msg_type !== "text") return `[${message.msg_type}]`
  return message.content
}

function displayName(user: Pick<ImUser, "username" | "name" | "remark"> | Pick<ImSession, "target_id" | "name">) {
  if ("remark" in user && user.remark) return user.remark
  if ("target_id" in user) return user.name || maskUsername(user.target_id)
  return user.name && user.name !== user.username ? user.name : maskUsername(user.username)
}

function safeDisplayName(user: Pick<ImUser, "username" | "name" | "remark">) {
  return displayName(user)
}

function groupMemberDisplayName(group: ImGroup | null, username: string) {
  const member = group?.members.find((item) => item.username === username)
  return member?.group_nickname || member?.name || maskUsername(username)
}

function groupUsersByInitial(users: ImUser[]) {
  const groups = new Map<string, ImUser[]>()
  users
    .slice()
    .sort((a, b) => displayName(a).localeCompare(displayName(b), "zh-Hans-CN"))
    .forEach((user) => {
      const first = (displayName(user)[0] || "#").toUpperCase()
      const letter = /^[A-Z]$/.test(first) ? first : "#"
      groups.set(letter, [...(groups.get(letter) || []), user])
    })
  return Array.from(groups.entries())
    .sort(([a], [b]) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)))
    .map(([letter, items]) => ({ letter, users: items }))
}

function flattenDepartments(nodes: DepartmentNode[]): DepartmentNode[] {
  return nodes.flatMap((node) => [node, ...flattenDepartments(node.children || [])])
}

function findDepartmentPath(nodes: DepartmentNode[], targetId: number, trail: DepartmentNode[] = []): DepartmentNode[] {
  for (const node of nodes) {
    const nextTrail = [...trail, node]
    if (node.id === targetId) return nextTrail
    const childPath = findDepartmentPath(node.children || [], targetId, nextTrail)
    if (childPath.length) return childPath
  }
  return []
}

function firstUrl(text: string) {
  const match = text.match(/https?:\/\/[^\s]+/i)
  return match?.[0] || ""
}

function highlightText(text: string, query: string) {
  if (!query.trim()) return text
  const lower = text.toLowerCase()
  const needle = query.trim().toLowerCase()
  const index = lower.indexOf(needle)
  if (index < 0) return text
  return (
    <>
      {text.slice(0, index)}
      <mark className="search-hit">{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  )
}

function uniqueAttachments(files: Attachment[]) {
  const map = new Map<number, Attachment>()
  files.forEach((file) => map.set(file.id, file))
  return Array.from(map.values())
}

function unreadText(count: number) {
  return count > 99 ? "99+" : String(count)
}

function maskUsername(username: string) {
  if (!username) return ""
  if (username.length <= 2) return `${username[0]}*`
  return `${username[0]}***${username[username.length - 1]}`
}

function smartTime(value: string) {
  const date = new Date(value)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  return date.toLocaleDateString()
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString()
}

function socketStatusLabel(status: SocketStatus) {
  return status === "online" ? "实时连接" : status === "connecting" ? "连接中" : "连接断开"
}

function requestStatus(status: FriendRequest["status"]) {
  return status === "pending" ? "等待验证" : status === "accepted" ? "已通过" : "已拒绝"
}

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toUpperCase() || "FILE"
  return ext.slice(0, 4)
}

function filePreviewText(item: Attachment) {
  const suffix = item.original_name.split(".").pop()?.toLowerCase() || ""
  if (item.mime_type === "application/pdf" || suffix === "pdf") return "PDF 可在线预览"
  if (item.category === "image") return "图片可预览"
  if (item.category === "audio") return "音频可播放"
  return "暂不支持在线预览，可下载查看"
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export default App
