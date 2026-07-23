import os
import chromadb
from chromadb.config import Settings
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

# Directory where ChromaDB stores its persistent data (vectors, index files)
CHROMA_PERSIST_DIR = os.path.join(os.path.dirname(__file__), "chroma_db")

# Chunking parameters for splitting long text before embedding.
# The all-MiniLM-L6-v2 model accepts max 512 tokens (~384 words).
# We use 300 words per chunk to stay safely within the limit.
CHUNK_SIZE = 300    # max words per chunk
# Overlap ensures context is preserved at chunk boundaries.
# Example: Chunk 1 ends with "sleep 7-8 hours", Chunk 2 starts with
# "sleep 7-8 hours" — so searching "sleep" finds Chunk 2 even though
# the phrase was split across chunks.
CHUNK_OVERLAP = 50  # words repeated between consecutive chunks


def chunk_text(text: str) -> list[str]:
    """Split text into overlapping word-level chunks for vector embedding.

    Why this exists:
        The embedding model truncates text beyond ~512 tokens silently.
        Long AI responses would lose content without chunking.

    How it works:
        1. Split text into words
        2. If words <= CHUNK_SIZE, return as-is (no splitting needed)
        3. Otherwise, create overlapping windows of CHUNK_SIZE words
        4. Each window slides forward by (CHUNK_SIZE - CHUNK_OVERLAP) words

    Example with CHUNK_SIZE=4, CHUNK_OVERLAP=1:
        Input: "a b c d e f g h"
        Chunk 0: "a b c d"      (words 0-3)
        Chunk 1: "b c d e"      (words 1-4, overlap of 1 word)
        Chunk 2: "d e f g"      (words 3-6)
        Chunk 3: "e f g h"      (words 4-7)

    Returns:
        List of text chunks. Single element if no splitting was needed.
    """
    words = text.split()

    # Short text fits within model's token limit — no chunking needed
    if len(words) <= CHUNK_SIZE:
        return [text]

    chunks = []
    start = 0
    while start < len(words):
        end = start + CHUNK_SIZE
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        # Slide forward: skip (CHUNK_SIZE - CHUNK_OVERLAP) words so next
        # chunk starts with the last CHUNK_OVERLAP words of this chunk
        start += CHUNK_SIZE - CHUNK_OVERLAP

    return chunks


# Singleton instances — created once, reused across all requests.
# This avoids reloading the embedding model (~80MB) on every API call.
_embedding_model = None
_chroma_client = None


def get_embeddings():
    """Return the shared HuggingFace embedding model instance.

    Uses all-MiniLM-L6-v2 which produces 384-dimensional vectors.
    Runs on CPU (no GPU required). Embeddings are normalized for
    cosine similarity search in ChromaDB.
    """
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = HuggingFaceEmbeddings(
            model_name="all-MiniLM-L6-v2",
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
    return _embedding_model


def get_chroma_client():
    """Return the shared ChromaDB persistent client instance.

    Stores vector data on disk at CHROMA_PERSIST_DIR so data survives
    server restarts. Telemetry is disabled for privacy.
    """
    global _chroma_client
    if _chroma_client is None:
        os.makedirs(CHROMA_PERSIST_DIR, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(
            path=CHROMA_PERSIST_DIR,
            settings=Settings(anonymized_telemetry=False),
        )
    return _chroma_client


def get_user_collection(user_id: str) -> Chroma:
    """Get or create a Chroma collection for a specific user.

    Each user gets their own isolated collection named chat_history_{user_id}.
    This ensures users can only search their own conversations, not others'.

    The user_id has dashes replaced with underscores because ChromaDB
    collection names don't support dashes.
    """
    client = get_chroma_client()
    safe_id = user_id.replace("-", "_")
    collection_name = f"chat_history_{safe_id}"

    return Chroma(
        client=client,
        collection_name=collection_name,
        embedding_function=get_embeddings(),
    )
