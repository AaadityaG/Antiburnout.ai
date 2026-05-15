from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from auth import create_access_token
from database import db
import uuid
from datetime import datetime
import json
from pathlib import Path

router = APIRouter(prefix="/auth", tags=["Device Auth"])

SETTINGS_FILE = Path(__file__).parent.parent / "settings.json"

def create_default_settings(user_id: str):
    """Create default settings for a user if they don't exist"""
    default_settings = {
        "break_interval": 30,
        "break_duration": 220,
        "auto_start": True
    }
    
    # Load existing settings
    all_settings = {}
    if SETTINGS_FILE.exists():
        with open(SETTINGS_FILE, 'r') as f:
            all_settings = json.load(f)
    
    # Only create if user doesn't have settings yet
    if user_id not in all_settings:
        all_settings[user_id] = default_settings
        
        # Save back to file
        with open(SETTINGS_FILE, 'w') as f:
            json.dump(all_settings, f, indent=2)

class DeviceAuthRequest(BaseModel):
    device_id: str
    device_name: str

class ProfileUpdateRequest(BaseModel):
    name: str = ""
    email: str = ""

class DeviceAuthResponse(BaseModel):
    access_token: str
    user: dict
    is_new_device: bool

@router.post("/device", response_model=DeviceAuthResponse)
async def device_auth(request: DeviceAuthRequest):
    """Authenticate or create user based on device ID"""
    try:
        device_id = request.device_id
        device_name = request.device_name

        # Check if device already exists
        user = db.get_user_by_device_id(device_id)

        if user:
            # Existing device - update last login
            user["last_login"] = datetime.utcnow().isoformat()
            db.update_user(user["id"], user)
            
            # Create default settings if user doesn't have any
            create_default_settings(user["id"])
            
            # Create JWT token
            access_token = create_access_token(data={"sub": str(user["id"])})
            
            return DeviceAuthResponse(
                access_token=access_token,
                user={
                    "id": str(user["id"]),
                    "device_id": user["device_id"],
                    "device_name": user["device_name"],
                    "name": user.get("name", ""),
                    "email": user.get("email", ""),
                    "created_at": user["created_at"],
                    "last_login": user["last_login"],
                },
                is_new_device=False
            )
        else:
            # New device - create user
            new_user = {
                "id": str(uuid.uuid4()),
                "device_id": device_id,
                "device_name": device_name,
                "created_at": datetime.utcnow().isoformat(),
                "last_login": datetime.utcnow().isoformat(),
            }
            
            user = db.create_user(new_user)
            
            # Create default settings for new user
            create_default_settings(user["id"])
            
            # Create JWT token
            access_token = create_access_token(data={"sub": str(user["id"])})
            
            return DeviceAuthResponse(
                access_token=access_token,
                user={
                    "id": str(user["id"]),
                    "device_id": user["device_id"],
                    "device_name": user["device_name"],
                    "name": user.get("name", ""),
                    "email": user.get("email", ""),
                    "created_at": user["created_at"],
                    "last_login": user["last_login"],
                },
                is_new_device=True
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Device authentication failed: {str(e)}")

@router.get("/me")
async def get_device_profile(token: str):
    """Get current device profile"""
    try:
        from auth import verify_token
        
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        
        user = db.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Device not found")
        
        return {
            "id": str(user["id"]),
            "device_id": user["device_id"],
            "device_name": user["device_name"],
            "created_at": user["created_at"],
            "last_login": user["last_login"],
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get profile: {str(e)}")

@router.put("/profile")
async def update_profile(token: str, request: ProfileUpdateRequest):
    """Update user profile (name, email)"""
    try:
        from auth import verify_token
        
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        
        user = db.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Update profile fields
        update_data = {}
        if request.name:
            update_data["name"] = request.name
        if request.email:
            update_data["email"] = request.email
        
        if update_data:
            user = db.update_user(user_id, update_data)
        
        return {
            "id": str(user["id"]),
            "device_id": user.get("device_id", ""),
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            "created_at": user["created_at"],
            "last_login": user["last_login"],
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}")
