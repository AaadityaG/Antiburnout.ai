import json
import os
from typing import Optional
from pydantic import BaseModel

DB_FILE = "users.json"


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
        self.users = []
        self._load_users()

    def _load_users(self):
        if os.path.exists(DB_FILE):
            with open(DB_FILE, "r") as f:
                self.users = json.load(f)

    def _save_users(self):
        with open(DB_FILE, "w") as f:
            json.dump(self.users, f, indent=2)

    def get_user_by_email(self, email: str) -> Optional[dict]:
        for user in self.users:
            if user.get("email") == email:
                return user
        return None

    def get_user_by_device_id(self, device_id: str) -> Optional[dict]:
        for user in self.users:
            if user.get("device_id") == device_id:
                return user
        return None

    def get_user_by_id(self, user_id: str) -> Optional[dict]:
        for user in self.users:
            if user["id"] == user_id:
                return user
        return None

    def create_user(self, user_data: dict) -> dict:
        self.users.append(user_data)
        self._save_users()
        return user_data

    def update_user(self, user_id: str, update_data: dict) -> Optional[dict]:
        for i, user in enumerate(self.users):
            if user["id"] == user_id:
                self.users[i].update(update_data)
                self._save_users()
                return self.users[i]
        return None


db = UserDB()
