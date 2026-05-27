import asyncio
import secrets
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from .config import CODE_ALPHABET, CODE_LENGTH, SESSION_TTL_SECONDS, STORAGE_DIR


@dataclass
class Session:
    code: str
    file_path: Path
    file_name: str
    mime_type: str
    size: int
    created_at: float
    expires_at: float
    page_count: int | None = None

    def is_expired(self) -> bool:
        return time.time() >= self.expires_at

    def to_public(self) -> dict:
        return {
            "code": self.code,
            "fileName": self.file_name,
            "mimeType": self.mime_type,
            "size": self.size,
            "pageCount": self.page_count,
            "createdAt": int(self.created_at),
            "expiresAt": int(self.expires_at),
        }


class SessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}
        self._lock = asyncio.Lock()

    def _generate_code(self) -> str:
        while True:
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
            if code not in self._sessions:
                return code

    async def create(
        self,
        file_bytes: bytes,
        file_name: str,
        mime_type: str,
        page_count: int | None = None,
    ) -> Session:
        async with self._lock:
            code = self._generate_code()

        suffix = Path(file_name).suffix.lower()
        stored_path = STORAGE_DIR / f"{code}{suffix}"

        # Простая запись — файлы небольшие (≤25 МБ), отдельный поток не нужен.
        stored_path.write_bytes(file_bytes)

        now = time.time()
        session = Session(
            code=code,
            file_path=stored_path,
            file_name=file_name,
            mime_type=mime_type,
            size=len(file_bytes),
            created_at=now,
            expires_at=now + SESSION_TTL_SECONDS,
            page_count=page_count,
        )

        async with self._lock:
            self._sessions[code] = session

        return session

    async def get(self, code: str) -> Optional[Session]:
        code = code.upper().replace("-", "").replace(" ", "")
        async with self._lock:
            session = self._sessions.get(code)
            if session is None:
                return None
            if session.is_expired():
                self._sessions.pop(code, None)
                self._delete_file(session.file_path)
                return None
            return session

    async def delete(self, code: str) -> bool:
        code = code.upper().replace("-", "").replace(" ", "")
        async with self._lock:
            session = self._sessions.pop(code, None)
        if session:
            self._delete_file(session.file_path)
            return True
        return False

    async def cleanup_loop(self) -> None:
        while True:
            await asyncio.sleep(60)
            now = time.time()
            async with self._lock:
                expired = [c for c, s in self._sessions.items() if s.expires_at <= now]
                for c in expired:
                    s = self._sessions.pop(c)
                    self._delete_file(s.file_path)

    @staticmethod
    def _delete_file(path: Path) -> None:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass


store = SessionStore()
