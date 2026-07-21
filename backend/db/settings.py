from typing import Optional
from db.connection import USE_MONGO, settings_collection, _mem_settings, _persist


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
