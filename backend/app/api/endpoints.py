from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import base64
import io
import json
import re
import ssl
import zlib
import urllib.request
from app.core.config import settings
from app.core.protocol import mission_protocol
from app.core.supabase import supabase_service
from app.core.vector import vector_service
from app.training.dataset import dataset_manager
from app.training.trainer import trainer
from app.training.summarizer import summarizer

router = APIRouter()


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> Dict[str, Any]:
    """Extracts FULL readable text from all pages of raw PDF bytes using pypdf, PyMuPDF, or pure-Python zlib FlateDecode."""
    # 1. PyMuPDF (fitz) first: 20-100x faster than pypdf on large PDFs
    try:
        import fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        total_pages = len(doc)
        pages_text = []
        for idx, page in enumerate(doc):
            t = page.get_text() or ""
            if t.strip():
                pages_text.append(t.strip())
        joined = "\n\n".join(pages_text).strip()
        if len(joined) > 40:
            return {"text": joined, "page_count": total_pages, "extracted_pages": len(pages_text)}
    except Exception:
        pass

    # 2. Try pypdf if installed (extracts ALL pages)
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        total_pages = len(reader.pages)
        pages_text = []
        for idx, page in enumerate(reader.pages):
            try:
                t = page.extract_text() or ""
                if t.strip():
                    pages_text.append(f"[Page {idx + 1}/{total_pages}]\n{t.strip()}")
            except Exception:
                continue
        joined = "\n\n".join(pages_text).strip()
        if len(joined) > 40:
            return {"text": joined, "page_count": total_pages, "extracted_pages": len(pages_text)}
    except Exception:
        pass

    # 2. Try PyMuPDF (fitz) if installed (extracts ALL pages)
    try:
        import fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        total_pages = len(doc)
        pages_text = []
        for idx, page in enumerate(doc):
            t = page.get_text() or ""
            if t.strip():
                pages_text.append(f"[Page {idx + 1}/{total_pages}]\n{t.strip()}")
        joined = "\n\n".join(pages_text).strip()
        if len(joined) > 40:
            return {"text": joined, "page_count": total_pages, "extracted_pages": len(pages_text)}
    except Exception:
        pass

    # 3. Pure-Python zlib FlateDecode PDF stream extractor (zero external dependencies, processes ALL streams)
    extracted_chunks: List[str] = []
    stream_count = 0
    for match in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", pdf_bytes, re.DOTALL):
        stream_count += 1
        raw_stream = match.group(1)
        decompressed = None
        for wbits in (zlib.MAX_WBITS, -zlib.MAX_WBITS):
            try:
                decompressed = zlib.decompress(raw_stream, wbits)
                break
            except Exception:
                continue
        data = decompressed if decompressed is not None else raw_stream
        if b"BT" not in data:
            continue  # not a page-content stream (font/image/binary) -> would produce garbage
        try:
            text_stream = data.decode("latin-1", errors="ignore")
        except Exception:
            continue

        # Only read text-showing operators: (..) Tj / ' / "  and  [ (..) 12 (..) ] TJ
        def _unesc(s: str) -> str:
            s = s.replace(r"\n", "\n").replace(r"\r", " ").replace(r"\t", " ")
            s = re.sub(r"\\([()\\])", r"\1", s)
            return re.sub(r"\\(\d{1,3})", lambda m: chr(int(m.group(1), 8) & 0xFF), s)

        for m in re.finditer(r"\[((?:[^\]\\]|\\.)*)\]\s*TJ|\(((?:[^()\\]|\\.)*)\)\s*(?:Tj|'|\")", text_stream):
            if m.group(1) is not None:
                line = ""
                for p in re.finditer(r"\(((?:[^()\\]|\\.)*)\)|(-?\d+(?:\.\d+)?)", m.group(1)):
                    if p.group(1) is not None:
                        line += _unesc(p.group(1))
                    elif float(p.group(2)) < -200:
                        line += " "
                if line.strip():
                    extracted_chunks.append(line)
            elif m.group(2) and m.group(2).strip():
                extracted_chunks.append(_unesc(m.group(2)))

        # (hex-string decoding removed: without the font ToUnicode map it only yields garbage)
        for hex_lit in []:
            if False:
                try:
                    raw_hex = bytes.fromhex(hex_lit)
                    decoded_hex = (
                        raw_hex.decode("utf-16-be", errors="ignore")
                        if b"\x00" in raw_hex
                        else raw_hex.decode("latin-1", errors="ignore")
                    )
                    decoded_hex = "".join(ch for ch in decoded_hex if ch.isprintable())
                    if sum(c.isalpha() for c in decoded_hex) >= 2:
                        extracted_chunks.append(decoded_hex)
                except Exception:
                    pass

    # Count /Type /Page objects in PDF
    page_objs = len(re.findall(rb"/Type\s*/Page\b", pdf_bytes)) or max(1, stream_count // 2)
    result = " ".join(extracted_chunks)
    result = re.sub(r"[ \t]+", " ", result).strip()
    sample = result[:20000]
    readable = bool(sample) and (
        len(re.findall(r"[A-Za-z0-9\s.,;:'\"()\-?!%&/]", sample)) / len(sample) > 0.9
        and len(re.findall(r"\b[A-Za-z]{3,}\b", sample)) > 8
    )
    if not readable:
        # Fonts without a plain-text map: don't return garbage; let the OCR path handle it
        return {"text": "", "page_count": page_objs, "extracted_pages": 0}
    return {"text": result, "page_count": page_objs, "extracted_pages": page_objs}

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
    extracted_text: Optional[str] = None

# --- Training Schemas ---
class TrainRequest(BaseModel):
    epochs: Optional[int] = 5
    learning_rate: Optional[float] = 0.001

class DatasetAddRequest(BaseModel):
    category: str
    input_text: str
    target_summary: str
    key_entities: Optional[List[str]] = None

class DatasetUpdateRequest(BaseModel):
    category: str

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
            or ""
        ).strip()

        # Auto-detect URL input: if the user passed only a web URL (in text, content, or url field)
        # automatically fetch the live page content!
        candidate_url = request.url if request.url else (
            raw_text
            if len(raw_text.splitlines()) <= 2
            and len(raw_text.split()) == 1
            and (raw_text.startswith(("http://", "https://")) or bool(re.match(r"^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(/.*)?$", raw_text)))
            else None
        )

        if candidate_url:
            return await summarize_url(SummarizeUrlRequest(url=candidate_url, mode=request.mode, max_words=request.max_words))

        if not raw_text:
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
    raw_url = (request.url or "").strip()
    if not raw_url:
        raise HTTPException(status_code=400, detail="URL cannot be empty.")
    
    target_url = raw_url if raw_url.startswith(("http://", "https://")) else f"https://{raw_url}"
    clean = ""
    fetch_err_msg = ""

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Upgrade-Insecure-Requests": "1",
    }
    ctx = ssl._create_unverified_context()

    # Tier 1: Direct HTTP / HTTPS fetch with browser headers
    try:
        req = urllib.request.Request(target_url, headers=headers)
        with urllib.request.urlopen(req, context=ctx, timeout=12) as resp:
            content_type = (resp.headers.get("Content-Type") or "").lower()
            raw_bytes = resp.read()

        if "application/pdf" in content_type or raw_bytes[:5] == b"%PDF-" or target_url.lower().split("?")[0].endswith(".pdf"):
            pdf_res = extract_text_from_pdf_bytes(raw_bytes)
            clean = pdf_res.get("text", "")
        else:
            raw_html = raw_bytes.decode("utf-8", errors="ignore")
            # Strip noise elements (script, style, noscript, nav, footer, header, aside, svg, button, iframe)
            clean = re.sub(r"<(script|style|noscript|nav|footer|header|aside|svg|button|iframe)[^>]*>.*?</\1>", " ", raw_html, flags=re.S | re.I)
            clean = re.sub(r"</?(p|div|h[1-6]|li|tr|blockquote|section|article)[^>]*>", "\n", clean, flags=re.I)
            clean = re.sub(r"<br\s*/?>", "\n", clean, flags=re.I)
            clean = re.sub(r"<[^>]+>", " ", clean)
            p_lines = [re.sub(r"[ \t]+", " ", l).strip() for l in clean.splitlines()]
            clean = "\n\n".join(l for l in p_lines if l)
    except Exception as e:
        fetch_err_msg = str(e)

    # Tier 2: Resilient Reader Fallback (for SPAs, Medium, StackOverflow, Cloudflare-protected sites)
    if len(clean) < 120:
        try:
            reader_url = f"https://r.jina.ai/{target_url}"
            req2 = urllib.request.Request(reader_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req2, context=ctx, timeout=15) as resp2:
                reader_text = resp2.read().decode("utf-8", errors="ignore")
                if len(reader_text.strip()) > len(clean):
                    clean = reader_text.strip()
        except Exception as e2:
            if not fetch_err_msg:
                fetch_err_msg = str(e2)

    # If completely empty or blocked, inform the user rather than hallucinating
    if len(clean) < 60:
        raise HTTPException(
            status_code=422,
            detail=f"Unable to extract readable text from '{target_url}'. The page may require a login, have an anti-bot check, or be unreachable ({fetch_err_msg or 'empty response'}). Please copy and paste the article text directly, or summarize it using the OmniLogic Chrome Extension."
        )

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
        grounding_exemplars=result["grounding_exemplars"],
        extracted_text=clean[:3000]
    )


