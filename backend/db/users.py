import uuid
from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from db.connection import USE_MONGO, users_collection, _mem_users, _persist


def _gen_id():
    return str(uuid.uuid4())


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
