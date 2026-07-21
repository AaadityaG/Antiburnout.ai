import os
import chromadb
from chromadb.config import Settings
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

CHROMA_PERSIST_DIR = os.path.join(os.path.dirname(__file__), "chroma_db")

_embedding_model = None
_chroma_client = None


def get_embeddings():
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = HuggingFaceEmbeddings(
            model_name="all-MiniLM-L6-v2",
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
    return _embedding_model


def get_chroma_client():
    global _chroma_client
    if _chroma_client is None:
        os.makedirs(CHROMA_PERSIST_DIR, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(
            path=CHROMA_PERSIST_DIR,
            settings=Settings(anonymized_telemetry=False),
        )
    return _chroma_client


def get_user_collection(user_id: str) -> Chroma:
    client = get_chroma_client()
    safe_id = user_id.replace("-", "_")
    collection_name = f"chat_history_{safe_id}"

    return Chroma(
        client=client,
        collection_name=collection_name,
        embedding_function=get_embeddings(),
    )
