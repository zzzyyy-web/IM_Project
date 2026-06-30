export type ImUser = {
  id?: string
  username: string
  name: string
  avatar: string
  email?: string | null
  phone?: string | null
  signature?: string | null
  role?: "user" | "admin" | string
  status: "online" | "offline" | string
  disabled?: boolean
  remark?: string | null
  is_blocked?: boolean
  reason?: string
  position?: string
  department_id?: number
  department_name?: string
  friend_source?: string
  friend_created_at?: string
  group_role?: string
  group_nickname?: string
  last_read_message_id?: number
}

export type ImMessage = {
  type?: "chat" | "ack" | "message_update" | "message_recall" | string
  id: string
  conversation_id: string
  sender: string
  receiver: string
  content: string
  msg_type: string
  created_at: string
  delivered: boolean
  read_at?: string | null
  status: string
  edited_at?: string | null
  recalled_at?: string | null
  attachments?: Attachment[]
  group_id?: number
  read_count?: number
  unread_count?: number
  reactions?: MessageReaction[]
  burn_after_read?: boolean
  burned_at?: string | null
}

export type MessageReaction = {
  emoji: string
  count: number
  users: string[]
}

export type ImGroup = {
  id: number
  name: string
  owner: string
  announcement: string
  dissolved: boolean
  created_at: string
  updated_at: string
  members: ImUser[]
}

export type Attachment = {
  id: number
  original_name: string
  mime_type: string
  size: number
  category: "image" | "file" | "audio" | string
  url: string
  uploader: string
  message_id?: number | null
  created_at: string
}

export type ImSession = {
  id: string
  type: string
  target_id: string
  name: string
  display_name?: string
  remark?: string | null
  avatar: string
  unread_count: number
  is_pinned: boolean
  is_muted: boolean
  updated_at: string
  last_message?: ImMessage | null
}

export type FriendRequest = {
  id: number
  from_user: string
  to_user: string
  message: string
  status: "pending" | "accepted" | "rejected"
  created_at: string
  updated_at: string
}

export type SearchResult = {
  users: ImUser[]
  friends: ImUser[]
  sessions: ImSession[]
  messages: ImMessage[]
  attachments?: Attachment[]
  departments?: DepartmentNode[]
  members?: ImUser[]
}

export type CompanySettings = {
  id: number
  name: string
  description: string
  updated_at: string
}

export type DepartmentNode = {
  id: number
  name: string
  parent_id?: number | null
  sort_order: number
  description: string
  created_at: string
  updated_at: string
  members: ImUser[]
  children: DepartmentNode[]
}

export type AdminOverview = {
  users: number
  messages: number
  friendships: number
  pending_friend_requests: number
  conversations: number
  online_users: number
  attachments?: number
  attachment_storage_bytes?: number
}

export type AdminTrend = {
  date: string
  messages: number
  active_users: number
  new_users: number
  new_groups: number
}

export type SystemConfig = {
  key: string
  value: string
  description: string
  updated_at: string
}

export type UserSettings = {
  username: string
  notification_enabled: boolean
  message_preview_enabled: boolean
  mention_notify_enabled: boolean
  quiet_hours_enabled: boolean
  quiet_hours_start: string
  quiet_hours_end: string
  theme: "system" | "light" | "dark" | string
  language: "zh-CN" | "en-US" | string
  font_size: "small" | "standard" | "large" | string
  chat_background: string
  updated_at: string
}

function apiBase() {
  return window.localStorage.getItem("im-api-base") || import.meta.env.VITE_IM_API_BASE || "http://127.0.0.1:8000"
}

