import os
from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MongoDB Configuration
MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "app_local")

print(f"Connecting to MongoDB...")
print(f"URI: {MONGODB_URI[:20]}...****")
print(f"Database: {MONGODB_DB_NAME}")

try:
    # Initialize MongoDB client with TLS/SSL configuration
    client = MongoClient(
        MONGODB_URI,
        serverSelectionTimeoutMS=10000,
        connectTimeoutMS=10000,
        socketTimeoutMS=10000,
        tls=True,
        retryWrites=True,
        w="majority"
    )
    # Test connection
    client.admin.command('ping')
    db = client[MONGODB_DB_NAME]
    
    # Collections
    users_collection = db["users"]
    settings_collection = db["settings"]
    chat_history_collection = db["chatbot-history"]
    activity_collection = db["activity"]

    # Create indexes for faster lookups
    users_collection.create_index("device_id", unique=True)
    users_collection.create_index("email")
    settings_collection.create_index("user_id", unique=True)
    chat_history_collection.create_index("user_id")
    chat_history_collection.create_index("created_at")
    activity_collection.create_index([("user_id", 1), ("date", -1)])
    
    print(f"✓ MongoDB Connected Successfully!")
    print(f"✓ Database: {MONGODB_DB_NAME}")
    print(f"✓ Collections: users, settings")
except Exception as e:
    print(f"✗ MongoDB Connection Failed: {str(e)}")
    raise


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
        # MongoDB collections are already initialized above
        pass

    def get_user_by_email(self, email: str) -> Optional[dict]:
        user = users_collection.find_one({"email": email})
        if user:
            user["id"] = str(user["_id"])
            user.pop("_id", None)
        return user

    def get_user_by_device_id(self, device_id: str) -> Optional[dict]:
        user = users_collection.find_one({"device_id": device_id})
        if user:
            user["id"] = str(user["_id"])
            user.pop("_id", None)
        return user

    def get_user_by_id(self, user_id: str) -> Optional[dict]:
        from bson import ObjectId
        try:
            print(f"[UserDB] Getting user by ID: {user_id}")
            user = users_collection.find_one({"_id": ObjectId(user_id)})
            if user:
                print(f"[UserDB] Found user: {user.get('email')}")
                user["id"] = str(user["_id"])
                user.pop("_id", None)
                return user
            else:
                print(f"[UserDB] User not found")
                return None
        except Exception as e:
            print(f"[UserDB] Error: {e}")
            return None

    def create_user(self, user_data: dict) -> dict:
        print(f"[UserDB] Creating user: {user_data.get('email')}")
        result = users_collection.insert_one(user_data)
        user_data["id"] = str(result.inserted_id)
        print(f"[UserDB] User created with ID: {result.inserted_id}")
        return user_data

    def update_user(self, user_id: str, update_data: dict) -> Optional[dict]:
        from bson import ObjectId
        try:
            print(f"[UserDB] Updating user: {user_id}")
            print(f"[UserDB] Update data keys: {list(update_data.keys())}")
            result = users_collection.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": update_data}
            )
            print(f"[UserDB] Update result - Modified: {result.modified_count}")
            if result.modified_count > 0:
                return self.get_user_by_id(user_id)
            return None
        except Exception as e:
            print(f"[UserDB] Error updating user: {e}")
            return None


class SettingsDB:
    def __init__(self):
        pass

    def get_user_settings(self, user_id: str) -> Optional[dict]:
        """Get settings for a specific user"""
        from bson import ObjectId
        try:
            print(f"[SettingsDB] Getting settings for user_id: {user_id}")
            settings = settings_collection.find_one({"user_id": ObjectId(user_id)})
            if settings:
                print(f"[SettingsDB] Found settings: {settings}")
                settings.pop("_id", None)
                settings.pop("user_id", None)
                return settings
            else:
                print(f"[SettingsDB] No settings found for user")
                return None
        except Exception as e:
            print(f"[SettingsDB] Error getting settings: {e}")
            return None

    def save_user_settings(self, user_id: str, settings_data: dict) -> dict:
        """Save or update settings for a specific user"""
        from bson import ObjectId
        try:
            print(f"[SettingsDB] Saving settings for user_id: {user_id}")
            print(f"[SettingsDB] Settings data: {settings_data}")
            
            result = settings_collection.update_one(
                {"user_id": ObjectId(user_id)},
                {"$set": {
                    "break_interval": settings_data["break_interval"],
                    "break_duration": settings_data["break_duration"],
                    "auto_start": settings_data["auto_start"]
                }},
                upsert=True
            )
            
            print(f"[SettingsDB] Upsert result - Modified: {result.modified_count}, Upserted: {result.upserted_id}")
            
            # Verify the save
            saved = settings_collection.find_one({"user_id": ObjectId(user_id)})
            if saved:
                print(f"[SettingsDB] Verified save: {saved}")
            
            return settings_data
        except Exception as e:
            print(f"[SettingsDB] Error saving settings: {e}")
            import traceback
            traceback.print_exc()
            raise


