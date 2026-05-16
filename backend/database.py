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
    
    # Create indexes for faster lookups
    users_collection.create_index("device_id", unique=True)
    users_collection.create_index("email")
    settings_collection.create_index("user_id", unique=True)
    
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
