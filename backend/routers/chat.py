from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from auth import verify_token
from database import db, chat_history_db
from routers.device_auth import decrypt_api_key
from datetime import datetime
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage

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

        from agent.graph import create_agent_graph, build_system_prompt

        system_prompt = build_system_prompt(user, system_metrics if system_metrics else None)

        initial_messages = [{"role": "system", "content": system_prompt}]
        for msg in (request.conversation_history or [])[-10:]:
            initial_messages.append({"role": msg.role, "content": msg.content})
        initial_messages.append({"role": "user", "content": request.message})

        graph = create_agent_graph(
            api_key=api_key,
            model=provider_config["model"],
            user=user,
            system_metrics=system_metrics if system_metrics else None,
        )

        print(f"[Chat] Running agent for user {user_id} with model {provider_config['model']}")

        final_state = await graph.ainvoke(
            {"messages": initial_messages},
            config={"recursion_limit": 10},
        )

        print(f"[Chat] Agent completed, processed {len(final_state['messages'])} messages")

        ai_response = ""
        recommendations = []
        tools_used = []

        for msg in final_state["messages"]:
            if isinstance(msg, AIMessage):
                if msg.content:
                    ai_response = msg.content
                if msg.tool_calls:
                    for tc in msg.tool_calls:
                        tool_name = tc.get("name", "")
                        if tool_name and tool_name not in tools_used:
                            tools_used.append(tool_name)
            if isinstance(msg, ToolMessage):
                try:
                    import json
                    content = msg.content
                    if isinstance(content, str):
                        content = json.loads(content)
                    if isinstance(content, dict) and content.get("has_recommendations"):
                        is_auto = content.get("auto_apply", False)
                        for rec in content.get("recommendations", []):
                            recommendations.append({
                                "id": f"{rec['type']}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
                                "type": rec["type"],
                                "title": f"{'Reduce' if rec['action'] == 'decrease' else 'Increase' if rec['action'] == 'increase' else rec['action'].title()} {rec['type'].replace('_', ' ').title()}",
                                "message": rec["reason"],
                                "priority": rec["priority"],
                                "action_type": "auto_execute" if is_auto else "execute",
                                "execute_endpoint": f"agent/execute/{rec['type']}",
                                "execute_params": rec["execute_params"],
                                "created_at": datetime.utcnow().isoformat(),
                            })
                    if isinstance(content, dict) and content.get("success") and content.get("mood"):
                        is_auto = content.get("auto_play", False)
                        recommendations.append({
                            "id": f"music_{content['mood']}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
                            "type": "music",
                            "title": f"{content['emoji']} Play {content['label']} Music",
                            "message": content["message"],
                            "priority": 3,
                            "action_type": "auto_play_music" if is_auto else "play_music",
                            "mood": content["mood"],
                            "created_at": datetime.utcnow().isoformat(),
                        })
                    if isinstance(content, dict) and content.get("tip") and content.get("auto_apply"):
                        recommendations.append({
                            "id": f"break_{content.get('category', 'general')}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
                            "type": "break_tip",
                            "title": f"Configure Break: {content['tip']}",
                            "message": content.get("instruction", ""),
                            "priority": 3,
                            "action_type": "auto_configure_breaks",
                            "tip": content,
                            "created_at": datetime.utcnow().isoformat(),
                        })
                except Exception:
                    pass

        if not ai_response:
            ai_response = "I'm here to help you stay well! What's on your mind?"

        print(f"[Chat] Tools used: {tools_used}, recommendations: {len(recommendations)}")

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