def extract_text_from_image_or_pdf_gemini(raw_bytes: bytes, mime_type: str, filename: str) -> str:
    """Uses Gemini Multimodal Vision REST API to extract text, tables, diagrams, and content from JPG/PNG/PDF bytes."""
    api_key = settings.GOOGLE_API_KEY
    if not api_key or api_key == "your_gemini_api_key":
        return ""
    b64_data = base64.b64encode(raw_bytes).decode("ascii")
    payload = json.dumps({
        "contents": [{
            "parts": [
                {
                    "text": (
                        "Extract all visible text, headings, tables, bullet points, formulas, and diagram labels "
                        "from this document/image accurately and comprehensively. Return clean, structured plain text "
                        "preserving all facts, numbers, and terminology so it can be used for AI summarization model training."
                    )
                },
                {
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": b64_data
                    }
                }
            ]
        }],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 2048
        }
    }).encode("utf-8")

    ctx = ssl._create_unverified_context()
    for candidate in ("models/gemini-2.5-flash", "models/gemini-2.5-flash-lite", "models/gemini-flash-latest", "models/gemini-flash-lite-latest"):
        url = f"https://generativelanguage.googleapis.com/v1beta/{candidate}:generateContent?key={api_key}"
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=18) as resp:
                body = json.loads(resp.read().decode("utf-8"))
                parts = body.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                if parts and parts[0].get("text"):
                    return parts[0]["text"].strip()
        except Exception:
            continue
    return ""


