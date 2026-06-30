export type AdminOverview = {
  users: number
  messages: number
  today_messages?: number
  friendships: number
  pending_friend_requests: number
  conversations: number
  online_users: number
  attachments?: number
  attachment_storage_bytes?: number
  daily_active_users?: number
  groups?: number
  sensitive_words?: number
  download_logs?: number
  message_types?: Record<string, number>
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

export type AdminUser = {
  username: string
  name: string
  avatar: string
  status: "online" | "offline" | "busy" | "away"
  email?: string | null
  phone?: string | null
  signature?: string | null
  disabled?: boolean
  role?: "user" | "admin" | string
  created_at?: string
  updated_at?: string
}

export type AuthResult = {
  user: AdminUser
  token: string
}

export type AdminMessage = {
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
}

export type MessageAuditLog = {
  id: number
  message_id: number
  operator: string
  action: "edit" | "recall" | string
  old_content?: string | null
  new_content?: string | null
  created_at: string
}

export type AdminFriendRequest = {
  id: number
  from_user: string
  to_user: string
  message: string
  status: "pending" | "accepted" | "rejected"
  created_at: string
  updated_at: string
}

export type AdminFriendship = {
  id: number
  user_a: string
  user_b: string
  pair_key: string
  remark_a?: string | null
  remark_b?: string | null
  source: string
  created_at: string
  user_a_name: string
  user_b_name: string
}

export type AdminAttachment = {
  id: number
  original_name: string
  mime_type: string
  size: number
  category: string
  url: string
  uploader: string
  message_id?: number | null
  created_at: string
}

export type AttachmentDownloadLog = {
  id: number
  attachment_id: number
  downloader: string
  original_name: string
  created_at: string
}

export type UploadPolicy = {
  allowed_suffixes: string[]
  max_upload_bytes: number
  limits: Record<string, number>
}

export type SensitiveWord = {
  id: number
  word: string
  enabled: number
  created_by: string
  created_at: string
  updated_at: string
}

export type OperationLog = {
  id: number
  operator: string
  action: string
  target: string
  detail: string
  created_at: string
}

export type CompanySettings = {
  id: number
  name: string
  description: string
  updated_at: string
}

export type DepartmentMember = AdminUser & {
  department_id: number
  position: string
}

export type DepartmentNode = {
  id: number
  name: string
  parent_id?: number | null
  sort_order: number
  description: string
  created_at: string
  updated_at: string
  members: DepartmentMember[]
  children: DepartmentNode[]
}

export type AdminGroup = {
  id: number
  name: string
  owner: string
  announcement: string
  dissolved: boolean
  created_at: string
  updated_at: string
  members: AdminUser[]
}

const API_BASE = import.meta.env.VITE_IM_API_BASE || "http://127.0.0.1:8000"

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    })
  } catch {
    throw new Error("无法连接后端服务，请确认后端已启动")
  }

  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) throw new Error(normalizeError(response.status, data))
  return data as T
}

