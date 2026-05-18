from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from auth import verify_token
from database import db, settings_db

router = APIRouter(prefix="/settings", tags=["Settings"])

class UserSettings(BaseModel):
    break_interval: int = 1800  # seconds (30 minutes)
    break_duration: int = 90    # seconds (1 minute 30 seconds)
    auto_start: bool = True

@router.get("/user", response_model=UserSettings)
async def get_user_settings(token: str):
    """Get settings for authenticated user"""
    try:
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_id = payload.get("sub")
        print(f"[Settings API] Fetching settings for user_id: {user_id}")
        
        # Get user's settings from MongoDB or return defaults
        user_settings = settings_db.get_user_settings(user_id)
        
        if not user_settings:
            print(f"[Settings API] No settings found, returning defaults")
            # Return default settings (30 minutes interval, 90 seconds break)
            return UserSettings(
                break_interval=1800,
                break_duration=90,
                auto_start=True
            )
        
        print(f"[Settings API] Returning settings: {user_settings}")
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
        print(f"[Settings API] Updating settings for user_id: {user_id}")
        print(f"[Settings API] New settings - interval: {settings.break_interval}, duration: {settings.break_duration}")
        
        # Save settings to MongoDB
        settings_data = {
            "break_interval": settings.break_interval,
            "break_duration": settings.break_duration,
            "auto_start": settings.auto_start
        }
        
        settings_db.save_user_settings(user_id, settings_data)
        print(f"[Settings API] Settings saved successfully")
        
        return settings
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {str(e)}")
