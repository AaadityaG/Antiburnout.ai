from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from auth import verify_token
from db import db, chat_history_db
from services.encryption import decrypt_api_key
from services.agent_runner import run_agent
from datetime import datetime

router = APIRouter(prefix="/chat", tags=["Chat"])


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[Message]] = []
    model_key: Optional[str] = None
    session_id: Optional[str] = None
    brightness: Optional[int] = None
    volume: Optional[int] = None
    local_hour: Optional[int] = None


class ChatResponse(BaseModel):
    response: str
    model: str
    provider: str
    session_id: str
    recommendations: Optional[List[dict]] = []
    tools_used: Optional[List[str]] = []


@router.post("/send", response_model=ChatResponse)
async def send_message(token: str, request: ChatRequest):
    try:
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = payload.get("sub")
        user = db.get_user_by_id(user_id)

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        ai_providers = user.get("ai_providers", {})
        if not ai_providers:
            raise HTTPException(
                status_code=400,
                detail="No AI provider configured. Please add one in Profile Settings.",
            )

        provider_key = request.model_key or list(ai_providers.keys())[0]
        if provider_key not in ai_providers:
            raise HTTPException(
                status_code=400,
                detail=f"Model '{provider_key}' not found. Please select a valid model.",
            )

        provider_config = ai_providers[provider_key]
        device_id = user.get("device_id", "")
        api_key = decrypt_api_key(provider_config["api_key"], device_id)

        print(f"[Chat] Provider: {provider_key}, Model: {provider_config['model']}, Key starts: {api_key[:12]}...")

        system_metrics = {}
        if request.brightness is not None:
            system_metrics["brightness"] = request.brightness
        if request.volume is not None:
            system_metrics["volume"] = request.volume
        if request.local_hour is not None:
            system_metrics["local_hour"] = request.local_hour

        ai_response, recommendations, tools_used = await run_agent(
            api_key=api_key,
            model=provider_config["model"],
            user=user,
            system_metrics=system_metrics,
            message=request.message,
            conversation_history=request.conversation_history,
        )

        session_id = ""
        try:
            if request.session_id:
                chat_history_db.add_message_to_session(
                    user_id=user_id,
                    session_id=request.session_id,
                    message=request.message,
                    response=ai_response,
                    model=provider_config["model"],
                    provider_key=provider_key,
                )
                session_id = request.session_id
            else:
                session_doc = chat_history_db.create_session(
                    user_id=user_id,
                    first_message=request.message,
                    first_response=ai_response,
                    model=provider_config["model"],
                    provider_key=provider_key,
                )
                session_id = session_doc["id"]
        except Exception as e:
            print(f"Warning: Failed to save chat history: {e}")

        try:
            from rag.vector_store import get_user_collection
            from datetime import datetime as _dt
            collection = get_user_collection(user_id)
            doc_text = f"User: {request.message}\nAI: {ai_response}"
            doc_id = f"{session_id}_{_dt.utcnow().strftime('%Y%m%d%H%M%S%f')}"
            collection.add_texts(
                texts=[doc_text],
                ids=[doc_id],
                metadatas=[{
                    "user_id": user_id,
                    "session_id": session_id,
                    "timestamp": _dt.utcnow().isoformat(),
                    "tools_used": ",".join(tools_used) if tools_used else "",
                }],
            )
        except Exception as e:
            print(f"Warning: Failed to store in vector DB: {e}")

        return ChatResponse(
            response=ai_response,
            model=provider_config["model"],
            provider=provider_config.get("provider", "openrouter"),
            session_id=session_id,
            recommendations=recommendations,
            tools_used=tools_used,
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")
