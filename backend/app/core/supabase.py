import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from supabase import create_client, Client
from app.core.config import settings

logger = logging.getLogger(__name__)

def is_valid_key(val: Optional[str]) -> bool:
    if not val:
        return False
    v = val.strip().lower().strip('"')
    return not (v.startswith("your") or "placeholder" in v or len(v) < 10)

class SupabaseService:
    def __init__(self):
        self.url = settings.SUPABASE_URL
        self.key = settings.SUPABASE_KEY
        self.client: Optional[Client] = None
        self._local_sessions: Dict[str, Dict[str, Any]] = {}

        if is_valid_key(self.key) and self.url and self.url.startswith("http") and not ("placeholder" in self.url):
            try:
                self.client = create_client(self.url, self.key)
                logger.info("Supabase client initialized successfully.")
            except Exception as e:
                logger.warning(f"Failed to initialize Supabase client: {e}. Using local session store.")
        else:
            logger.info("Supabase credentials not configured or placeholder; operating in local in-memory session mode.")

    async def save_session(self, session_id: str, data: Dict[str, Any]):
        """Persists session state to Supabase or local cache."""
        now = datetime.now(timezone.utc).isoformat()
        payload = {
            "session_id": session_id,
            "data": data,
            "updated_at": now
        }
        self._local_sessions[session_id] = payload

        if self.client:
            try:
                self.client.table("sessions").upsert(payload).execute()
                logger.info(f"Session {session_id} saved to Supabase.")
            except Exception as e:
                logger.warning(f"Supabase upsert failed: {e}. Session preserved in local cache.")

    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves session state by session_id."""
        if self.client:
            try:
                response = self.client.table("sessions").select("*").eq("session_id", session_id).single().execute()
                if response.data:
                    return response.data
            except Exception as e:
                logger.warning(f"Supabase query failed: {e}. Checking local cache.")

        return self._local_sessions.get(session_id)

    async def list_sessions(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Lists recent sessions."""
        if self.client:
            try:
                response = self.client.table("sessions").select("session_id, updated_at").order("updated_at", desc=True).limit(limit).execute()
                if response.data:
                    return response.data
            except Exception as e:
                logger.warning(f"Supabase list failed: {e}. Returning local cache.")

        return list(self._local_sessions.values())[:limit]

supabase_service = SupabaseService()
