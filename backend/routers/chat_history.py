from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from auth import verify_token
from database import db, chat_history_db

router = APIRouter(prefix="/chat/history", tags=["Chat History"])

class ChatHistoryResponse(BaseModel):
    id: str
    message: str
    response: str
    model: str
    created_at: str

class ClearHistoryResponse(BaseModel):
    deleted_count: int
    message: str

@router.get("/", response_model=List[ChatHistoryResponse])
async def get_chat_history(token: str, limit: int = 50):
    """Get chat history for authenticated user"""
    try:
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_id = payload.get("sub")
        messages = chat_history_db.get_user_conversations(user_id, limit)
        
        return messages
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get chat history: {str(e)}")

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

@router.delete("/{message_id}")
async def delete_message(token: str, message_id: str):
    """Delete a specific chat message"""
    try:
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_id = payload.get("sub")
        success = chat_history_db.delete_conversation(user_id, message_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Message not found")
        
        return {"message": "Message deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete message: {str(e)}")
