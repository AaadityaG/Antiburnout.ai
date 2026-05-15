from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from auth import verify_token
from database import db
import json
import os
from pathlib import Path

router = APIRouter(prefix="/settings", tags=["Settings"])

SETTINGS_FILE = Path(__file__).parent.parent / "settings.json"

class UserSettings(BaseModel):
    break_interval: int = 30  # minutes
    break_duration: int = 20  # seconds (3 minutes 40 seconds)
    auto_start: bool = True

def load_settings():
    """Load all settings from JSON file"""
    if SETTINGS_FILE.exists():
        with open(SETTINGS_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_settings(settings_data: dict):
    """Save settings to JSON file"""
    with open(SETTINGS_FILE, 'w') as f:
        json.dump(settings_data, f, indent=2)

@router.get("/user", response_model=UserSettings)
async def get_user_settings(token: str):
    """Get settings for authenticated user"""
    try:
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_id = payload.get("sub")
        all_settings = load_settings()
        
        # Return user's settings or defaults
        user_settings = all_settings.get(user_id, {
            "break_interval": 30,
            "break_duration": 220,
            "auto_start": True
        })
        
        return UserSettings(**user_settings)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load settings: {str(e)}")

@router.put("/user", response_model=UserSettings)
async def update_user_settings(settings: UserSettings, token: str):
    """Update settings for authenticated user"""
    try:
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_id = payload.get("sub")
        all_settings = load_settings()
        
        # Update user's settings
        all_settings[user_id] = {
            "break_interval": settings.break_interval,
            "break_duration": settings.break_duration,
            "auto_start": settings.auto_start
        }
        
        save_settings(all_settings)
        
        return settings
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {str(e)}")
