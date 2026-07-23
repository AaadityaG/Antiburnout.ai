import os
import uuid
import tempfile
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional
from auth import verify_token
from logger import get_logger

logger = get_logger("kb.routes")

router = APIRouter(prefix="/kb", tags=["Knowledge Base"])

SUPPORTED_TYPES = {
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "text/markdown": ".md",
}


class KBSearchRequest(BaseModel):
    query: str
    k: int = 5


class KBSearchResult(BaseModel):
    doc_id: str
    filename: str
    file_type: str
    score: float
    content: str


class KBDocument(BaseModel):
    doc_id: str
    filename: str
    file_type: str
    page_count: int
    total_chunks: int


class KBUploadResponse(BaseModel):
    doc_id: str
    filename: str
    file_type: str
    chunk_count: int
    char_count: int


@router.post("/upload", response_model=KBUploadResponse)
async def upload_document(token: str, file: UploadFile = File(...)):
    try:
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = payload.get("sub")

        # Validate file type
        content_type = file.content_type
        if content_type not in SUPPORTED_TYPES:
            ext = os.path.splitext(file.filename or "")[1].lower()
            if ext not in {".pdf", ".txt", ".md"}:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file type: {content_type}. Supported: PDF, TXT, MD",
                )
            file_ext = ext
        else:
            file_ext = SUPPORTED_TYPES[content_type]

        # Save uploaded file to temp location
        doc_id = str(uuid.uuid4())
        suffix = file_ext or ".pdf"

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        try:
            from kb.extractor import extract_text
            from kb.vector_store import store_document

            text = extract_text(tmp_path)

            if not text.strip():
                raise HTTPException(status_code=400, detail="Could not extract text from file. The file may be empty or image-based.")

            # Count pages for PDFs
            page_count = 1
            if suffix == ".pdf":
                try:
                    import fitz
                    doc = fitz.open(tmp_path)
                    page_count = len(doc)
                    doc.close()
                except Exception:
                    page_count = 1

            chunk_count = store_document(
                user_id=user_id,
                doc_id=doc_id,
                filename=file.filename or f"document{suffix}",
                file_type=suffix.lstrip("."),
                text=text,
                page_count=page_count,
            )

            logger.info(
                "KB document uploaded",
                user_id=user_id,
                doc_id=doc_id,
                filename=file.filename,
                chars=len(text),
                chunks=chunk_count,
            )

            return KBUploadResponse(
                doc_id=doc_id,
                filename=file.filename or f"document{suffix}",
                file_type=suffix.lstrip("."),
                chunk_count=chunk_count,
                char_count=len(text),
            )
        finally:
            os.unlink(tmp_path)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("KB upload failed", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/documents", response_model=list[KBDocument])
async def list_documents(token: str):
    try:
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = payload.get("sub")
        from kb.vector_store import list_documents
        docs = list_documents(user_id)
        return docs

    except HTTPException:
        raise
    except Exception as e:
        logger.error("KB list failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/documents/{doc_id}")
async def delete_document(token: str, doc_id: str):
    try:
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = payload.get("sub")
        from kb.vector_store import delete_document
        deleted = delete_document(user_id, doc_id)

        if not deleted:
            raise HTTPException(status_code=404, detail="Document not found")

        return {"message": "Document deleted", "doc_id": doc_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("KB delete failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search")
async def search_knowledge_base(token: str, request: KBSearchRequest):
    try:
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = payload.get("sub")
        from kb.vector_store import search_documents
        results = search_documents(user_id, request.query, k=request.k)

        return {
            "results": results,
            "query": request.query,
            "total": len(results),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("KB search failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