# Initialize database instances
db = UserDB()
settings_db = SettingsDB()

class ChatHistoryDB:
    def __init__(self):
        pass

    def create_session(self, user_id: str, first_message: str, first_response: str, model: str, provider_key: str = None) -> dict:
        """Create a new chat session with first message"""
        from bson import ObjectId
        from datetime import datetime
        
        try:
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
            
            print(f"[ChatHistory] Created new session for user {user_id}")
            return session_doc
        except Exception as e:
            print(f"[ChatHistory] Error creating session: {e}")
            raise

    def add_message_to_session(self, user_id: str, session_id: str, message: str, response: str, model: str, provider_key: str = None) -> dict:
        """Add a message to existing session"""
        from bson import ObjectId
        from datetime import datetime
        
        try:
            result = chat_history_collection.update_one(
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
            
            print(f"[ChatHistory] Added message to session {session_id}")
            return {"success": True}
        except Exception as e:
            print(f"[ChatHistory] Error adding message: {e}")
            raise

    def get_user_sessions(self, user_id: str, limit: int = 20) -> list:
        """Get all chat sessions for a user"""
        from bson import ObjectId
        
        try:
            print(f"[ChatHistory] Getting sessions for user {user_id}")
            
            sessions = list(
                chat_history_collection.find({"user_id": ObjectId(user_id)})
                .sort("updated_at", -1)
                .limit(limit)
            )
            
            formatted_sessions = []
            for session in sessions:
                formatted_sessions.append({
                    "id": str(session["_id"]),
                    "message_count": len(session.get("messages", [])),
                    "first_message": session["messages"][0]["message"] if session.get("messages") else "",
                    "last_message": session["messages"][-1]["message"] if session.get("messages") else "",
                    "models_used": list(set(msg.get("model", "unknown") for msg in session.get("messages", []))),
                    "created_at": session["created_at"].isoformat(),
                    "updated_at": session["updated_at"].isoformat()
                })
            
            print(f"[ChatHistory] Found {len(formatted_sessions)} sessions")
            return formatted_sessions
        except Exception as e:
            print(f"[ChatHistory] Error getting sessions: {e}")
            return []

    def get_session_messages(self, user_id: str, session_id: str) -> Optional[dict]:
        """Get all messages in a specific session"""
        from bson import ObjectId
        
        try:
            session = chat_history_collection.find_one({
                "_id": ObjectId(session_id),
                "user_id": ObjectId(user_id)
            })
            
            if session:
                # Convert messages timestamp to ISO format
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
        except Exception as e:
            print(f"[ChatHistory] Error getting session: {e}")
            return None

    def delete_session(self, user_id: str, session_id: str) -> bool:
        """Delete a specific chat session"""
        from bson import ObjectId
        
        try:
            result = chat_history_collection.delete_one({
                "_id": ObjectId(session_id),
                "user_id": ObjectId(user_id)
            })
            
            print(f"[ChatHistory] Deleted session {session_id}")
            return result.deleted_count > 0
        except Exception as e:
            print(f"[ChatHistory] Error deleting session: {e}")
            return False

    def clear_user_history(self, user_id: str) -> int:
        """Clear all chat history for a user"""
        from bson import ObjectId
        
        try:
            result = chat_history_collection.delete_many({"user_id": ObjectId(user_id)})
            print(f"[ChatHistory] Cleared {result.deleted_count} sessions for user {user_id}")
            return result.deleted_count
        except Exception as e:
            print(f"[ChatHistory] Error clearing history: {e}")
            return 0


chat_history_db = ChatHistoryDB()

class ActivityDB:
    def save_session(self, user_id: str, session_data: dict) -> dict:
        from bson import ObjectId
        from datetime import datetime
        try:
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
        except Exception as e:
            print(f"[ActivityDB] Error saving session: {e}")
            raise

    def get_user_activity(self, user_id: str, days: int = 7) -> list:
        from bson import ObjectId
        from datetime import datetime, timedelta
        try:
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
        except Exception as e:
            print(f"[ActivityDB] Error getting activity: {e}")
            return []

    def get_user_activity_by_date(self, user_id: str, date: str) -> Optional[dict]:
        from bson import ObjectId
        try:
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
        except Exception as e:
            print(f"[ActivityDB] Error getting activity by date: {e}")
            return None

activity_db = ActivityDB()
