import { StrictMode, useEffect, useMemo, useState } from "react"
import type { FormEvent } from "react"
import { createRoot } from "react-dom/client"
import {
  assignDepartmentMember,
  createDepartment,
  createSensitiveWord,
  deleteDepartment,
  deleteFriendship,
  deleteSensitiveWord,
  dissolveGroup,
  getAdminGroups,
  getAttachmentDownloadLogs,
  getAttachments,
  getFriendRequests,
  getFriendships,
  getMessageAudits,
  getMessages,
  getOnlineUsers,
  getOperationLogs,
  getOverview,
  getSystemConfigs,
  getTrends,
  getUploadPolicy,
  getCompanySettings,
  getDepartmentTree,
  getSensitiveWords,
  getUsers,
  login,
  resetUserPassword,
  removeDepartmentMember,
  setUserDisabled,
  updateCompanySettings,
  updateSensitiveWord,
  updateSystemConfig,
  type AdminAttachment,
  type AttachmentDownloadLog,
  type AdminFriendRequest,
  type AdminFriendship,
  type AdminGroup,
  type AdminMessage,
  type AdminOverview,
  type AdminTrend,
  type AdminUser,
  type CompanySettings,
  type DepartmentNode,
  type OperationLog,
  type MessageAuditLog,
  type SensitiveWord,
  type SystemConfig,
  type UploadPolicy,
} from "./api"
import "./styles.css"

type Tab = "dashboard" | "users" | "friendships" | "messages" | "requests" | "attachments" | "sensitive" | "org" | "groups" | "configs" | "logs"
type MessageFilters = { keyword: string; username: string; msg_type: string; date_from: string; date_to: string }
type AttachmentFilters = { category: string; uploader: string; date_from: string; date_to: string }

const emptyMessageFilters: MessageFilters = { keyword: "", username: "", msg_type: "", date_from: "", date_to: "" }
const emptyAttachmentFilters: AttachmentFilters = { category: "", uploader: "", date_from: "", date_to: "" }

