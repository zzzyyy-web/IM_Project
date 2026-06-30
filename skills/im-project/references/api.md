# API Reference

## Public

- `GET /health`
- `GET /api/captcha`
- `POST /api/register`
- `POST /api/login`

## User APIs

Require `Authorization: Bearer <token>`.

- `GET /api/users`
- `GET /api/users/{username}`
- `PATCH /api/users/{username}`
- `POST /api/friend-requests`
- `GET /api/friend-requests?username=<user>&box=inbox|outbox`
- `POST /api/friend-requests/{request_id}/action`
- `GET /api/friends?username=<user>`
- `DELETE /api/friends/{friend_username}?username=<user>`
- `GET /api/sessions?username=<user>`
- `PATCH /api/sessions/{peer}?username=<user>`
- `GET /api/messages?me=<user>&peer=<peer>`
- `POST /api/messages/read?username=<user>&peer=<peer>`

## Admin APIs

Require admin token.

- `GET /api/admin/overview`
- `GET /api/admin/users`
- `GET /api/admin/online-users`
- `GET /api/admin/messages`
- `GET /api/admin/friend-requests`

## WebSocket

Connect:

```text
ws://127.0.0.1:8000/ws/{username}?token={login_token}
```

Client sends:

```json
{
  "type": "chat",
  "receiver": "bob",
  "content": "hello",
  "msg_type": "text"
}
```

Server ack:

```json
{
  "type": "ack",
  "id": "1",
  "conversation_id": "alice:bob",
  "sender": "alice",
  "receiver": "bob",
  "content": "hello",
  "msg_type": "text",
  "created_at": "...",
  "delivered": true,
  "read_at": null,
  "status": "sent"
}
```