function authHeaders(token?: string) {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function normalizeError(status: number, body: unknown) {
  const detail = typeof body === "object" && body && "detail" in body ? (body as { detail: unknown }).detail : undefined
  if (typeof detail === "string") return translateError(detail)
  if (Array.isArray(detail)) return "输入内容不符合规范，请检查用户名、密码或消息内容"
  if (status === 400) return "请求参数不正确，请检查后重试"
  if (status === 401) return "用户名或密码错误，或登录已失效"
  if (status === 403) return "没有权限执行该操作"
  if (status === 404) return "数据不存在或已被删除"
  if (status === 422) return "输入内容不符合规范，请检查后重试"
  return "服务请求失败，请稍后重试"
}

function translateError(message: string) {
  const known: Record<string, string> = {
    "missing token": "请先登录",
    "invalid user": "登录用户无效，请重新登录",
    "admin only": "只有管理员可以执行该操作",
    "cannot operate on another user": "不能操作其他用户的数据",
    "cannot send request as another user": "不能替其他用户发送好友申请",
    "cannot add yourself": "不能添加自己为好友",
    "user not found": "用户不存在",
    "already friends": "你们已经是好友",
    "friend request blocked": "对方或你已在黑名单中，不能发送好友申请",
    "message blocked": "对方或你已在黑名单中，不能发送消息",
    "receiver not found": "接收方用户不存在",
    "username already exists": "用户名已存在",
    "Invalid chat message": "消息格式不正确",
    "cannot edit another user's message": "不能编辑别人的消息",
    "cannot recall another user's message": "不能撤回别人的消息",
    "message already recalled": "消息已撤回，不能再编辑",
    "message recall expired": "消息已超过 3 分钟，不能撤回",
  }
  return known[message] || message
}

async function request<T>(path: string, token?: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiBase()}${path}`, {
      ...options,
      headers: {
        ...authHeaders(token),
        ...(options.headers || {}),
      },
    })
  } catch {
    throw new Error("无法连接后端服务，请确认后端已启动")
  }
  const text = await response.text()
  const body = text ? JSON.parse(text) : null
  if (!response.ok) throw new Error(normalizeError(response.status, body))
  return body as T
}

export function getCaptcha() {
  return request<{ code: string; captcha_token: string; hint?: string }>("/api/captcha")
}

export function register(username: string, password: string, captcha: string, captchaToken: string) {
  return request<{ user: ImUser; token: string }>("/api/register", undefined, {
    method: "POST",
    body: JSON.stringify({ username, password, captcha, captcha_token: captchaToken, display_name: username }),
  })
}

export function login(username: string, password: string) {
  return request<{ user: ImUser; token: string }>("/api/login", undefined, {
    method: "POST",
    body: JSON.stringify({ username, password }),
  })
}

export function getUsers(token: string) {
  return request<ImUser[]>("/api/users", token)
}

export function getFriends(token: string, username: string) {
  return request<ImUser[]>(`/api/friends?username=${encodeURIComponent(username)}`, token)
}

export function getBlacklist(token: string, username: string) {
  return request<ImUser[]>(`/api/blacklist?username=${encodeURIComponent(username)}`, token)
}

export function getSessions(token: string, username: string) {
  return request<ImSession[]>(`/api/sessions?username=${encodeURIComponent(username)}`, token)
}

export function getSettings(token: string) {
  return request<UserSettings>("/api/settings", token)
}

export function updateSettings(token: string, payload: Partial<UserSettings>) {
  return request<UserSettings>("/api/settings", token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export function getFriendRequests(token: string, username: string, box: "inbox" | "outbox") {
  return request<FriendRequest[]>(`/api/friend-requests?username=${encodeURIComponent(username)}&box=${box}`, token)
}

export function createFriendRequest(token: string, fromUser: string, toUser: string, message = "") {
  return request<FriendRequest>("/api/friend-requests", token, {
    method: "POST",
    body: JSON.stringify({ from_user: fromUser, to_user: toUser, message }),
  })
}

export function respondFriendRequest(token: string, requestId: number, action: "accept" | "reject", remark = "") {
  return request<FriendRequest>(`/api/friend-requests/${requestId}/action`, token, {
    method: "POST",
    body: JSON.stringify({ action, remark }),
  })
}

export function getMessages(token: string, me: string, peer: string, beforeId?: string | number, limit = 100) {
  const params = new URLSearchParams({ me, peer, limit: String(limit) })
  if (beforeId) params.set("before_id", String(beforeId))
  return request<ImMessage[]>(`/api/messages?${params.toString()}`, token)
}

export function editMessage(token: string, messageId: string, content: string) {
  return request<ImMessage>(`/api/messages/${encodeURIComponent(messageId)}`, token, {
    method: "PATCH",
    body: JSON.stringify({ content }),
  })
}

export function recallMessage(token: string, messageId: string) {
  return request<ImMessage>(`/api/messages/${encodeURIComponent(messageId)}/recall`, token, { method: "POST" })
}

export function forwardMessage(token: string, messageId: string, targets: string[]) {
  return request<ImMessage[]>(`/api/messages/${encodeURIComponent(messageId)}/forward`, token, {
    method: "POST",
    body: JSON.stringify({ targets }),
  })
}

export function favoriteMessage(token: string, messageId: string, note = "") {
  return request(`/api/messages/${encodeURIComponent(messageId)}/favorite`, token, {
    method: "POST",
    body: JSON.stringify({ note }),
  })
}

export function toggleMessageReaction(token: string, messageId: string, emoji = "👍") {
  return request<{ reacted: boolean; message: ImMessage }>(`/api/messages/${encodeURIComponent(messageId)}/reaction`, token, {
    method: "POST",
    body: JSON.stringify({ emoji }),
  })
}

export function getGroupReadMembers(token: string, groupId: number, messageId: string | number) {
  return request<{ message_id: string; read: ImUser[]; unread: ImUser[] }>(
    `/api/groups/${groupId}/messages/${encodeURIComponent(String(messageId))}/read-members`,
    token,
  )
}

export function saveDraft(token: string, conversationId: string, content: string) {
  return request<{ username: string; conversation_id: string; content: string; updated_at: string }>("/api/drafts", token, {
    method: "PUT",
    body: JSON.stringify({ conversation_id: conversationId, content }),
  })
}

export function getDraft(token: string, conversationId: string) {
  return request<{ username: string; conversation_id: string; content: string; updated_at: string }>(
    `/api/drafts?conversation_id=${encodeURIComponent(conversationId)}`,
    token,
  )
}

export function sendScreenshotNotice(token: string, conversationId: string, target = "") {
  return request<{ id: number; reporter: string; conversation_id: string; target: string; created_at: string }>("/api/screenshot-notices", token, {
    method: "POST",
    body: JSON.stringify({ conversation_id: conversationId, target }),
  })
}

export async function uploadAttachment(token: string, file: File) {
  const formData = new FormData()
  formData.append("file", file)
  const response = await fetch(`${apiBase()}/api/attachments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  const text = await response.text()
  const body = text ? JSON.parse(text) : null
  if (!response.ok) throw new Error(normalizeError(response.status, body))
  return body as Attachment
}

