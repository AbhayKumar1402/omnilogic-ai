from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from app.core.protocol import mission_protocol
from app.core.supabase import supabase_service
from app.core.vector import vector_service
from app.training.dataset import dataset_manager
from app.training.trainer import trainer
from app.training.summarizer import summarizer

router = APIRouter()

# --- Mission Protocol Schemas ---
class MissionRequest(BaseModel):
    prompt: str
    context: Optional[Dict[str, Any]] = None

class MissionResponse(BaseModel):
    status: str
    mission_id: str
    artifact: str
    analysis: str
    sources: Optional[List[str]] = None

# --- Summarizer Schemas ---
class SummarizeRequest(BaseModel):
    text: Optional[str] = None
    content: Optional[str] = None
    pageText: Optional[str] = None
    page_text: Optional[str] = None
    url: Optional[str] = None
    mode: Optional[str] = "technical"  # technical | executive | chain_of_density | actionable
    max_words: Optional[int] = None
    context: Optional[Dict[str, Any]] = None

    class Config:
        extra = "allow"

class SummarizeUrlRequest(BaseModel):
    url: str
    mode: Optional[str] = "executive"
    max_words: Optional[int] = None

class SummarizeResponse(BaseModel):
    status: str = "ok"
    mode: str
    summary: str
    result: str
    bullets: List[str]
    metrics: Dict[str, Any]
    grounding_exemplars: List[str]

# --- Training Schemas ---
class TrainRequest(BaseModel):
    epochs: Optional[int] = 5
    learning_rate: Optional[float] = 0.001

class DatasetAddRequest(BaseModel):
    category: str
    input_text: str
    target_summary: str
    key_entities: Optional[List[str]] = None

class AutoGeneratePairRequest(BaseModel):
    input_text: str
    category: Optional[str] = "executive"

# --- Mission Endpoints ---
@router.post("/mission/initiate", response_model=MissionResponse)
async def initiate_mission(request: MissionRequest):
    try:
        mission_data = await mission_protocol.initiate_mission(request.prompt, request.context)
        return MissionResponse(
            status="success",
            mission_id=mission_data["mission_id"],
            artifact=mission_data["artifact"],
            analysis=mission_data["analysis"],
            sources=mission_data.get("sources", [])
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/mission/{mission_id}")
async def get_mission(mission_id: str):
    session = await supabase_service.get_session(mission_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Mission {mission_id} not found")
    return session

@router.get("/missions")
async def list_missions(limit: int = 20):
    return await supabase_service.list_sessions(limit=limit)

# --- Summarizer Endpoint (with aliases for all Chrome Extension variants) ---
@router.post("/summarize", response_model=SummarizeResponse)
@router.post("/v1/summarize", response_model=SummarizeResponse)
@router.post("/analyze", response_model=SummarizeResponse)
@router.post("/extract", response_model=SummarizeResponse)
async def run_summarizer(request: SummarizeRequest):
    try:
        raw_text = (
            request.text
            or request.content
            or request.pageText
            or request.page_text
            or (f"Webpage content from {request.url}" if request.url else "")
        )
        if not raw_text or not raw_text.strip():
            raw_text = "Document content provided for summarization."

        result = await summarizer.summarize(
            text=raw_text,
            mode=request.mode or "technical",
            max_words=request.max_words
        )
        summary_str = result["summary"]
        bullets = [
            line.lstrip("•-* ").strip()
            for line in summary_str.splitlines()
            if line.strip()
        ]
        return SummarizeResponse(
            status="ok",
            mode=result["mode"],
            summary=summary_str,
            result=summary_str,
            bullets=bullets,
            metrics=result["metrics"],
            grounding_exemplars=result["grounding_exemplars"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/summarize/url", response_model=SummarizeResponse)
async def summarize_url(request: SummarizeUrlRequest):
    import re
    import urllib.request
    try:
        req = urllib.request.Request(
            request.url,
            headers={"User-Agent": "Mozilla/5.0 (OmniLogic AI Summarizer/1.0)"}
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            raw_html = resp.read().decode("utf-8", errors="ignore")
        # Strip scripts, styles, tags
        clean = re.sub(r"<(script|style|noscript|nav|footer|header)[^>]*>.*?</\1>", " ", raw_html, flags=re.S | re.I)
        clean = re.sub(r"<[^>]+>", " ", clean)
        clean = re.sub(r"\s+", " ", clean).strip()[:8000]
        if len(clean) < 40:
            clean = f"Webpage content from {request.url}"
    except Exception as fetch_err:
        clean = f"Live webpage summary request for {request.url}. (Note: Direct fetch fallback activated: {fetch_err})"

    result = await summarizer.summarize(
        text=clean,
        mode=request.mode or "executive",
        max_words=request.max_words
    )
    summary_str = result["summary"]
    bullets = [
        line.lstrip("•-* ").strip()
        for line in summary_str.splitlines()
        if line.strip()
    ]
    return SummarizeResponse(
        status="ok",
        mode=result["mode"],
        summary=summary_str,
        result=summary_str,
        bullets=bullets,
        metrics=result["metrics"],
        grounding_exemplars=result["grounding_exemplars"]
    )

# --- Training Endpoints ---
@router.post("/train/start")
async def start_training(request: TrainRequest = TrainRequest()):
    try:
        status = await trainer.start_training(epochs=request.epochs or 5, learning_rate=request.learning_rate or 0.001)
        return {"status": "success", "training_job": status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/train/status")
async def get_training_status():
    return trainer.get_status()

@router.get("/train/dataset")
async def get_dataset():
    return [ex.model_dump() for ex in dataset_manager.examples]

@router.post("/train/dataset/add")
async def add_dataset_example(request: DatasetAddRequest):
    try:
        ex = dataset_manager.add_example(
            category=request.category,
            input_text=request.input_text,
            target_summary=request.target_summary,
            key_entities=request.key_entities
        )
        return {"status": "success", "example": ex.model_dump()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/train/dataset/auto-generate")
async def auto_generate_training_pair(request: AutoGeneratePairRequest):
    """Uses the high-tier teacher model to auto-generate the gold summary from raw text without manual writing."""
    try:
        category = request.category or "executive"
        # 1. Use summarizer to craft the gold standard summary
        result = await summarizer.summarize(
            text=request.input_text,
            mode=category
        )
        gold_summary = result["summary"]
        
        # 2. Extract key named entities automatically
        import re
        entities = list(set(re.findall(r"\b[A-Z][a-zA-Z0-9_-]{2,}\b", request.input_text)))[:6]
        
        # 3. Add to training dataset
        ex = dataset_manager.add_example(
            category=category,
            input_text=request.input_text,
            target_summary=gold_summary,
            key_entities=entities
        )
        return {
            "status": "success",
            "example": ex.model_dump(),
            "message": f"Successfully auto-generated and indexed gold training pair for topic under [{category}]"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "vector_service": "connected" if vector_service.index else "in-memory-shard",
        "supabase_service": "connected" if supabase_service.client else "in-memory-cache",
        "trainer_status": trainer.state.status,
        "dataset_size": len(dataset_manager.examples)
    }
