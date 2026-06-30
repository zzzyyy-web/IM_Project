from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}

    async def connect(self, username: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.setdefault(username, set()).add(websocket)

    def disconnect(self, username: str, websocket: WebSocket) -> None:
        sockets = self._connections.get(username)
        if not sockets:
            return
        sockets.discard(websocket)
        if not sockets:
            self._connections.pop(username, None)

    def online_users(self) -> set[str]:
        return {username for username, sockets in self._connections.items() if sockets}

    def is_online(self, username: str) -> bool:
        return bool(self._connections.get(username))

    async def send_to_user(self, username: str, payload: dict) -> bool:
        sockets = list(self._connections.get(username, set()))
        if not sockets:
            return False

        delivered = False
        for websocket in sockets:
            try:
                await websocket.send_json(payload)
                delivered = True
            except RuntimeError:
                self.disconnect(username, websocket)
        return delivered


manager = ConnectionManager()