function normalizeError(status: number, body: unknown) {
  const detail = typeof body === "object" && body && "detail" in body ? (body as { detail?: unknown }).detail : ""
  if (typeof detail === "string" && detail) return detail
  if (status === 401) return "管理员账号或密码错误，或登录已失效"
  if (status === 403) return "只有管理员可以进入后台管理系统"
  if (status === 422) return "输入内容不符合规范，请检查后重试"
  if (status >= 500) return "后端服务异常，请查看后端日志"
  return "请求失败，请稍后重试"
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

export function login(username: string, password: string) {
  return request<AuthResult>("/api/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  })
}

export function getOverview(token: string) {
  return request<AdminOverview>("/api/admin/overview", { headers: authHeaders(token) })
}

export function getTrends(token: string) {
  return request<AdminTrend[]>("/api/admin/trends?days=7", { headers: authHeaders(token) })
}

export function getSystemConfigs(token: string) {
  return request<SystemConfig[]>("/api/admin/system-configs", { headers: authHeaders(token) })
}

export function updateSystemConfig(token: string, key: string, value: string) {
  return request<SystemConfig>(`/api/admin/system-configs/${encodeURIComponent(key)}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ value }),
  })
}

export function getUsers(token: string) {
  return request<AdminUser[]>("/api/admin/users", { headers: authHeaders(token) })
}

export function getOnlineUsers(token: string) {
  return request<string[]>("/api/admin/online-users", { headers: authHeaders(token) })
}

export function getMessages(token: string, filters: { keyword?: string; username?: string; msg_type?: string; date_from?: string; date_to?: string } = {}) {
  const params = new URLSearchParams({ limit: "200" })
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  return request<AdminMessage[]>(`/api/admin/messages?${params.toString()}`, { headers: authHeaders(token) })
}

export function getMessageAudits(token: string) {
  return request<MessageAuditLog[]>("/api/admin/message-audits?limit=200", { headers: authHeaders(token) })
}

export function getFriendRequests(token: string) {
  return request<AdminFriendRequest[]>("/api/admin/friend-requests?limit=200", { headers: authHeaders(token) })
}

export function getFriendships(token: string) {
  return request<AdminFriendship[]>("/api/admin/friendships?limit=200", { headers: authHeaders(token) })
}

export function deleteFriendship(token: string, friendshipId: number) {
  return request<{ deleted: boolean }>(`/api/admin/friendships/${friendshipId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  })
}

export function getAttachments(token: string, filters: { category?: string; uploader?: string; date_from?: string; date_to?: string } = {}) {
  const params = new URLSearchParams({ limit: "200" })
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  return request<AdminAttachment[]>(`/api/admin/attachments?${params.toString()}`, { headers: authHeaders(token) })
}

export function getAttachmentDownloadLogs(token: string) {
  return request<AttachmentDownloadLog[]>("/api/admin/attachment-download-logs?limit=200", { headers: authHeaders(token) })
}

export function getUploadPolicy(token: string) {
  return request<UploadPolicy>("/api/admin/upload-policy", { headers: authHeaders(token) })
}

export function setUserDisabled(token: string, username: string, disabled: boolean) {
  return request<AdminUser>(`/api/users/${encodeURIComponent(username)}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ disabled }),
  })
}

export function resetUserPassword(token: string, username: string, password: string) {
  return request<AdminUser>(`/api/admin/users/${encodeURIComponent(username)}/reset-password`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ password }),
  })
}

export function getSensitiveWords(token: string) {
  return request<SensitiveWord[]>("/api/admin/sensitive-words?limit=200", { headers: authHeaders(token) })
}

export function createSensitiveWord(token: string, word: string, enabled = true) {
  return request<SensitiveWord>("/api/admin/sensitive-words", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ word, enabled }),
  })
}

export function updateSensitiveWord(token: string, id: number, payload: { word?: string; enabled?: boolean }) {
  return request<SensitiveWord>(`/api/admin/sensitive-words/${id}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
}

export function deleteSensitiveWord(token: string, id: number) {
  return request<{ deleted: boolean }>(`/api/admin/sensitive-words/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  })
}

export function getOperationLogs(token: string) {
  return request<OperationLog[]>("/api/admin/operation-logs?limit=200", { headers: authHeaders(token) })
}

export function getCompanySettings(token: string) {
  return request<CompanySettings>("/api/admin/org/company", { headers: authHeaders(token) })
}

export function updateCompanySettings(token: string, payload: { name: string; description: string }) {
  return request<CompanySettings>("/api/admin/org/company", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
}

export function getDepartmentTree(token: string) {
  return request<DepartmentNode[]>("/api/admin/org/tree", { headers: authHeaders(token) })
}

export function createDepartment(token: string, payload: { name: string; parent_id?: number | null; sort_order?: number; description?: string }) {
  return request<DepartmentNode>("/api/admin/org/departments", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
}

export function deleteDepartment(token: string, id: number) {
  return request<{ deleted: boolean }>(`/api/admin/org/departments/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  })
}

export function assignDepartmentMember(token: string, departmentId: number, payload: { username: string; position?: string }) {
  return request<DepartmentMember>(`/api/admin/org/departments/${departmentId}/members`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
}

export function removeDepartmentMember(token: string, departmentId: number, username: string) {
  return request<{ deleted: boolean }>(`/api/admin/org/departments/${departmentId}/members/${encodeURIComponent(username)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  })
}

export function getAdminGroups(token: string) {
  return request<AdminGroup[]>("/api/admin/groups?limit=200", { headers: authHeaders(token) })
}

export function dissolveGroup(token: string, groupId: number) {
  return request<{ dissolved: boolean }>(`/api/admin/groups/${groupId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  })
}
