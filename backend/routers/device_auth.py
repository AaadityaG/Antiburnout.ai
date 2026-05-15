from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict
from auth import create_access_token
from database import db
import uuid
from datetime import datetime
import json
from pathlib import Path
from cryptography.fernet import Fernet
import base64
import hashlib

router = APIRouter(prefix="/auth", tags=["Device Auth"])

SETTINGS_FILE = Path(__file__).parent.parent / "settings.json"

# Encryption utilities
def get_encryption_key(device_id: str) -> bytes:
    """Generate encryption key from device ID"""
    key_hash = hashlib.sha256(device_id.encode()).digest()
    return base64.urlsafe_b64encode(key_hash)

def encrypt_api_key(api_key: str, device_id: str) -> str:
    """Encrypt API key using device-specific key"""
    fernet = Fernet(get_encryption_key(device_id))
    return fernet.encrypt(api_key.encode()).decode()

def decrypt_api_key(encrypted_key: str, device_id: str) -> str:
    """Decrypt API key using device-specific key"""
    fernet = Fernet(get_encryption_key(device_id))
    return fernet.decrypt(encrypted_key.encode()).decode()

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

def sanitize_ai_providers(providers: dict) -> dict:
    """Remove encrypted API keys from providers for safe response"""
    if not providers:
        return {}
    
    sanitized = {}
    for key, provider in providers.items():
        sanitized[key] = {
            "provider": provider.get("provider", ""),
            "model": provider.get("model", ""),
            "has_key": bool(provider.get("api_key"))
        }
    return sanitized

class DeviceAuthRequest(BaseModel):
    device_id: str
    device_name: str

class ProfileUpdateRequest(BaseModel):
    name: str = ""
    email: str = ""
    ai_providers: Optional[Dict[str, Dict[str, str]]] = None

class AIProviderConfig(BaseModel):
    provider: str  # openai, anthropic, google, etc.
    model: str     # gpt-4, claude-3, etc.
    api_key: str

class AIProviderUpdateRequest(BaseModel):
    provider: str
    model: str
    api_key: str

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
                    "ai_providers": sanitize_ai_providers(user.get("ai_providers", {})),
                    "profile_completed": user.get("profile_completed", False),
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
                    "ai_providers": sanitize_ai_providers(user.get("ai_providers", {})),
                    "profile_completed": user.get("profile_completed", False),
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
    """Update user profile (name, email, ai_providers)"""
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
        
        # Handle AI providers (encrypt API keys)
        if request.ai_providers is not None:
            device_id = user.get("device_id", "")
            encrypted_providers = {}
            
            # Get existing providers first
            existing_providers = user.get("ai_providers", {})
            
            for provider_key, provider_data in request.ai_providers.items():
                # If provider data is empty, it means delete this provider
                if not provider_data.get("provider") and not provider_data.get("api_key"):
                    # Remove from existing providers if it exists
                    if provider_key in existing_providers:
                        del existing_providers[provider_key]
                else:
                    # Add or update provider with encrypted key
                    existing_providers[provider_key] = {
                        "provider": provider_data.get("provider", ""),
                        "model": provider_data.get("model", ""),
                        "api_key": encrypt_api_key(provider_data.get("api_key", ""), device_id)
                    }
            
            # Only update if there are providers left
            if existing_providers:
                update_data["ai_providers"] = existing_providers
            elif "ai_providers" in user:
                # Remove ai_providers field entirely if empty
                update_data["ai_providers"] = {}
        
        # Check if profile is complete (has name/email OR has at least one AI provider)
        has_basic_info = bool(user.get("name") or request.name) and bool(user.get("email") or request.email)
        has_ai_provider = bool(request.ai_providers and len(request.ai_providers) > 0)
        update_data["profile_completed"] = has_basic_info or has_ai_provider
        
        if update_data:
            user = db.update_user(user_id, update_data)
        
        # Return profile without encrypted keys
        safe_ai_providers = sanitize_ai_providers(user.get("ai_providers", {}))
        
        return {
            "id": str(user["id"]),
            "device_id": user.get("device_id", ""),
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            "ai_providers": safe_ai_providers,
            "profile_completed": user.get("profile_completed", False),
            "created_at": user["created_at"],
            "last_login": user["last_login"],
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}")

@router.get("/ai-providers/{provider_key}")
async def get_ai_provider(token: str, provider_key: str):
    """Get decrypted AI provider config (for use in AI features)"""
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
        
        ai_providers = user.get("ai_providers", {})
        if provider_key not in ai_providers:
            raise HTTPException(status_code=404, detail=f"Provider {provider_key} not found")
        
        provider_data = ai_providers[provider_key]
        device_id = user.get("device_id", "")
        
        # Decrypt API key
        decrypted_key = decrypt_api_key(provider_data["api_key"], device_id)
        
        return {
            "provider": provider_data["provider"],
            "model": provider_data["model"],
            "api_key": decrypted_key
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get provider: {str(e)}")
