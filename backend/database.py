import os
import uuid
from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MongoDB Configuration
MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "app_local")

USE_MONGO = False
client = None
db = None
users_collection = None
settings_collection = None
chat_history_collection = None
activity_collection = None

print(f"Connecting to MongoDB...")
print(f"URI: {MONGODB_URI[:20] if MONGODB_URI else 'N/A'}...****")
print(f"Database: {MONGODB_DB_NAME}")

try:
    from pymongo import MongoClient
    client = MongoClient(
        MONGODB_URI,
        serverSelectionTimeoutMS=10000,
        connectTimeoutMS=10000,
        socketTimeoutMS=10000,
        tls=True,
        tlsAllowInvalidCertificates=False,
        retryWrites=True,
        w="majority"
    )
    client.admin.command('ping')
    db = client[MONGODB_DB_NAME]

    users_collection = db["users"]
    settings_collection = db["settings"]
    chat_history_collection = db["chatbot-history"]
    activity_collection = db["activity"]

    users_collection.create_index("device_id", unique=True)
    users_collection.create_index("email")
    settings_collection.create_index("user_id", unique=True)
    chat_history_collection.create_index("user_id")
    chat_history_collection.create_index("created_at")
    activity_collection.create_index([("user_id", 1), ("date", -1)])

    USE_MONGO = True
    print(f"[OK] MongoDB Connected Successfully!")
    print(f"[OK] Database: {MONGODB_DB_NAME}")
    print(f"[OK] Collections: users, settings")
except Exception as e:
    print(f"[WARN] MongoDB Connection Failed: {str(e)[:80]}")
    print(f"[WARN] Using file-backed storage (data persists in local_db.json)")

    import json as _json
    _DB_FILE = os.path.join(os.path.dirname(__file__), "local_db.json")

    def _load_db():
        if os.path.exists(_DB_FILE):
            with open(_DB_FILE, "r", encoding="utf-8") as f:
                return _json.load(f)
        return {"users": [], "settings": {}, "chat_history": [], "activity": []}

    def _save_db(data):
        with open(_DB_FILE, "w", encoding="utf-8") as f:
            _json.dump(data, f, indent=2, default=str)

    _db_data = _load_db()
    _mem_users = _db_data["users"]
    _mem_settings = _db_data["settings"]
    _mem_chat_history = _db_data.get("chat_history", [])
    _mem_activity = _db_data.get("activity", [])

    def _persist():
        _save_db({"users": _mem_users, "settings": _mem_settings, "chat_history": _mem_chat_history, "activity": _mem_activity})


def _gen_id():
    return str(uuid.uuid4())


def _now():
    return datetime.utcnow()


class User(BaseModel):
    id: str
    device_id: str
    device_name: str
    name: str = ""
    email: str = ""
    created_at: str
    last_login: str


class UserDB:
    def __init__(self):
        pass

    def get_user_by_email(self, email: str) -> Optional[dict]:
        if USE_MONGO:
            user = users_collection.find_one({"email": email})
            if user:
                user["id"] = str(user["_id"])
                user.pop("_id", None)
            return user
        for u in _mem_users:
            if u.get("email") == email:
                return dict(u)
        return None

    def get_user_by_device_id(self, device_id: str) -> Optional[dict]:
        if USE_MONGO:
            user = users_collection.find_one({"device_id": device_id})
            if user:
                user["id"] = str(user["_id"])
                user.pop("_id", None)
            return user
        for u in _mem_users:
            if u.get("device_id") == device_id:
                return dict(u)
        return None

    def get_user_by_id(self, user_id: str) -> Optional[dict]:
        if USE_MONGO:
            from bson import ObjectId
            try:
                user = users_collection.find_one({"_id": ObjectId(user_id)})
                if user:
                    user["id"] = str(user["_id"])
                    user.pop("_id", None)
                    return user
                return None
            except Exception as e:
                print(f"[UserDB] Error: {e}")
                return None
        for u in _mem_users:
            if u.get("id") == user_id:
                return dict(u)
        return None

    def create_user(self, user_data: dict) -> dict:
        if USE_MONGO:
            result = users_collection.insert_one(user_data)
            user_data["id"] = str(result.inserted_id)
            return user_data
        user_data["id"] = _gen_id()
        _mem_users.append(dict(user_data))
        _persist()
        return user_data

    def update_user(self, user_id: str, update_data: dict) -> Optional[dict]:
        if USE_MONGO:
            from bson import ObjectId
            try:
                result = users_collection.update_one(
                    {"_id": ObjectId(user_id)},
                    {"$set": update_data}
                )
                if result.modified_count > 0:
                    return self.get_user_by_id(user_id)
                return None
            except Exception as e:
                print(f"[UserDB] Error updating user: {e}")
                return None
        for u in _mem_users:
            if u.get("id") == user_id:
                u.update(update_data)
                _persist()
                return dict(u)
        return None


class SettingsDB:
    def __init__(self):
        pass

    def get_user_settings(self, user_id: str) -> Optional[dict]:
        if USE_MONGO:
            from bson import ObjectId
            try:
                settings = settings_collection.find_one({"user_id": ObjectId(user_id)})
                if settings:
                    settings.pop("_id", None)
                    settings.pop("user_id", None)
                    return settings
                return None
            except Exception as e:
                print(f"[SettingsDB] Error getting settings: {e}")
                return None
        settings = _mem_settings.get(user_id)
        if settings:
            return dict(settings)
        return None

    def save_user_settings(self, user_id: str, settings_data: dict) -> dict:
        if USE_MONGO:
            from bson import ObjectId
            try:
                settings_collection.update_one(
                    {"user_id": ObjectId(user_id)},
                    {"$set": {
                        "break_interval": settings_data["break_interval"],
                        "break_duration": settings_data["break_duration"],
                        "auto_start": settings_data["auto_start"]
                    }},
                    upsert=True
                )
                return settings_data
            except Exception as e:
                print(f"[SettingsDB] Error saving settings: {e}")
                import traceback
                traceback.print_exc()
                raise
        _mem_settings[user_id] = {
            "break_interval": settings_data["break_interval"],
            "break_duration": settings_data["break_duration"],
            "auto_start": settings_data["auto_start"]
        }
        _persist()
        return settings_data


