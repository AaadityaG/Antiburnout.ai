import uuid
from typing import Optional
from datetime import datetime
from db.connection import USE_MONGO, chat_history_collection, _mem_chat_history, _persist


def _gen_id():
    return str(uuid.uuid4())


class ChatHistoryDB:
    def __init__(self):
        pass

    def create_session(self, user_id: str, first_message: str, first_response: str, model: str, provider_key: str = None) -> dict:
        if USE_MONGO:
            from bson import ObjectId
            session_doc = {
                "user_id": ObjectId(user_id),
                "messages": [
                    {
                        "message": first_message,
                        "response": first_response,
                        "model": model,
                        "provider_key": provider_key,
                        "timestamp": datetime.utcnow()
                    }
                ],
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            result = chat_history_collection.insert_one(session_doc)
            session_doc["id"] = str(result.inserted_id)
            session_doc.pop("_id", None)
            session_doc.pop("user_id", None)
            return session_doc
        session = {
            "id": _gen_id(),
            "user_id": user_id,
            "messages": [
                {
                    "message": first_message,
                    "response": first_response,
                    "model": model,
                    "provider_key": provider_key,
                    "timestamp": datetime.utcnow()
                }
            ],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        _mem_chat_history.append(session)
        _persist()
        return {k: v for k, v in session.items() if k != "user_id"}

    def add_message_to_session(self, user_id: str, session_id: str, message: str, response: str, model: str, provider_key: str = None) -> dict:
        if USE_MONGO:
            from bson import ObjectId
            chat_history_collection.update_one(
                {"_id": ObjectId(session_id), "user_id": ObjectId(user_id)},
                {
                    "$push": {
                        "messages": {
                            "message": message,
                            "response": response,
                            "model": model,
                            "provider_key": provider_key,
                            "timestamp": datetime.utcnow()
                        }
                    },
                    "$set": {"updated_at": datetime.utcnow()}
                }
            )
            return {"success": True}
        for s in _mem_chat_history:
            if s["id"] == session_id and s["user_id"] == user_id:
                s["messages"].append({
                    "message": message,
                    "response": response,
                    "model": model,
                    "provider_key": provider_key,
                    "timestamp": datetime.utcnow()
                })
                s["updated_at"] = datetime.utcnow()
                _persist()
                return {"success": True}
        return {"success": False}

    def get_user_sessions(self, user_id: str, limit: int = 20) -> list:
        if USE_MONGO:
            from bson import ObjectId
            sessions = list(
                chat_history_collection.find({"user_id": ObjectId(user_id)})
                .sort("updated_at", -1)
                .limit(limit)
            )
            formatted = []
            for session in sessions:
                formatted.append({
                    "id": str(session["_id"]),
                    "message_count": len(session.get("messages", [])),
                    "first_message": session["messages"][0]["message"] if session.get("messages") else "",
                    "last_message": session["messages"][-1]["message"] if session.get("messages") else "",
                    "models_used": list(set(msg.get("model", "unknown") for msg in session.get("messages", []))),
                    "created_at": session["created_at"].isoformat(),
                    "updated_at": session["updated_at"].isoformat()
                })
            return formatted
        user_sessions = [s for s in _mem_chat_history if s["user_id"] == user_id]
        user_sessions.sort(key=lambda x: str(x["updated_at"]), reverse=True)
        formatted = []
        for session in user_sessions[:limit]:
            formatted.append({
                "id": session["id"],
                "message_count": len(session.get("messages", [])),
                "first_message": session["messages"][0]["message"] if session.get("messages") else "",
                "last_message": session["messages"][-1]["message"] if session.get("messages") else "",
                "models_used": list(set(msg.get("model", "unknown") for msg in session.get("messages", []))),
                "created_at": session["created_at"].isoformat() if hasattr(session["created_at"], "isoformat") else str(session["created_at"]),
                "updated_at": session["updated_at"].isoformat() if hasattr(session["updated_at"], "isoformat") else str(session["updated_at"])
            })
        return formatted

    def get_session_messages(self, user_id: str, session_id: str) -> Optional[dict]:
        if USE_MONGO:
            from bson import ObjectId
            session = chat_history_collection.find_one({
                "_id": ObjectId(session_id),
                "user_id": ObjectId(user_id)
            })
            if session:
                formatted_messages = []
                for msg in session.get("messages", []):
                    formatted_messages.append({
                        "message": msg["message"],
                        "response": msg["response"],
                        "model": msg.get("model", "unknown"),
                        "provider_key": msg.get("provider_key"),
                        "timestamp": msg["timestamp"].isoformat() if isinstance(msg["timestamp"], datetime) else msg["timestamp"]
                    })
                return {
                    "id": str(session["_id"]),
                    "messages": formatted_messages,
                    "created_at": session["created_at"].isoformat(),
                    "updated_at": session["updated_at"].isoformat()
                }
            return None
        for s in _mem_chat_history:
            if s["id"] == session_id and s["user_id"] == user_id:
                formatted_messages = []
                for msg in s.get("messages", []):
                    formatted_messages.append({
                        "message": msg["message"],
                        "response": msg["response"],
                        "model": msg.get("model", "unknown"),
                        "provider_key": msg.get("provider_key"),
                        "timestamp": msg["timestamp"].isoformat() if isinstance(msg["timestamp"], datetime) else msg["timestamp"]
                    })
                return {
                    "id": s["id"],
                    "messages": formatted_messages,
                    "created_at": s["created_at"].isoformat() if hasattr(s["created_at"], "isoformat") else str(s["created_at"]),
                    "updated_at": s["updated_at"].isoformat() if hasattr(s["updated_at"], "isoformat") else str(s["updated_at"])
                }
        return None

    def delete_session(self, user_id: str, session_id: str) -> bool:
        if USE_MONGO:
            from bson import ObjectId
            result = chat_history_collection.delete_one({
                "_id": ObjectId(session_id),
                "user_id": ObjectId(user_id)
            })
            return result.deleted_count > 0
        for i, s in enumerate(_mem_chat_history):
            if s["id"] == session_id and s["user_id"] == user_id:
                _mem_chat_history.pop(i)
                _persist()
                return True
        return False

    def clear_user_history(self, user_id: str) -> int:
        if USE_MONGO:
            from bson import ObjectId
            result = chat_history_collection.delete_many({"user_id": ObjectId(user_id)})
            return result.deleted_count
        before = len(_mem_chat_history)
        _mem_chat_history[:] = [s for s in _mem_chat_history if s["user_id"] != user_id]
        _persist()
        return before - len(_mem_chat_history)
