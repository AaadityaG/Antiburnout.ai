from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from auth import verify_token
from database import db, settings_db

router = APIRouter(prefix="/settings", tags=["Settings"])

class UserSettings(BaseModel):
    break_interval: int = 30  # minutes
    break_duration: int = 20  # seconds
    auto_start: bool = True

@router.get("/user", response_model=UserSettings)
async def get_user_settings(token: str):
    """Get settings for authenticated user"""
    try:
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_id = payload.get("sub")
        
        # Get user's settings from MongoDB or return defaults
        user_settings = settings_db.get_user_settings(user_id)
        
        if not user_settings:
            # Return default settings
            return UserSettings(
                break_interval=30,
                break_duration=20,
                auto_start=True
            )
        
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
        
        # Save settings to MongoDB
        settings_data = {
            "break_interval": settings.break_interval,
            "break_duration": settings.break_duration,
            "auto_start": settings.auto_start
        }
        
        settings_db.save_user_settings(user_id, settings_data)
        
        return settings
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {str(e)}")
