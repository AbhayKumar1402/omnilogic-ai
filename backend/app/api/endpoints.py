from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import io
import re
import zlib
import urllib.request
from app.core.protocol import mission_protocol
from app.core.supabase import supabase_service
from app.core.vector import vector_service
from app.training.dataset import dataset_manager
from app.training.trainer import trainer
from app.training.summarizer import summarizer

router = APIRouter()


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    """Extracts readable text from raw PDF bytes using pypdf, PyMuPDF, or pure-Python zlib FlateDecode."""
    # 1. Try pypdf if installed
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        pages_text = []
        for page in reader.pages[:25]:
            t = page.extract_text() or ""
            if t.strip():
                pages_text.append(t.strip())
        joined = "\n\n".join(pages_text).strip()
        if len(joined) > 40:
            return joined[:12000]
    except Exception:
        pass

    # 2. Try PyMuPDF (fitz) if installed
    try:
        import fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pages_text = [page.get_text() for page in doc[:25]]
        joined = "\n\n".join(pages_text).strip()
        if len(joined) > 40:
            return joined[:12000]
    except Exception:
        pass

    # 3. Pure-Python zlib FlateDecode PDF stream extractor (zero external dependencies)
    extracted_chunks: List[str] = []
    for match in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", pdf_bytes, re.DOTALL):
        raw_stream = match.group(1)
        decompressed = None
        for wbits in (zlib.MAX_WBITS, -zlib.MAX_WBITS):
            try:
                decompressed = zlib.decompress(raw_stream, wbits)
                break
            except Exception:
                continue
        data = decompressed if decompressed is not None else raw_stream
        try:
            text_stream = data.decode("latin-1", errors="ignore")
        except Exception:
            continue

        # Extract text inside PDF string literals (...) inside BT ... ET or TJ/Tj operators
        for lit in re.findall(r"\(([^()\\]*(?:\\.[^()\\]*)*)\)", text_stream):
            cleaned_lit = (
                lit.replace(r"\n", "\n")
                .replace(r"\r", " ")
                .replace(r"\t", " ")
                .replace(r"\(", "(")
                .replace(r"\)", ")")
                .replace(r"\\", "\\")
            )
            cleaned_lit = re.sub(r"\\\d{3}", " ", cleaned_lit)
            # Keep printable ASCII/Latin text
            if any(c.isalpha() for c in cleaned_lit):
                extracted_chunks.append(cleaned_lit)

    result = " ".join(extracted_chunks)
    result = re.sub(r"\s+", " ", result).strip()
    return result[:12000]

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
    import ssl
    try:
        req = urllib.request.Request(
            request.url,
            headers={"User-Agent": "Mozilla/5.0 (OmniLogic AI Summarizer/1.0)"}
        )
        ctx = ssl._create_unverified_context()
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            content_type = (resp.headers.get("Content-Type") or "").lower()
            raw_bytes = resp.read()

        if "application/pdf" in content_type or raw_bytes[:5] == b"%PDF-" or request.url.lower().split("?")[0].endswith(".pdf"):
            clean = extract_text_from_pdf_bytes(raw_bytes)
        else:
            raw_html = raw_bytes.decode("utf-8", errors="ignore")
            clean = re.sub(r"<(script|style|noscript|nav|footer|header)[^>]*>.*?</\1>", " ", raw_html, flags=re.S | re.I)
            clean = re.sub(r"<[^>]+>", " ", clean)
            clean = re.sub(r"\s+", " ", clean).strip()[:10000]

        if len(clean) < 40:
            clean = f"Document content from {request.url}"
    except Exception as fetch_err:
        clean = f"Live document summary request for {request.url}. (Note: Direct fetch fallback activated: {fetch_err})"

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


@router.post("/ocr")
async def extract_ocr_or_pdf(file: UploadFile = File(...), type: Optional[str] = Form(None)):
    """Extracts text from an uploaded PDF or text/image file for the Chrome Extension."""
    try:
        raw_bytes = await file.read()
        filename = (file.filename or "").lower()
        if type == "pdf" or filename.endswith(".pdf") or raw_bytes[:5] == b"%PDF-":
            text = extract_text_from_pdf_bytes(raw_bytes)
            if not text or len(text.strip()) < 20:
                raise HTTPException(
                    status_code=422,
                    detail="This PDF appears to be a scanned image without an embedded text layer."
                )
            return {"status": "ok", "text": text, "char_count": len(text)}
        else:
            text = raw_bytes.decode("utf-8", errors="ignore").strip()
            return {"status": "ok", "text": text[:12000], "char_count": len(text)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File extraction failed: {e}")

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
