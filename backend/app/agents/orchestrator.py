from typing import TypedDict, List, Dict, Any
from langgraph.graph import StateGraph, END
from app.agents.base import Researcher, Solver
import logging

logger = logging.getLogger(__name__)

class AgentState(TypedDict):
    prompt: str
    research_data: Dict[str, Any]
    solution_data: Dict[str, Any]
    history: List[str]

class MissionOrchestrator:
    def __init__(self):
        self.researcher = Researcher("Researcher")
        self.solver = Solver("Solver")
        self.workflow = self._build_workflow()

    def _build_workflow(self):
        # 1. Initialize Graph
        workflow = StateGraph(AgentState)

        # 2. Add Nodes
        workflow.add_node("research", self._research_step)
        workflow.add_node("solve", self._solve_step)

        # 3. Add Edges
        workflow.set_entry_point("research")
        workflow.add_edge("research", "solve")
        workflow.add_edge("solve", END)

        return workflow.compile()

    async def _research_step(self, state: AgentState) -> Dict[str, Any]:
        logger.info("--- RESEARCH STEP ---")
        data = await self.researcher.run(state["prompt"])
        return {"research_data": data}

    async def _solve_step(self, state: AgentState) -> Dict[str, Any]:
        logger.info("--- SOLVE STEP ---")
        data = await self.solver.run(state["research_data"])
        return {"solution_data": data}

    async def run_mission(self, prompt: str) -> Dict[str, Any]:
        initial_state = {
            "prompt": prompt,
            "research_data": {},
            "solution_data": {},
            "history": []
        }
        final_state = await self.workflow.ainvoke(initial_state)
        return final_state["solution_data"]

orchestrator = MissionOrchestrator()
