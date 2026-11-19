import uuid
import logging
from typing import Dict, Any, List, Optional
from app.agents.orchestrator import orchestrator
from app.core.supabase import supabase_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MissionProtocol:
    """
    Lead Engineering Orchestrator - Mission Protocol
    Handles State Management, Research Grounding, Persistence, and Multi-Agent Orchestration.
    """

    @staticmethod
    async def initiate_mission(prompt: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        mission_id = f"mission_{uuid.uuid4().hex[:8]}"
        logger.info(f"[{mission_id}] New Mission Protocol Initiated: {prompt}")

        # 1. State Management: Clear transient variables for a "Fresh Input" experience
        state = MissionProtocol._reset_transient_state(context)

        # 2. Agent Orchestration: Trigger LangGraph StateGraph (Researcher -> Solver)
        result = await orchestrator.run_mission(prompt)

        response_payload = {
            "mission_id": mission_id,
            "status": "complete",
            "state": state,
            "analysis": result["analysis"],
            "artifact": result["artifact_code"],
            "sources": result["sources"]
        }

        # 3. Persistence: Store session in Supabase / local session memory
        try:
            await supabase_service.save_session(
                session_id=mission_id,
                data={
                    "prompt": prompt,
                    "analysis": result["analysis"],
                    "artifact": result["artifact_code"],
                    "sources": result["sources"],
                    "status": "complete"
                }
            )
        except Exception as e:
            logger.warning(f"Could not persist session {mission_id}: {e}")

        return response_payload

    @staticmethod
    def _reset_transient_state(context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Ensures a 'Fresh Input' experience by clearing non-persistent variables."""
        logger.info("Resetting transient state for Fresh Input.")
        history = context.get("history", []) if context else []
        return {"history": history, "current_mission": {}}

mission_protocol = MissionProtocol()
