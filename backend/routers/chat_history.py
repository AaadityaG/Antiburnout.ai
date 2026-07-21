from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from auth import verify_token
from db import db, chat_history_db

router = APIRouter(prefix="/chat/history", tags=["Chat History"])

class ChatSessionResponse(BaseModel):
    id: str
    message_count: int
    first_message: str
    last_message: str
    models_used: list
    created_at: str
    updated_at: str

class ChatMessageResponse(BaseModel):
    message: str
    response: str
    model: str
    provider_key: Optional[str] = None
    timestamp: str

class SessionDetailResponse(BaseModel):
    id: str
    messages: List[ChatMessageResponse]
    created_at: str
    updated_at: str

class ClearHistoryResponse(BaseModel):
    deleted_count: int
    message: str

class SearchRequest(BaseModel):
    query: str
    k: Optional[int] = 5

class SearchResult(BaseModel):
    content: str
    session_id: str
    timestamp: str
    score: Optional[float] = None

class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    count: int

@router.get("/", response_model=List[ChatSessionResponse])
async def get_chat_history(token: str, limit: int = 20):
    """Get chat session list for authenticated user"""
    try:
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_id = payload.get("sub")
        sessions = chat_history_db.get_user_sessions(user_id, limit)
        
        return sessions
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error in get_chat_history: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to get chat history: {str(e)}")

@router.post("/search", response_model=SearchResponse)
async def search_chat_history(token: str, request: SearchRequest):
    """Search chat history using semantic similarity"""
    try:
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = payload.get("sub")

        from rag.vector_store import get_user_collection
        collection = get_user_collection(user_id)

        results = collection.similarity_search_with_relevance_scores(
            query=request.query,
            k=request.k or 2,
        )

        formatted = []
        for doc, score in results:
            formatted.append({
                "content": doc.page_content,
                "session_id": doc.metadata.get("session_id", ""),
                "timestamp": doc.metadata.get("timestamp", ""),
                "score": round(score, 4),
            })

        return SearchResponse(
            query=request.query,
            results=formatted,
            count=len(formatted),
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error in search_chat_history: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to search chat history: {str(e)}")

@router.get("/{session_id}", response_model=SessionDetailResponse)
async def get_session_messages(token: str, session_id: str):
    """Get all messages in a specific session"""
    try:
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_id = payload.get("sub")
        session = chat_history_db.get_session_messages(user_id, session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return session
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error in get_session_messages: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to get session: {str(e)}")

@router.delete("/clear", response_model=ClearHistoryResponse)
async def clear_chat_history(token: str):
    """Clear all chat history for authenticated user"""
    try:
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_id = payload.get("sub")
        deleted_count = chat_history_db.clear_user_history(user_id)
        
        return ClearHistoryResponse(
            deleted_count=deleted_count,
            message=f"Successfully deleted {deleted_count} messages"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear chat history: {str(e)}")

@router.delete("/{session_id}")
async def delete_session(token: str, session_id: str):
    """Delete a specific chat session"""
    try:
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_id = payload.get("sub")
        success = chat_history_db.delete_session(user_id, session_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {"message": "Session deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete session: {str(e)}")