export function attachmentUrl(attachment: Attachment) {
  return `${apiBase()}${attachment.url}`
}

export function markMessagesRead(token: string, username: string, peer: string) {
  return request<{ conversation_id: string; reader: string; read_at: string }>(
    `/api/messages/read?username=${encodeURIComponent(username)}&peer=${encodeURIComponent(peer)}`,
    token,
    { method: "POST" },
  )
}

export function clearConversation(token: string, username: string, peer: string) {
  return request<{ conversation_id: string; cleared: boolean }>(
    `/api/messages?username=${encodeURIComponent(username)}&peer=${encodeURIComponent(peer)}`,
    token,
    { method: "DELETE" },
  )
}

export function updateFriendRemark(token: string, username: string, friendUsername: string, remark: string) {
  return request<ImUser>(`/api/friends/${encodeURIComponent(friendUsername)}?username=${encodeURIComponent(username)}`, token, {
    method: "PATCH",
    body: JSON.stringify({ remark }),
  })
}

export function deleteFriend(token: string, username: string, friendUsername: string) {
  return request<{ deleted: boolean }>(
    `/api/friends/${encodeURIComponent(friendUsername)}?username=${encodeURIComponent(username)}`,
    token,
    { method: "DELETE" },
  )
}

export function blockUser(token: string, username: string, target: string, reason = "") {
  return request(`/api/blacklist/${encodeURIComponent(target)}?username=${encodeURIComponent(username)}`, token, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
}

export function unblockUser(token: string, username: string, target: string) {
  return request<{ deleted: boolean }>(
    `/api/blacklist/${encodeURIComponent(target)}?username=${encodeURIComponent(username)}`,
    token,
    { method: "DELETE" },
  )
}

export function updateSessionSettings(
  token: string,
  username: string,
  peer: string,
  payload: { pinned?: boolean; muted?: boolean },
) {
  return request<ImSession>(`/api/sessions/${encodeURIComponent(peer)}?username=${encodeURIComponent(username)}`, token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export function searchIm(token: string, username: string, query: string) {
  return request<SearchResult>(
    `/api/search?username=${encodeURIComponent(username)}&q=${encodeURIComponent(query)}`,
    token,
  )
}

export function getCompanySettings(token: string) {
  return request<CompanySettings>("/api/org/company", token)
}

export function getOrgTree(token: string) {
  return request<DepartmentNode[]>("/api/org/tree", token)
}

export function getGroups(token: string) {
  return request<ImGroup[]>("/api/groups", token)
}

export function createGroup(token: string, payload: { name: string; member_usernames: string[]; announcement?: string }) {
  return request<ImGroup>("/api/groups", token, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function addGroupMembers(token: string, groupId: number, usernames: string[]) {
  return request<ImGroup>(`/api/groups/${groupId}/members`, token, {
    method: "POST",
    body: JSON.stringify({ usernames }),
  })
}

export function updateGroup(token: string, groupId: number, payload: { name?: string; announcement?: string }) {
  return request<ImGroup>(`/api/groups/${groupId}`, token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export function removeGroupMember(token: string, groupId: number, username: string) {
  return request<{ deleted: boolean }>(`/api/groups/${groupId}/members/by-username/${encodeURIComponent(username)}`, token, {
    method: "DELETE",
  })
}

export function transferGroupOwner(token: string, groupId: number, username: string) {
  return request<ImGroup>(`/api/groups/${groupId}/owner`, token, {
    method: "POST",
    body: JSON.stringify({ username }),
  })
}

export function updateGroupNickname(token: string, groupId: number, nickname: string) {
  return request<ImGroup>(`/api/groups/${groupId}/members/me`, token, {
    method: "PATCH",
    body: JSON.stringify({ nickname }),
  })
}

export function markGroupRead(token: string, groupId: number, messageId?: string | number) {
  const params = messageId ? `?message_id=${encodeURIComponent(String(messageId))}` : ""
  return request<{ group_id: number; reader: string; last_read_message_id: number }>(`/api/groups/${groupId}/read${params}`, token, {
    method: "POST",
  })
}

export function exitGroup(token: string, groupId: number) {
  return request<{ deleted: boolean }>(`/api/groups/${groupId}/members/me`, token, { method: "DELETE" })
}

export function getGroupMessages(token: string, groupId: number, beforeId?: string | number, limit = 100) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (beforeId) params.set("before_id", String(beforeId))
  return request<ImMessage[]>(`/api/groups/${groupId}/messages?${params.toString()}`, token)
}

export function updateUser(token: string, username: string, payload: { name?: string; email?: string; phone?: string; signature?: string; avatar?: string }) {
  return request<ImUser>(`/api/users/${encodeURIComponent(username)}`, token, {
    method: "PATCH",
    body: JSON.stringify({
      display_name: payload.name,
      email: payload.email,
      phone: payload.phone,
      signature: payload.signature,
      avatar: payload.avatar,
    }),
  })
}

export function getAdminOverview(token: string) {
  return request<AdminOverview>("/api/admin/overview", token)
}

export function getAdminUsers(token: string) {
  return request<ImUser[]>("/api/admin/users", token)
}

export function getAdminOnlineUsers(token: string) {
  return request<string[]>("/api/admin/online-users", token)
}

export function getAdminMessages(token: string) {
  return request<ImMessage[]>("/api/admin/messages", token)
}

export function createSocket(username: string, token: string) {
  const wsBase = apiBase().replace(/^http/, "ws")
  return new WebSocket(`${wsBase}/ws/${encodeURIComponent(username)}?token=${encodeURIComponent(token)}`)
}