db = UserDB()
settings_db = SettingsDB()


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


chat_history_db = ChatHistoryDB()


class ActivityDB:
    def save_session(self, user_id: str, session_data: dict) -> dict:
        if USE_MONGO:
            from bson import ObjectId
            today = datetime.utcnow().strftime("%Y-%m-%d")
            existing = activity_collection.find_one({
                "user_id": ObjectId(user_id),
                "date": today
            })
            if existing:
                activity_collection.update_one(
                    {"_id": existing["_id"]},
                    {
                        "$push": {
                            "sessions": {
                                "session_duration": session_data["session_duration"],
                                "target_duration": session_data["target_duration"],
                                "completed": session_data["completed"],
                                "skipped": session_data.get("skipped", False),
                                "timestamp": datetime.utcnow()
                            }
                        },
                        "$inc": {
                            "total_session_duration": session_data["session_duration"],
                            "total_breaks_taken": 1,
                            "total_breaks_skipped": 1 if session_data.get("skipped") else 0
                        },
                        "$set": {"last_updated": datetime.utcnow()}
                    }
                )
            else:
                activity_collection.insert_one({
                    "user_id": ObjectId(user_id),
                    "date": today,
                    "sessions": [{
                        "session_duration": session_data["session_duration"],
                        "target_duration": session_data["target_duration"],
                        "completed": session_data["completed"],
                        "skipped": session_data.get("skipped", False),
                        "timestamp": datetime.utcnow()
                    }],
                    "total_session_duration": session_data["session_duration"],
                    "total_breaks_taken": 1,
                    "total_breaks_skipped": 1 if session_data.get("skipped") else 0,
                    "last_updated": datetime.utcnow()
                })
            return {"status": "ok", "date": today}
        today = datetime.utcnow().strftime("%Y-%m-%d")
        for r in _mem_activity:
            if r["user_id"] == user_id and r["date"] == today:
                r["sessions"].append({
                    "session_duration": session_data["session_duration"],
                    "target_duration": session_data["target_duration"],
                    "completed": session_data["completed"],
                    "skipped": session_data.get("skipped", False),
                    "timestamp": datetime.utcnow()
                })
                r["total_session_duration"] += session_data["session_duration"]
                r["total_breaks_taken"] += 1
                if session_data.get("skipped"):
                    r["total_breaks_skipped"] += 1
                r["last_updated"] = datetime.utcnow()
                _persist()
                return {"status": "ok", "date": today}
        _mem_activity.append({
            "user_id": user_id,
            "date": today,
            "sessions": [{
                "session_duration": session_data["session_duration"],
                "target_duration": session_data["target_duration"],
                "completed": session_data["completed"],
                "skipped": session_data.get("skipped", False),
                "timestamp": datetime.utcnow()
            }],
            "total_session_duration": session_data["session_duration"],
            "total_breaks_taken": 1,
            "total_breaks_skipped": 1 if session_data.get("skipped") else 0,
            "last_updated": datetime.utcnow()
        })
        _persist()
        return {"status": "ok", "date": today}

    def get_user_activity(self, user_id: str, days: int = 7) -> list:
        if USE_MONGO:
            from bson import ObjectId
            from datetime import timedelta
            start_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
            records = list(
                activity_collection.find({
                    "user_id": ObjectId(user_id),
                    "date": {"$gte": start_date}
                }).sort("date", -1)
            )
            formatted = []
            for r in records:
                formatted.append({
                    "date": r["date"],
                    "total_session_duration": r.get("total_session_duration", 0),
                    "total_breaks_taken": r.get("total_breaks_taken", 0),
                    "total_breaks_skipped": r.get("total_breaks_skipped", 0),
                    "sessions_count": len(r.get("sessions", []))
                })
            return formatted
        from datetime import timedelta
        start_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
        user_records = [r for r in _mem_activity if r["user_id"] == user_id and r["date"] >= start_date]
        user_records.sort(key=lambda x: x["date"], reverse=True)
        formatted = []
        for r in user_records:
            formatted.append({
                "date": r["date"],
                "total_session_duration": r.get("total_session_duration", 0),
                "total_breaks_taken": r.get("total_breaks_taken", 0),
                "total_breaks_skipped": r.get("total_breaks_skipped", 0),
                "sessions_count": len(r.get("sessions", []))
            })
        return formatted

    def get_user_activity_by_date(self, user_id: str, date: str) -> Optional[dict]:
        if USE_MONGO:
            from bson import ObjectId
            record = activity_collection.find_one({
                "user_id": ObjectId(user_id),
                "date": date
            })
            if record:
                record["id"] = str(record["_id"])
                record.pop("_id", None)
                record.pop("user_id", None)
                return record
            return None
        for r in _mem_activity:
            if r["user_id"] == user_id and r["date"] == date:
                copy = dict(r)
                copy.pop("user_id", None)
                return copy
        return None


activity_db = ActivityDB()
