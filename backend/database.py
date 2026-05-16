import os
from typing import Optional
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
    # Initialize MongoDB client
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    # Test connection
    client.admin.command('ping')
    db = client[MONGODB_DB_NAME]
    
    # Collections
    users_collection = db["users"]
    settings_collection = db["settings"]
    chat_history_collection = db["chatbot-history"]
    
    # Create indexes for faster lookups
    users_collection.create_index("device_id", unique=True)
    users_collection.create_index("email")
    settings_collection.create_index("user_id", unique=True)
    chat_history_collection.create_index("user_id")
    chat_history_collection.create_index("created_at")
    
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

    def save_message(self, user_id: str, message: str, response: str, model: str, provider_key: str = None) -> dict:
        """Save a chat message and response"""
        from bson import ObjectId
        from datetime import datetime
        
        try:
            chat_doc = {
                "user_id": ObjectId(user_id),
                "message": message,
                "response": response,
                "model": model,
                "provider_key": provider_key,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            result = chat_history_collection.insert_one(chat_doc)
            chat_doc["id"] = str(result.inserted_id)
            chat_doc.pop("_id", None)
            chat_doc.pop("user_id", None)
            
            print(f"[ChatHistory] Saved message for user {user_id}")
            return chat_doc
        except Exception as e:
            print(f"[ChatHistory] Error saving message: {e}")
            raise

    def get_user_conversations(self, user_id: str, limit: int = 50) -> list:
        """Get all conversations for a user, grouped by session"""
        from bson import ObjectId
        
        try:
            print(f"[ChatHistory] Getting conversations for user {user_id}")
            
            # Get all messages for user, sorted by date
            messages = list(
                chat_history_collection.find({"user_id": ObjectId(user_id)})
                .sort("created_at", -1)
                .limit(limit)
            )
            
            # Convert ObjectId to string and format
            formatted_messages = []
            for msg in messages:
                formatted_messages.append({
                    "id": str(msg["_id"]),
                    "message": msg["message"],
                    "response": msg["response"],
                    "model": msg.get("model", "unknown"),
                    "provider_key": msg.get("provider_key"),
                    "created_at": msg["created_at"].isoformat()
                })
            
            print(f"[ChatHistory] Found {len(formatted_messages)} messages")
            return formatted_messages
        except Exception as e:
            print(f"[ChatHistory] Error getting conversations: {e}")
            return []

    def delete_conversation(self, user_id: str, message_id: str) -> bool:
        """Delete a specific message"""
        from bson import ObjectId
        
        try:
            result = chat_history_collection.delete_one({
                "_id": ObjectId(message_id),
                "user_id": ObjectId(user_id)
            })
            
            print(f"[ChatHistory] Deleted message {message_id}")
            return result.deleted_count > 0
        except Exception as e:
            print(f"[ChatHistory] Error deleting message: {e}")
            return False

    def clear_user_history(self, user_id: str) -> int:
        """Clear all chat history for a user"""
        from bson import ObjectId
        
        try:
            result = chat_history_collection.delete_many({"user_id": ObjectId(user_id)})
            print(f"[ChatHistory] Cleared {result.deleted_count} messages for user {user_id}")
            return result.deleted_count
        except Exception as e:
            print(f"[ChatHistory] Error clearing history: {e}")
            return 0


chat_history_db = ChatHistoryDB()
