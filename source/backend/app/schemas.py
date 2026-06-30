from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=32)
    password: str = Field(min_length=1, max_length=64)


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=6, max_length=32)
    captcha: str = Field(min_length=1, max_length=8)
    captcha_token: str = Field(min_length=1)
    display_name: str | None = Field(default=None, max_length=64)


class UserProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=64)
    email: str | None = Field(default=None, max_length=128)
    phone: str | None = Field(default=None, max_length=32)
    signature: str | None = Field(default=None, max_length=256)
    avatar: str | None = Field(default=None, max_length=512)
    disabled: bool | None = None


class FriendRequestCreate(BaseModel):
    from_user: str = Field(min_length=1, max_length=32)
    to_user: str = Field(min_length=1, max_length=32)
    message: str = Field(default="", max_length=200)


class FriendRequestAction(BaseModel):
    action: str = Field(pattern="^(accept|reject)$")
    remark: str | None = Field(default=None, max_length=64)


class FriendUpdate(BaseModel):
    remark: str | None = Field(default=None, max_length=64)


class BlacklistCreate(BaseModel):
    reason: str = Field(default="", max_length=200)


class AdminPasswordReset(BaseModel):
    password: str = Field(min_length=6, max_length=32)


class SensitiveWordCreate(BaseModel):
    word: str = Field(min_length=1, max_length=64)
    enabled: bool = True


class SensitiveWordUpdate(BaseModel):
    word: str | None = Field(default=None, min_length=1, max_length=64)
    enabled: bool | None = None


class CompanySettingsUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: str = Field(default="", max_length=500)


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    parent_id: int | None = None
    sort_order: int = 0
    description: str = Field(default="", max_length=300)


class DepartmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    parent_id: int | None = None
    sort_order: int | None = None
    description: str | None = Field(default=None, max_length=300)


class DepartmentMemberAssign(BaseModel):
    username: str = Field(min_length=1, max_length=32)
    position: str = Field(default="", max_length=64)


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    member_usernames: list[str] = Field(default_factory=list, max_length=200)
    announcement: str = Field(default="", max_length=500)


class GroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    announcement: str | None = Field(default=None, max_length=500)


class GroupMembersAdd(BaseModel):
    usernames: list[str] = Field(min_length=1, max_length=200)


class GroupOwnerTransfer(BaseModel):
    username: str = Field(min_length=1, max_length=32)


class GroupNicknameUpdate(BaseModel):
    nickname: str = Field(default="", max_length=64)


class ChatMessageIn(BaseModel):
    type: str = "chat"
    receiver: str = Field(min_length=1, max_length=32)
    content: str = Field(min_length=1, max_length=2000)
    msg_type: str = Field(default="text", pattern="^(text|image|file|audio|card|system)$")
    attachment_ids: list[int] = Field(default_factory=list, max_length=9)
    burn_after_read: bool = False


class MessageEdit(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class MessageForward(BaseModel):
    targets: list[str] = Field(min_length=1, max_length=20)


class MessageFavoriteCreate(BaseModel):
    note: str = Field(default="", max_length=200)


class MessageReactionToggle(BaseModel):
    emoji: str = Field(default="👍", max_length=16)


class ConversationDraftUpdate(BaseModel):
    conversation_id: str = Field(min_length=1, max_length=128)
    content: str = Field(default="", max_length=2000)


class ScreenshotNoticeCreate(BaseModel):
    conversation_id: str = Field(min_length=1, max_length=128)
    target: str = Field(default="", max_length=64)


class SystemConfigUpdate(BaseModel):
    value: str = Field(min_length=1, max_length=500)


class SessionSettingsUpdate(BaseModel):
    pinned: bool | None = None
    muted: bool | None = None


class UserSettingsUpdate(BaseModel):
    notification_enabled: bool | None = None
    message_preview_enabled: bool | None = None
    mention_notify_enabled: bool | None = None
    quiet_hours_enabled: bool | None = None
    quiet_hours_start: str | None = Field(default=None, max_length=5)
    quiet_hours_end: str | None = Field(default=None, max_length=5)
    theme: str | None = Field(default=None, pattern="^(system|light|dark)$")
    language: str | None = Field(default=None, pattern="^(zh-CN|en-US)$")
    font_size: str | None = Field(default=None, pattern="^(small|standard|large)$")
    chat_background: str | None = Field(default=None, max_length=512)


class ErrorMessage(BaseModel):
    type: str = "error"
    message: str