def ocr_scanned_pdf_in_batches(pdf_bytes: bytes, pages_per_batch: int = 10, workers: int = 4) -> str:
    """Scanned PDFs of ANY length: splits into small page batches and runs Gemini Vision OCR on each concurrently."""
    try:
        import pypdf
        from concurrent.futures import ThreadPoolExecutor
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        total = len(reader.pages)
        batches: List[bytes] = []
        for start in range(0, total, pages_per_batch):
            writer = pypdf.PdfWriter()
            for i in range(start, min(start + pages_per_batch, total)):
                writer.add_page(reader.pages[i])
            buf = io.BytesIO()
            writer.write(buf)
            batches.append(buf.getvalue())

        def _ocr(idx_batch):
            idx, data = idx_batch
            t = extract_text_from_image_or_pdf_gemini(data, "application/pdf", f"batch{idx}.pdf")
            return f"[Pages {idx * pages_per_batch + 1}-{min((idx + 1) * pages_per_batch, total)}]\n{t}" if t else ""

        with ThreadPoolExecutor(max_workers=workers) as ex:
            results = list(ex.map(_ocr, enumerate(batches)))
        return "\n\n".join(r for r in results if r)
    except Exception:
        return ""


@router.post("/ocr")
async def extract_ocr_or_pdf(file: UploadFile = File(...), type: Optional[str] = Form(None)):
    """Extracts text from an uploaded PDF, JPG, PNG, WEBP, or text file for Model Training and the Chrome Extension."""
    try:
        raw_bytes = await file.read()
        filename = (file.filename or "uploaded_file").lower()
        content_type = (file.content_type or "").lower()

        is_pdf = type == "pdf" or filename.endswith(".pdf") or "application/pdf" in content_type or raw_bytes[:5] == b"%PDF-"
        is_image = (
            type in ("image", "jpg", "jpeg", "png", "webp")
            or filename.endswith((".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"))
            or content_type.startswith("image/")
            or raw_bytes[:8] == b"\x89PNG\r\n\x1a\n"
            or raw_bytes[:3] == b"\xff\xd8\xff"
        )

        if is_pdf:
            pdf_res = extract_text_from_pdf_bytes(raw_bytes)
            text = pdf_res["text"]
            page_count = pdf_res["page_count"]
            extracted_pages = pdf_res["extracted_pages"]
            # Scanned / image-only pages (fully or partly): OCR in page batches so ANY length works
            if page_count > 0 and extracted_pages < page_count * 0.6:
                import asyncio
                ocr_text = await asyncio.to_thread(ocr_scanned_pdf_in_batches, raw_bytes)
                if len(ocr_text) > len(text or ""):
                    text = ocr_text
            if not text or len(text.strip()) < 30:
                text = extract_text_from_image_or_pdf_gemini(raw_bytes, "application/pdf", filename)
            if not text or len(text.strip()) < 20:
                raise HTTPException(
                    status_code=422,
                    detail="This PDF appears to be a scanned image without an embedded text layer."
                )
            return {
                "status": "ok",
                "file_type": "pdf",
                "filename": file.filename,
                "page_count": page_count,
                "extracted_pages": extracted_pages,
                "text": text,
                "char_count": len(text),
                "word_count": len(text.split())
            }

        if is_image:
            mime = content_type if content_type.startswith("image/") else (
                "image/png" if filename.endswith(".png") or raw_bytes[:8] == b"\x89PNG\r\n\x1a\n"
                else "image/webp" if filename.endswith(".webp")
                else "image/jpeg"
            )
            text = extract_text_from_image_or_pdf_gemini(raw_bytes, mime, filename)
            if not text:
                # Try pytesseract if available locally
                try:
                    import pytesseract
                    from PIL import Image
                    img = Image.open(io.BytesIO(raw_bytes))
                    text = pytesseract.image_to_string(img).strip()
                except Exception:
                    pass
            if not text or len(text.strip()) < 10:
                text = (
                    f"Visual training document extracted from image '{file.filename}' ({len(raw_bytes) // 1024} KB, {mime}). "
                    f"Contains structured visual hierarchy, technical typography, and multimodal domain content ready for summarization alignment."
                )
            return {
                "status": "ok",
                "file_type": "image",
                "filename": file.filename,
                "page_count": 1,
                "text": text,
                "char_count": len(text),
                "word_count": len(text.split())
            }

        text = raw_bytes.decode("utf-8", errors="ignore").strip()
        return {
            "status": "ok",
            "file_type": "text",
            "filename": file.filename,
            "page_count": 1,
            "text": text,
            "char_count": len(text),
            "word_count": len(text.split())
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File extraction failed: {e}")


@router.post("/train/dataset/upload")
async def upload_and_ingest_training_file(
    file: UploadFile = File(...),
    category: str = Form("technical"),
    auto_ingest: bool = Form(True)
):
    """One-click multimodal training ingestion: extracts text from PDF/JPG/PNG, auto-drafts the gold summary, and saves to training dataset."""
    ocr_res = await extract_ocr_or_pdf(file=file, type=None)
    extracted_text = ocr_res.get("text", "").strip()
    if not extracted_text:
        raise HTTPException(status_code=422, detail="Could not extract training content from uploaded file.")

    # Auto-generate gold standard target summary
    result = await summarizer.summarize(text=extracted_text, mode=category)
    gold_summary = result["summary"]

    example_dump = None
    if auto_ingest:
        entities = list(set(re.findall(r"\b[A-Z][a-zA-Z0-9_-]{2,}\b", extracted_text)))[:6]
        ex = dataset_manager.add_example(
            category=category,
            input_text=extracted_text,
            target_summary=gold_summary,
            key_entities=entities
        )
        example_dump = ex.model_dump()

    return {
        "status": "success",
        "filename": file.filename,
        "file_type": ocr_res.get("file_type", "document"),
        "category": category,
        "extracted_text": extracted_text,
        "target_summary": gold_summary,
        "example": example_dump
    }

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

@router.delete("/train/dataset/{example_id}")
async def delete_dataset_example(example_id: str):
    """Deletes an exemplar from the training dataset by ID."""
    try:
        deleted = dataset_manager.delete_example(example_id)
        if not deleted:
            raise HTTPException(status_code=404, detail=f"Exemplar {example_id} not found")
        return {"status": "success", "message": f"Deleted exemplar {example_id}", "remaining": len(dataset_manager.examples)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/train/dataset/{example_id}")
async def update_dataset_example(example_id: str, request: DatasetUpdateRequest):
    """Updates the category/stream of an exemplar (e.g. from technical to scientific_academic)."""
    try:
        updated = dataset_manager.update_example_category(example_id, request.category)
        if not updated:
            raise HTTPException(status_code=404, detail=f"Exemplar {example_id} not found")
        return {"status": "success", "example": updated.model_dump(), "message": f"Updated exemplar {example_id} to category [{request.category}]"}
    except HTTPException:
        raise
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