function App() {
  const [token, setToken] = useState(() => window.localStorage.getItem("admin-token") || "")
  const [adminName, setAdminName] = useState(() => window.localStorage.getItem("admin-name") || "")
  const [tab, setTab] = useState<Tab>("dashboard")
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const [messages, setMessages] = useState<AdminMessage[]>([])
  const [messageAudits, setMessageAudits] = useState<MessageAuditLog[]>([])
  const [friendRequests, setFriendRequests] = useState<AdminFriendRequest[]>([])
  const [friendships, setFriendships] = useState<AdminFriendship[]>([])
  const [attachments, setAttachments] = useState<AdminAttachment[]>([])
  const [attachmentLogs, setAttachmentLogs] = useState<AttachmentDownloadLog[]>([])
  const [uploadPolicy, setUploadPolicy] = useState<UploadPolicy | null>(null)
  const [sensitiveWords, setSensitiveWords] = useState<SensitiveWord[]>([])
  const [company, setCompany] = useState<CompanySettings | null>(null)
  const [orgTree, setOrgTree] = useState<DepartmentNode[]>([])
  const [groups, setGroups] = useState<AdminGroup[]>([])
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([])
  const [trends, setTrends] = useState<AdminTrend[]>([])
  const [systemConfigs, setSystemConfigs] = useState<SystemConfig[]>([])
  const [filter, setFilter] = useState("")
  const [messageFilters, setMessageFilters] = useState<MessageFilters>(emptyMessageFilters)
  const [attachmentFilters, setAttachmentFilters] = useState<AttachmentFilters>(emptyAttachmentFilters)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) return
    refresh()
    const timer = window.setInterval(refresh, 5000)
    return () => window.clearInterval(timer)
  }, [token])

  function handleLogin(nextToken: string, username: string) {
    window.localStorage.setItem("admin-token", nextToken)
    window.localStorage.setItem("admin-name", username)
    setToken(nextToken)
    setAdminName(username)
  }

  function handleLogout() {
    window.localStorage.removeItem("admin-token")
    window.localStorage.removeItem("admin-name")
    setToken("")
    setAdminName("")
  }

  async function refresh(filters = messageFilters, resourceFilters = attachmentFilters) {
    if (!token) return
    setLoading(true)
    setError("")
    try {
      const [
        nextOverview,
        nextUsers,
        nextOnlineUsers,
        nextMessages,
        nextMessageAudits,
        nextFriendRequests,
        nextFriendships,
        nextAttachments,
        nextAttachmentLogs,
        nextUploadPolicy,
        nextSensitiveWords,
        nextCompany,
        nextOrgTree,
        nextGroups,
        nextOperationLogs,
        nextTrends,
        nextSystemConfigs,
      ] = await Promise.all([
        getOverview(token),
        getUsers(token),
        getOnlineUsers(token),
        getMessages(token, filters),
        getMessageAudits(token),
        getFriendRequests(token),
        getFriendships(token),
        getAttachments(token, resourceFilters),
        getAttachmentDownloadLogs(token),
        getUploadPolicy(token),
        getSensitiveWords(token),
        getCompanySettings(token),
        getDepartmentTree(token),
        getAdminGroups(token),
        getOperationLogs(token),
        getTrends(token),
        getSystemConfigs(token),
      ])
      setOverview(nextOverview)
      setUsers(nextUsers)
      setOnlineUsers(nextOnlineUsers)
      setMessages(nextMessages)
      setMessageAudits(nextMessageAudits)
      setFriendRequests(nextFriendRequests)
      setFriendships(nextFriendships)
      setAttachments(nextAttachments)
      setAttachmentLogs(nextAttachmentLogs)
      setUploadPolicy(nextUploadPolicy)
      setSensitiveWords(nextSensitiveWords)
      setCompany(nextCompany)
      setOrgTree(nextOrgTree)
      setGroups(nextGroups)
      setOperationLogs(nextOperationLogs)
      setTrends(nextTrends)
      setSystemConfigs(nextSystemConfigs)
    } catch (err) {
      setError(err instanceof Error ? err.message : "后台数据加载失败")
    } finally {
      setLoading(false)
    }
  }

  async function toggleUser(user: AdminUser) {
    try {
      const next = await setUserDisabled(token, user.username, !user.disabled)
      setUsers((items) => items.map((item) => (item.username === next.username ? next : item)))
      setNotice(next.disabled ? "用户已禁用" : "用户已启用")
    } catch (err) {
      setError(err instanceof Error ? err.message : "用户状态修改失败")
    }
  }

  async function handleResetPassword(user: AdminUser) {
    const password = window.prompt(`请输入 ${user.name} 的新密码（6-32 位，至少包含字母和数字）`, "abc123")
    if (!password) return
    try {
      await resetUserPassword(token, user.username, password)
      setNotice("密码已重置")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "重置密码失败")
    }
  }

  async function handleDeleteFriendship(item: AdminFriendship) {
    if (!window.confirm(`确认解除 ${item.user_a_name} 和 ${item.user_b_name} 的好友关系？`)) return
    try {
      await deleteFriendship(token, item.id)
      setNotice("好友关系已解除")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "解除好友关系失败")
    }
  }

  async function handleCreateSensitiveWord(word: string) {
    if (!word.trim()) return
    try {
      await createSensitiveWord(token, word.trim(), true)
      setNotice("敏感词已新增")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增敏感词失败")
    }
  }

  async function handleToggleSensitiveWord(item: SensitiveWord) {
    try {
      await updateSensitiveWord(token, item.id, { enabled: !item.enabled })
      setNotice(item.enabled ? "敏感词已停用" : "敏感词已启用")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "修改敏感词失败")
    }
  }

  async function handleDeleteSensitiveWord(item: SensitiveWord) {
    if (!window.confirm(`确认删除敏感词“${item.word}”？`)) return
    try {
      await deleteSensitiveWord(token, item.id)
      setNotice("敏感词已删除")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除敏感词失败")
    }
  }

  async function handleSaveCompany(payload: { name: string; description: string }) {
    try {
      await updateCompanySettings(token, payload)
      setNotice("企业信息已保存")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存企业信息失败")
    }
  }

  async function handleCreateDepartment(payload: { name: string; parent_id?: number | null; sort_order?: number; description?: string }) {
    try {
      await createDepartment(token, payload)
      setNotice("部门已创建")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建部门失败")
    }
  }

  async function handleDeleteDepartment(item: DepartmentNode) {
    if (!window.confirm(`确认删除部门“${item.name}”？`)) return
    try {
      await deleteDepartment(token, item.id)
      setNotice("部门已删除")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除部门失败")
    }
  }

  async function handleAssignMember(departmentId: number, username: string, position: string) {
    try {
      await assignDepartmentMember(token, departmentId, { username, position })
      setNotice("员工已分配到部门")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "分配员工失败")
    }
  }

  async function handleRemoveMember(departmentId: number, username: string) {
    try {
      await removeDepartmentMember(token, departmentId, username)
      setNotice("员工已移出部门")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "移除员工失败")
    }
  }

  async function handleDissolveGroup(group: AdminGroup) {
    if (!window.confirm(`确认解散群聊“${group.name}”？`)) return
    try {
      await dissolveGroup(token, group.id)
      setNotice("群聊已解散")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "解散群聊失败")
    }
  }

  async function handleUpdateSystemConfig(key: string, value: string) {
    try {
      const updated = await updateSystemConfig(token, key, value)
      setSystemConfigs((items) => items.map((item) => (item.key === key ? updated : item)))
      setNotice("系统配置已保存")
    } catch (err) {
      setError(err instanceof Error ? err.message : "系统配置保存失败")
    }
  }

  const lowerFilter = filter.toLowerCase()
  const filteredUsers = useMemo(
    () => users.filter((user) => `${user.username} ${user.name}`.toLowerCase().includes(lowerFilter)),
    [users, lowerFilter],
  )
  const filteredMessages = useMemo(
    () => messages.filter((message) => `${message.sender} ${message.receiver} ${message.content}`.toLowerCase().includes(lowerFilter)),
    [messages, lowerFilter],
  )
  const filteredFriendships = useMemo(
    () => friendships.filter((item) => `${item.user_a} ${item.user_b} ${item.user_a_name} ${item.user_b_name}`.toLowerCase().includes(lowerFilter)),
    [friendships, lowerFilter],
  )
  const filteredRequests = useMemo(
    () => friendRequests.filter((item) => `${item.from_user} ${item.to_user} ${item.message}`.toLowerCase().includes(lowerFilter)),
    [friendRequests, lowerFilter],
  )
  const filteredAttachments = useMemo(
    () => attachments.filter((item) => `${item.original_name} ${item.uploader} ${item.category}`.toLowerCase().includes(lowerFilter)),
    [attachments, lowerFilter],
  )

  if (!token) return <LoginScreen onLogin={handleLogin} />

  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <div className="brand">IM 管理后台</div>
        <nav>
          <button className={tab === "dashboard" ? "active" : ""} onClick={() => setTab("dashboard")}>数据大盘</button>
          <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>用户管理</button>
          <button className={tab === "friendships" ? "active" : ""} onClick={() => setTab("friendships")}>好友关系</button>
          <button className={tab === "messages" ? "active" : ""} onClick={() => setTab("messages")}>消息审计</button>
          <button className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")}>好友申请</button>
          <button className={tab === "attachments" ? "active" : ""} onClick={() => setTab("attachments")}>资源审计</button>
          <button className={tab === "sensitive" ? "active" : ""} onClick={() => setTab("sensitive")}>敏感词</button>
          <button className={tab === "org" ? "active" : ""} onClick={() => setTab("org")}>组织架构</button>
          <button className={tab === "groups" ? "active" : ""} onClick={() => setTab("groups")}>群管理</button>
          <button className={tab === "configs" ? "active" : ""} onClick={() => setTab("configs")}>系统配置</button>
          <button className={tab === "logs" ? "active" : ""} onClick={() => setTab("logs")}>操作日志</button>
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <h1>{tabLabel(tab)}</h1>
            <p>后端：http://127.0.0.1:8000 · 管理员：{maskUsername(adminName)}</p>
          </div>
          <div className="actions">
            <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="搜索用户、消息或好友关系" />
            <button onClick={() => refresh()}>{loading ? "刷新中..." : "刷新"}</button>
            <button className="secondary" onClick={handleLogout}>退出</button>
          </div>
        </header>

        {notice && <div className="notice">{notice}</div>}
        {error && <div className="error">{error}</div>}

        {tab === "dashboard" && <Dashboard overview={overview} onlineUsers={onlineUsers} trends={trends} />}
        {tab === "users" && <UsersTable users={filteredUsers} onToggleUser={toggleUser} onResetPassword={handleResetPassword} />}
        {tab === "friendships" && <FriendshipsTable friendships={filteredFriendships} onDelete={handleDeleteFriendship} />}
        {tab === "messages" && (
          <MessagesAudit
            messages={filteredMessages}
            audits={messageAudits}
            filters={messageFilters}
            onFiltersChange={setMessageFilters}
            onSearch={() => refresh(messageFilters)}
          />
        )}
        {tab === "requests" && <RequestsTable requests={filteredRequests} />}
        {tab === "attachments" && (
          <AttachmentsTable
            attachments={filteredAttachments}
            logs={attachmentLogs}
            policy={uploadPolicy}
            filters={attachmentFilters}
            onFiltersChange={setAttachmentFilters}
            onSearch={() => refresh(messageFilters, attachmentFilters)}
          />
        )}
        {tab === "sensitive" && <SensitiveWordsTable words={sensitiveWords} onCreate={handleCreateSensitiveWord} onToggle={handleToggleSensitiveWord} onDelete={handleDeleteSensitiveWord} />}
        {tab === "org" && (
          <OrganizationPanel
            company={company}
            departments={orgTree}
            users={users}
            onSaveCompany={handleSaveCompany}
            onCreateDepartment={handleCreateDepartment}
            onDeleteDepartment={handleDeleteDepartment}
            onAssignMember={handleAssignMember}
            onRemoveMember={handleRemoveMember}
          />
        )}
        {tab === "groups" && <GroupsTable groups={groups} onDissolve={handleDissolveGroup} />}
        {tab === "configs" && <SystemConfigsTable configs={systemConfigs} onSave={handleUpdateSystemConfig} />}
        {tab === "logs" && <OperationLogsTable logs={operationLogs} />}
      </section>
    </main>
  )
}

