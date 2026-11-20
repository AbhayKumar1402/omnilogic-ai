import os
import math
import socket
import asyncio
import logging
from typing import List, Dict, Any, Optional
import google.generativeai as genai
from pinecone import Pinecone, ServerlessSpec
from app.core.config import settings

logger = logging.getLogger(__name__)

def _check_network() -> bool:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.3)
        s.connect(("8.8.8.8", 53))
        s.close()
        return True
    except Exception:
        return False

_NETWORK_ONLINE: bool = _check_network()

def is_network_available() -> bool:
    """Returns cached network reachability status without blocking event loop."""
    return _NETWORK_ONLINE

def is_valid_key(val: Optional[str]) -> bool:
    if not val:
        return False
    v = val.strip().lower().strip('"')
    return not (v.startswith("your") or "placeholder" in v or len(v) < 10)

class VectorService:
    def __init__(self):
        self.api_key = settings.PINECONE_API_KEY
        self.environment = settings.PINECONE_ENVIRONMENT
        self.index_name = settings.PINECONE_INDEX_NAME
        self.pc: Optional[Pinecone] = None
        self.index = None
        self._local_memory: List[Dict[str, Any]] = [
            {
                "id": "arch_seed_01",
                "content": "OmniLogic Core Architecture v4: Manifold folding loop utilizes explicit drop frames and asynchronous thread pools.",
                "vector": self._pseudo_embedding("OmniLogic Core Architecture v4: Manifold folding loop"),
                "metadata": {"source": "sys_arch_v4"}
            },
            {
                "id": "arch_seed_02",
                "content": "OmniLogic Memory Management: High-throughput memory allocations require bounded cache rings to eliminate fragmentation.",
                "vector": self._pseudo_embedding("OmniLogic Memory Management: High-throughput memory allocations"),
                "metadata": {"source": "sys_arch_v4"}
            }
        ]

        if is_valid_key(self.api_key) and is_network_available():
            try:
                self.pc = Pinecone(api_key=self.api_key)
                self._init_index()
                logger.info(f"Pinecone service initialized with index '{self.index_name}'.")
            except Exception as e:
                logger.warning(f"Could not connect to Pinecone: {e}. Falling back to in-memory vector shard.")
        else:
            logger.info("Pinecone API key not provided, placeholder, or network offline; operating in local in-memory vector mode.")

    def _init_index(self):
        """Attempts to access or create the Pinecone index."""
        if not self.pc:
            return
        try:
            existing_indexes = [idx["name"] for idx in self.pc.list_indexes()]
            if self.index_name not in existing_indexes:
                logger.info(f"Creating Pinecone index '{self.index_name}'...")
                self.pc.create_index(
                    name=self.index_name,
                    dimension=768,
                    metric="cosine",
                    spec=ServerlessSpec(cloud="aws", region="us-east-1")
                )
            self.index = self.pc.Index(self.index_name)
        except Exception as e:
            logger.warning(f"Failed to ensure Pinecone index '{self.index_name}': {e}. Using local store.")
            self.index = None

    def _pseudo_embedding(self, text: str, dimension: int = 768) -> List[float]:
        """Generates a deterministic normalized pseudo-embedding when no API key is available."""
        vec = [0.0] * dimension
        for i, char in enumerate(text):
            idx = (ord(char) * 31 + i * 17) % dimension
            vec[idx] += 1.0
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            vec = [x / norm for x in vec]
        return vec

    async def get_embeddings(self, text: str) -> List[float]:
        """Generates fast deterministic 768-dim normalized embeddings without gRPC latency."""
        return self._pseudo_embedding(text)

    async def upsert_memory(self, doc_id: str, text: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
        """Stores a document with its vector embedding in Pinecone or local memory."""
        meta = metadata or {}
        meta["content"] = text
        embedding = await self.get_embeddings(text)

        if self.index:
            try:
                self.index.upsert(vectors=[(doc_id, embedding, meta)])
                logger.info(f"Successfully upserted doc '{doc_id}' into Pinecone.")
                return True
            except Exception as e:
                logger.warning(f"Failed to upsert to Pinecone: {e}. Storing locally.")

        self._local_memory.append({
            "id": doc_id,
            "content": text,
            "vector": embedding,
            "metadata": meta
        })
        return True

    async def query_memory(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Queries the vector database (Pinecone or local shard) for relevant context."""
        query_vector = await self.get_embeddings(query)

        # 1. Query Pinecone if active
        if self.index:
            try:
                logger.info(f"Querying Pinecone index for: {query[:60]}...")
                response = self.index.query(
                    vector=query_vector,
                    top_k=top_k,
                    include_metadata=True
                )
                results = []
                for match in response.get("matches", []):
                    results.append({
                        "id": match["id"],
                        "score": match["score"],
                        "content": match.get("metadata", {}).get("content", ""),
                        "metadata": match.get("metadata", {})
                    })
                if results:
                    return results
            except Exception as e:
                logger.warning(f"Pinecone query failed: {e}. Checking local memory.")

        # 2. Query Local Shard with cosine similarity
        scored = []
        for item in self._local_memory:
            vec = item["vector"]
            sim = sum(a * b for a, b in zip(query_vector, vec))
            scored.append({
                "id": item["id"],
                "score": round(sim, 4),
                "content": item["content"],
                "metadata": item["metadata"]
            })

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]

vector_service = VectorService()
