# OmniLogic - Universal Solver Implementation Plan

## 1. Vision & Aesthetic
OmniLogic is a premium AI orchestration platform designed with a "Liquid Glass" and "Obsidian" aesthetic. It utilizes deep blurs, vibrant gradients, and smooth micro-animations to provide a state-of-the-art user experience.

## 2. Tech Stack
- **Frontend**: Next.js 16 (App Router), Tailwind CSS v4, Framer Motion, Lucide icons, Material Symbols.
- **Backend**: FastAPI (Python), LangGraph (Agent Orchestration).
- **Database**: 
  - **Relational / Sessions**: Supabase (PostgreSQL) with in-memory fallback cache.
  - **Vector / Memory**: Pinecone (AWS us-east-1 serverless) with deterministic in-memory vector shard fallback.
- **AI Integration**: Google Generative AI (Gemini Flash/Pro models & text-embedding-004) with offline synthesis fallback.

## 3. Mission Protocol (Core Logic)
For every user prompt, the system initiates the **New Mission Protocol**:
1. **State Management**: Previous resolutions are historical/read-only. Transient variables are cleared for a "Fresh Input" experience.
2. **Research Grounding**: Researcher queries long-term vector memory (`vector_service.query_memory`) and grounds intent via Gemini.
3. **UI Rendering**: Solver generates deep technical analysis and executable code/architecture artifacts (`ARTIFACT:`).
4. **Persistence**: Saves mission session and indexed memory into Supabase and Vector store.

## 4. Development Roadmap

### Phase 1: Foundation
- [x] Initialize Next.js Project (Frontend)
- [x] Setup FastAPI Scaffold (Backend)
- [x] Configure Tailwind Theme (Colors: Primary #ddb7ff, Secondary #7bd0ff, Background #050505)

### Phase 2: UI Implementation
- [x] Build "Liquid Glass" Layout (Sidebar, TopNav, Prompt Bar)
- [x] Implement Framer Motion transitions for logic streaming & message rendering
- [x] Integrate Material Symbols for visual consistency
- [x] Add code copy functionality, status indicators, and "New Solve" session reset

### Phase 3: Backend & Agent Orchestration
- [x] Setup LangGraph StateGraph (`Researcher` -> `Solver` -> `END`)
- [x] Implement Research and Solver agents with Gemini model fallback
- [x] Integrate Supabase service for session persistence and mission lookup

### Phase 4: AI Memory & Grounding
- [x] Setup Vector DB integration (Pinecone serverless + in-memory fallback shard)
- [x] Implement context retrieval, dynamic embeddings, and prompt indexing
- [x] Implement non-blocking network probe and offline-resilient execution

### Phase 5: Summarizer AI Training & Alignment Pipeline
- [x] Curate High-Efficiency Golden Summarization Dataset (`dataset.py`) across Technical, Executive, Architecture, and Chain of Density domains
- [x] Implement Pure-Python ROUGE Evaluator (`compute_rouge_n`, `compute_rouge_l`, Compression Ratio, Efficiency Score)
- [x] Implement Dual-Phase Model Trainer (`trainer.py` with RAFT vector alignment + Gemini fine-tuning exporter)
- [x] Implement Multi-Mode Efficient Summarizer (`summarizer.py` with Executive, Technical, Chain-of-Density, and Actionable modes)
- [x] Build Interactive Model Lab UI (`TrainingView.tsx`) with Loss curves, ROUGE metrics, Dataset editor, and Live Summarizer Sandbox
