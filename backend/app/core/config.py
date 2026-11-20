from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional

BACKEND_DIR = Path(__file__).resolve().parents[2]

class Settings(BaseSettings):
    PROJECT_NAME: str = "OmniLogic Universal Solver"
    API_V1_STR: str = "/api/v1"
    
    # AI Keys
    GOOGLE_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "models/gemini-3.5-flash-lite"
    EMBEDDING_MODEL: str = "models/text-embedding-004"
    TUNED_MODEL_NAME: Optional[str] = None
    TRAINING_DATA_PATH: str = str(BACKEND_DIR / "app" / "training" / "training_dataset.jsonl")
    
    # Database
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None
    
    # Vector DB
    PINECONE_API_KEY: Optional[str] = None
    PINECONE_ENVIRONMENT: Optional[str] = None
    PINECONE_INDEX_NAME: str = "omnilogic-memory"
    
    class Config:
        env_file = str(BACKEND_DIR / ".env")
        case_sensitive = True

settings = Settings()