function LoginScreen({ onLogin }: { onLogin: (token: string, username: string) => void }) {
  const [username, setUsername] = useState("admin")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError("")
    try {
      const result = await login(username.trim(), password)
      if (!["admin", "operator", "audit", "readonly"].includes(result.user.role || "")) {
        setError("只有管理员可以进入后台")
        return
      }
      onLogin(result.token, result.user.username)
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand">IM 管理后台</div>
        <h1>管理员登录</h1>
        <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="管理员账号" />
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="密码" />
        <button disabled={loading || !username.trim() || !password}>{loading ? "登录中..." : "登录"}</button>
        {error && <div className="error">{error}</div>}
      </form>
    </main>
  )
}

function tabLabel(tab: Tab) {
  return {
    dashboard: "数据大盘",
    users: "用户管理",
    friendships: "好友关系查询",
    messages: "消息审计",
    requests: "好友申请审计",
    attachments: "资源审计",
    sensitive: "敏感词管理",
    org: "组织架构",
    groups: "群管理",
    configs: "系统配置",
    logs: "操作日志",
  }[tab]
}

function Dashboard({ overview, onlineUsers, trends }: { overview: AdminOverview | null; onlineUsers: string[]; trends: AdminTrend[] }) {
  const metrics = [
    ["用户总数", overview?.users ?? 0],
    ["日活用户", overview?.daily_active_users ?? 0],
    ["消息总数", overview?.messages ?? 0],
    ["今日消息", overview?.today_messages ?? 0],
    ["会话总数", overview?.conversations ?? 0],
    ["好友关系", overview?.friendships ?? 0],
    ["待处理申请", overview?.pending_friend_requests ?? 0],
    ["在线用户", overview?.online_users ?? 0],
    ["群聊数量", overview?.groups ?? 0],
    ["附件数量", overview?.attachments ?? 0],
    ["存储占用", formatBytes(overview?.attachment_storage_bytes ?? 0)],
    ["下载日志", overview?.download_logs ?? 0],
  ] as const
  const messageTypes = Object.entries(overview?.message_types || {})
  const maxTypeCount = Math.max(1, ...messageTypes.map(([, count]) => count))

  return (
    <>
      <section className="metric-grid">
        {metrics.map(([label, value]) => (
          <article key={label} className="metric-card">
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>在线用户</h2>
        <div className="tag-list">
          {onlineUsers.length ? onlineUsers.map((user) => <span key={user}>{maskUsername(user)}</span>) : <em>暂无在线 WebSocket 用户</em>}
        </div>
      </section>
      <section className="panel padded">
        <h2>近 7 日趋势</h2>
        <div className="trend-grid">
          {trends.map((item) => (
            <article key={item.date}>
              <b>{item.date.slice(5)}</b>
              <span>消息 {item.messages}</span>
              <span>活跃 {item.active_users}</span>
              <span>新增用户 {item.new_users}</span>
              <span>新增群 {item.new_groups}</span>
            </article>
          ))}
          {!trends.length && <em>暂无趋势数据</em>}
        </div>
      </section>
      <section className="dashboard-grid">
        <article className="panel padded">
          <h2>消息类型分布</h2>
          <div className="bar-list">
            {messageTypes.length ? messageTypes.map(([type, count]) => (
              <div key={type} className="bar-row">
                <span>{messageTypeText(type)}</span>
                <b style={{ width: `${Math.max(8, (count / maxTypeCount) * 100)}%` }} />
                <em>{count}</em>
              </div>
            )) : <em>暂无消息数据</em>}
          </div>
        </article>
        <article className="panel padded">
          <h2>运维风险摘要</h2>
          <div className="risk-list">
            <span>待处理好友申请：{overview?.pending_friend_requests ?? 0}</span>
            <span>启用敏感词：{overview?.sensitive_words ?? 0}</span>
            <span>资源占用：{formatBytes(overview?.attachment_storage_bytes ?? 0)}</span>
          </div>
        </article>
        <article className="panel padded">
          <h2>后台角色权限</h2>
          <div className="role-list">
            <span><b>超级管理员</b> 全部管理权限</span>
            <span><b>运营管理员</b> 用户、组织、群和资源运维</span>
            <span><b>审计管理员</b> 消息、日志和安全审计</span>
            <span><b>只读运维</b> 查看数据，不执行修改</span>
          </div>
        </article>
      </section>
    </>
  )
}

function UsersTable({ users, onToggleUser, onResetPassword }: { users: AdminUser[]; onToggleUser: (user: AdminUser) => void; onResetPassword: (user: AdminUser) => void }) {
  return (
    <section className="panel">
      <table>
        <thead>
          <tr>
            <th>用户</th>
            <th>登录状态</th>
            <th>联系方式</th>
            <th>签名</th>
            <th>账号状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.username}>
              <td>
                <div className="user-cell">
                  <img src={user.avatar} alt="" />
                  <div>
                    <strong title={user.name}>{user.name}</strong>
                    <span>{maskUsername(user.username)}</span>
                  </div>
                </div>
              </td>
              <td><b className={user.status}>{statusText(user.status)}</b></td>
              <td title={user.email || user.phone || "-"}>{maskContact(user.email || user.phone)}</td>
              <td title={user.signature || "-"}>{user.signature || "-"}</td>
              <td>{user.disabled ? "已禁用" : "正常"} / {roleText(user.role)}</td>
              <td>
                <button className={user.disabled ? "enable" : "danger"} onClick={() => onToggleUser(user)}>
                  {user.disabled ? "启用" : "禁用"}
                </button>
                <button className="secondary-action" onClick={() => onResetPassword(user)}>重置密码</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function FriendshipsTable({ friendships, onDelete }: { friendships: AdminFriendship[]; onDelete: (item: AdminFriendship) => void }) {
  return (
    <section className="panel">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>用户 A</th>
            <th>用户 B</th>
            <th>备注 A</th>
            <th>备注 B</th>
            <th>来源</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {friendships.map((item) => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td className="truncate" title={item.user_a_name}>{item.user_a_name} / {maskUsername(item.user_a)}</td>
              <td className="truncate" title={item.user_b_name}>{item.user_b_name} / {maskUsername(item.user_b)}</td>
              <td title={item.remark_a || "-"}>{item.remark_a || "-"}</td>
              <td title={item.remark_b || "-"}>{item.remark_b || "-"}</td>
              <td>{sourceText(item.source)}</td>
              <td>{new Date(item.created_at).toLocaleString()}</td>
              <td><button className="danger" onClick={() => onDelete(item)}>解除关系</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function MessagesAudit({
  messages,
  audits,
  filters,
  onFiltersChange,
  onSearch,
}: {
  messages: AdminMessage[]
  audits: MessageAuditLog[]
  filters: MessageFilters
  onFiltersChange: (filters: MessageFilters) => void
  onSearch: () => void
}) {
  const typeCounts = messages.reduce<Record<string, number>>((acc, item) => {
    acc[item.msg_type] = (acc[item.msg_type] || 0) + 1
    return acc
  }, {})
  return (
    <section className="panel">
      <div className="filter-bar">
        <input value={filters.keyword} onChange={(event) => onFiltersChange({ ...filters, keyword: event.target.value })} placeholder="关键词" />
        <input value={filters.username} onChange={(event) => onFiltersChange({ ...filters, username: event.target.value })} placeholder="发送人或接收人" />
        <select value={filters.msg_type} onChange={(event) => onFiltersChange({ ...filters, msg_type: event.target.value })}>
          <option value="">全部类型</option>
          <option value="text">文本</option>
          <option value="image">图片</option>
          <option value="file">文件</option>
          <option value="audio">语音</option>
          <option value="card">名片</option>
          <option value="system">系统</option>
        </select>
        <input type="datetime-local" value={filters.date_from} onChange={(event) => onFiltersChange({ ...filters, date_from: event.target.value })} />
        <input type="datetime-local" value={filters.date_to} onChange={(event) => onFiltersChange({ ...filters, date_to: event.target.value })} />
        <button onClick={onSearch}>筛选</button>
      </div>
      <div className="audit-summary">
        <span>当前结果：{messages.length} 条</span>
        <span>编辑/撤回审计：{audits.length} 条</span>
        {Object.entries(typeCounts).map(([type, count]) => <span key={type}>{messageTypeText(type)}：{count}</span>)}
      </div>
      <MessagesTable messages={messages} />
      <h3>编辑/撤回审计</h3>
      <MessageAuditTable audits={audits} />
    </section>
  )
}

function MessageAuditTable({ audits }: { audits: MessageAuditLog[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>消息ID</th>
          <th>操作人</th>
          <th>动作</th>
          <th>原内容</th>
          <th>新内容</th>
          <th>时间</th>
        </tr>
      </thead>
      <tbody>
        {audits.map((item) => (
          <tr key={item.id}>
            <td>{item.id}</td>
            <td>{item.message_id}</td>
            <td>{maskUsername(item.operator)}</td>
            <td>{item.action === "edit" ? "编辑" : item.action === "recall" ? "撤回" : item.action}</td>
            <td className="message-content" title={item.old_content || "-"}>{item.old_content || "-"}</td>
            <td className="message-content" title={item.new_content || "-"}>{item.new_content || "-"}</td>
            <td>{new Date(item.created_at).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function MessagesTable({ messages }: { messages: AdminMessage[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>会话</th>
          <th>发送人</th>
          <th>接收人</th>
          <th>类型</th>
          <th>内容</th>
          <th>创建时间</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        {messages.map((message) => (
          <tr key={message.id}>
            <td>{message.id}</td>
            <td className="truncate" title={message.conversation_id}>{maskConversation(message.conversation_id)}</td>
            <td className="truncate">{maskUsername(message.sender)}</td>
            <td className="truncate">{maskUsername(message.receiver)}</td>
            <td>{messageTypeText(message.msg_type)}</td>
            <td className="message-content" title={message.content}>{message.content}</td>
            <td>{new Date(message.created_at).toLocaleString()}</td>
            <td>{messageStatusText(message.status)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RequestsTable({ requests }: { requests: AdminFriendRequest[] }) {
  return (
    <section className="panel">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>申请人</th>
            <th>接收人</th>
            <th>验证消息</th>
            <th>状态</th>
            <th>更新时间</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((item) => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td className="truncate">{maskUsername(item.from_user)}</td>
              <td className="truncate">{maskUsername(item.to_user)}</td>
              <td className="message-content" title={item.message || "-"}>{item.message || "-"}</td>
              <td><b className={item.status}>{requestStatusText(item.status)}</b></td>
              <td>{new Date(item.updated_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function AttachmentsTable({
  attachments,
  logs,
  policy,
  filters,
  onFiltersChange,
  onSearch,
}: {
  attachments: AdminAttachment[]
  logs: AttachmentDownloadLog[]
  policy: UploadPolicy | null
  filters: AttachmentFilters
  onFiltersChange: (filters: AttachmentFilters) => void
  onSearch: () => void
}) {
  return (
    <section className="panel">
      <div className="filter-bar">
        <select value={filters.category} onChange={(event) => onFiltersChange({ ...filters, category: event.target.value })}>
          <option value="">全部类型</option>
          <option value="image">图片</option>
          <option value="audio">音频</option>
          <option value="file">文件</option>
        </select>
        <input value={filters.uploader} onChange={(event) => onFiltersChange({ ...filters, uploader: event.target.value })} placeholder="上传人" />
        <input type="datetime-local" value={filters.date_from} onChange={(event) => onFiltersChange({ ...filters, date_from: event.target.value })} />
        <input type="datetime-local" value={filters.date_to} onChange={(event) => onFiltersChange({ ...filters, date_to: event.target.value })} />
        <button onClick={onSearch}>筛选</button>
      </div>
      {policy && (
        <div className="policy-box">
          <strong>上传策略</strong>
          <span>图片 {formatBytes(policy.limits.image || 0)} / 音频 {formatBytes(policy.limits.audio || 0)} / 文件 {formatBytes(policy.limits.file || 0)}</span>
          <small>允许类型：{policy.allowed_suffixes.join(" ")}</small>
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>文件名</th>
            <th>类型</th>
            <th>大小</th>
            <th>上传人</th>
            <th>消息 ID</th>
            <th>上传时间</th>
          </tr>
        </thead>
        <tbody>
          {attachments.map((item) => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td className="message-content" title={item.original_name}>{item.original_name}</td>
              <td>{attachmentCategoryText(item.category)}</td>
              <td>{formatBytes(item.size)}</td>
              <td>{maskUsername(item.uploader)}</td>
              <td>{item.message_id || "-"}</td>
              <td>{new Date(item.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>下载日志</h3>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>附件 ID</th>
            <th>文件名</th>
            <th>下载人</th>
            <th>下载时间</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((item) => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td>{item.attachment_id}</td>
              <td className="message-content" title={item.original_name}>{item.original_name}</td>
              <td>{maskUsername(item.downloader)}</td>
              <td>{new Date(item.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function SensitiveWordsTable({
  words,
  onCreate,
  onToggle,
  onDelete,
}: {
  words: SensitiveWord[]
  onCreate: (word: string) => void
  onToggle: (item: SensitiveWord) => void
  onDelete: (item: SensitiveWord) => void
}) {
  const [word, setWord] = useState("")
  return (
    <section className="panel">
      <div className="filter-bar">
        <input value={word} onChange={(event) => setWord(event.target.value)} placeholder="输入敏感词" />
        <button onClick={() => { onCreate(word); setWord("") }}>新增</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>敏感词</th>
            <th>状态</th>
            <th>创建人</th>
            <th>更新时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {words.map((item) => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td>{item.word}</td>
              <td>{item.enabled ? "启用" : "停用"}</td>
              <td>{maskUsername(item.created_by)}</td>
              <td>{new Date(item.updated_at).toLocaleString()}</td>
              <td>
                <button onClick={() => onToggle(item)}>{item.enabled ? "停用" : "启用"}</button>
                <button className="danger" onClick={() => onDelete(item)}>删除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function OrganizationPanel({
  company,
  departments,
  users,
  onSaveCompany,
  onCreateDepartment,
  onDeleteDepartment,
  onAssignMember,
  onRemoveMember,
}: {
  company: CompanySettings | null
  departments: DepartmentNode[]
  users: AdminUser[]
  onSaveCompany: (payload: { name: string; description: string }) => void
  onCreateDepartment: (payload: { name: string; parent_id?: number | null; sort_order?: number; description?: string }) => void
  onDeleteDepartment: (item: DepartmentNode) => void
  onAssignMember: (departmentId: number, username: string, position: string) => void
  onRemoveMember: (departmentId: number, username: string) => void
}) {
  const flatDepartments = flattenDepartments(departments)
  const [companyName, setCompanyName] = useState(company?.name || "")
  const [companyDescription, setCompanyDescription] = useState(company?.description || "")
  const [deptName, setDeptName] = useState("")
  const [parentId, setParentId] = useState("")
  const [description, setDescription] = useState("")
  const [assignDepartmentId, setAssignDepartmentId] = useState("")
  const [assignUsername, setAssignUsername] = useState("")
  const [position, setPosition] = useState("")

  useEffect(() => {
    setCompanyName(company?.name || "")
    setCompanyDescription(company?.description || "")
  }, [company?.name, company?.description])

  return (
    <section className="org-layout">
      <div className="panel org-form-panel">
        <h2>企业信息</h2>
        <div className="filter-bar">
          <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="企业名称" />
          <input value={companyDescription} onChange={(event) => setCompanyDescription(event.target.value)} placeholder="企业说明" />
          <button onClick={() => onSaveCompany({ name: companyName.trim(), description: companyDescription.trim() })}>保存</button>
        </div>
      </div>

      <div className="panel org-form-panel">
        <h2>部门管理</h2>
        <div className="filter-bar">
          <input value={deptName} onChange={(event) => setDeptName(event.target.value)} placeholder="部门名称" />
          <select value={parentId} onChange={(event) => setParentId(event.target.value)}>
            <option value="">无上级部门</option>
            {flatDepartments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="部门说明" />
          <button onClick={() => {
            onCreateDepartment({ name: deptName.trim(), parent_id: parentId ? Number(parentId) : null, description: description.trim() })
            setDeptName("")
            setDescription("")
          }}>新增部门</button>
        </div>
      </div>

      <div className="panel org-form-panel">
        <h2>员工分配</h2>
        <div className="filter-bar">
          <select value={assignDepartmentId} onChange={(event) => setAssignDepartmentId(event.target.value)}>
            <option value="">选择部门</option>
            {flatDepartments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select value={assignUsername} onChange={(event) => setAssignUsername(event.target.value)}>
            <option value="">选择员工</option>
            {users.filter((user) => user.role !== "admin").map((user) => <option key={user.username} value={user.username}>{user.name} / {user.username}</option>)}
          </select>
          <input value={position} onChange={(event) => setPosition(event.target.value)} placeholder="职位，例如：前端工程师" />
          <button disabled={!assignDepartmentId || !assignUsername} onClick={() => onAssignMember(Number(assignDepartmentId), assignUsername, position.trim())}>分配</button>
        </div>
      </div>

      <section className="panel">
        <h2>部门树</h2>
        <div className="org-tree-admin">
          {departments.length ? departments.map((item) => (
            <AdminDepartmentNode
              key={item.id}
              node={item}
              onDeleteDepartment={onDeleteDepartment}
              onRemoveMember={onRemoveMember}
            />
          )) : <p className="empty-state">暂无部门，请先新增部门。</p>}
        </div>
      </section>
    </section>
  )
}

function AdminDepartmentNode({
  node,
  onDeleteDepartment,
  onRemoveMember,
}: {
  node: DepartmentNode
  onDeleteDepartment: (item: DepartmentNode) => void
  onRemoveMember: (departmentId: number, username: string) => void
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="org-node-admin">
      <div className="org-node-title">
        <button className="secondary-action" onClick={() => setOpen(!open)}>{open ? "收起" : "展开"}</button>
        <strong>{node.name}</strong>
        <span>{node.members.length} 人</span>
        <button className="danger" onClick={() => onDeleteDepartment(node)}>删除部门</button>
      </div>
      {open && (
        <div className="org-node-body">
          {node.members.map((member) => (
            <div className="org-member-row" key={member.username}>
              <img src={member.avatar} alt="" />
              <span><b>{member.name}</b><small>{member.position || "未设置职位"} · {member.status === "online" ? "在线" : "离线"}</small></span>
              <button className="secondary-action" onClick={() => onRemoveMember(node.id, member.username)}>移出</button>
            </div>
          ))}
          {node.children.map((child) => (
            <AdminDepartmentNode key={child.id} node={child} onDeleteDepartment={onDeleteDepartment} onRemoveMember={onRemoveMember} />
          ))}
        </div>
      )}
    </div>
  )
}

function GroupsTable({ groups, onDissolve }: { groups: AdminGroup[]; onDissolve: (group: AdminGroup) => void }) {
  return (
    <section className="panel">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>群名称</th>
            <th>群主</th>
            <th>公告</th>
            <th>成员</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.id}>
              <td>{group.id}</td>
              <td className="truncate" title={group.name}>{group.name}</td>
              <td>{maskUsername(group.owner)}</td>
              <td className="message-content" title={group.announcement || "-"}>{group.announcement || "-"}</td>
              <td className="message-content">
                {group.members.map((member) => `${member.name}(${member.username})`).join("、") || "-"}
              </td>
              <td>{group.dissolved ? "已解散" : "正常"}</td>
              <td>{new Date(group.created_at).toLocaleString()}</td>
              <td><button className="danger" disabled={group.dissolved} onClick={() => onDissolve(group)}>解散</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function SystemConfigsTable({ configs, onSave }: { configs: SystemConfig[]; onSave: (key: string, value: string) => void }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  return (
    <section className="panel">
      <table>
        <thead>
          <tr>
            <th>配置项</th>
            <th>说明</th>
            <th>当前值</th>
            <th>更新时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {configs.map((item) => {
            const value = drafts[item.key] ?? item.value
            return (
              <tr key={item.key}>
                <td className="truncate" title={item.key}>{item.key}</td>
                <td>{item.description || "-"}</td>
                <td><input value={value} onChange={(event) => setDrafts((current) => ({ ...current, [item.key]: event.target.value }))} /></td>
                <td>{new Date(item.updated_at).toLocaleString()}</td>
                <td><button onClick={() => onSave(item.key, value)}>保存</button></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

function OperationLogsTable({ logs }: { logs: OperationLog[] }) {
  const [query, setQuery] = useState("")
  const filteredLogs = logs.filter((item) => `${item.operator} ${item.action} ${item.target} ${item.detail}`.toLowerCase().includes(query.trim().toLowerCase()))
  return (
    <section className="panel">
      <div className="filter-bar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索操作人、动作、目标、详情" />
      </div>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>操作人</th>
            <th>动作</th>
            <th>目标</th>
            <th>详情</th>
            <th>时间</th>
          </tr>
        </thead>
        <tbody>
          {filteredLogs.map((item) => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td>{maskUsername(item.operator)}</td>
              <td>{actionText(item.action)}</td>
              <td className="truncate">{item.target || "-"}</td>
              <td className="message-content">{item.detail || "-"}</td>
              <td>{new Date(item.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function statusText(status: AdminUser["status"]) {
  return status === "online" ? "在线" : status === "busy" ? "忙碌" : status === "away" ? "离开" : "离线"
}

function messageStatusText(status: string) {
  return status === "read" ? "已读" : status === "sent" ? "已发送" : status === "recalled" ? "已撤回" : status
}

function requestStatusText(status: AdminFriendRequest["status"]) {
  return status === "pending" ? "待处理" : status === "accepted" ? "已通过" : "已拒绝"
}

function roleText(role?: string) {
  return role === "admin" ? "超级管理员" : role === "operator" ? "运营管理员" : role === "audit" ? "审计管理员" : role === "readonly" ? "只读运维" : "普通用户"
}

function actionText(action: string) {
  const map: Record<string, string> = {
    admin_login: "管理员登录",
    user_disabled_update: "禁用/启用用户",
    reset_password: "重置密码",
    delete_friendship: "解除好友关系",
    create_sensitive_word: "新增敏感词",
    update_sensitive_word: "修改敏感词",
    delete_sensitive_word: "删除敏感词",
  }
  return map[action] || action
}

function sourceText(source: string) {
  return source === "friend_request" ? "好友申请" : source
}

function messageTypeText(type: string) {
  const map: Record<string, string> = { text: "文本", image: "图片", file: "文件", audio: "语音", card: "名片", system: "系统" }
  return map[type] || type
}

function flattenDepartments(items: DepartmentNode[]): DepartmentNode[] {
  return items.flatMap((item) => [item, ...flattenDepartments(item.children || [])])
}

function maskUsername(username = "") {
  if (!username) return "-"
  if (username.length <= 2) return `${username[0]}*`
  return `${username[0]}***${username[username.length - 1]}`
}

function maskConversation(value = "") {
  return value.split(":").map(maskUsername).join(":")
}

function maskContact(value?: string | null) {
  if (!value) return "-"
  if (value.includes("@")) {
    const [name, domain] = value.split("@")
    return `${maskUsername(name)}@${domain}`
  }
  if (value.length <= 4) return "***"
  return `${value.slice(0, 3)}****${value.slice(-2)}`
}

function attachmentCategoryText(category: string) {
  return category === "image" ? "图片" : category === "audio" ? "语音" : "文件"
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
