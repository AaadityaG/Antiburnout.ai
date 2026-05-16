from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from auth import verify_token
from database import db
from routers.device_auth import decrypt_api_key
import httpx
from datetime import datetime

router = APIRouter(prefix="/chat", tags=["Chat"])

class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[Message]] = []
    model_key: Optional[str] = None  # Which model to use (e.g., "model_1", "model_2")

class ChatResponse(BaseModel):
    response: str
    model: str
    provider: str

def build_system_prompt(user: dict) -> str:
    """Build personalized system prompt for AntiBurnout Assistant"""
    
    # Calculate usage duration
    created_at = datetime.fromisoformat(user.get("created_at", datetime.utcnow().isoformat()))
    days_using = (datetime.utcnow() - created_at).days
    
    return f"""You are AntiBurnout Assistant, an AI helper integrated into a desktop break reminder app called AntiBurnout.

Your role:
- Help users establish healthy screen habits and prevent eye strain
- Provide eye care tips (20-20-20 rule, blinking, proper lighting, etc.)
- Suggest optimal break intervals and durations
- Answer questions about eye health, fatigue, and productivity
- Provide productivity tips that incorporate regular breaks
- Be friendly, concise, encouraging, and practical

User Context:
- Has been using AntiBurnout for {days_using} days
- Values eye health and productivity
- Uses this app for break reminders

Guidelines:
- Keep responses under 150 words unless asked for detailed information
- Be specific and actionable with advice
- Use encouraging tone
- Reference the 20-20-20 rule when relevant (every 20 minutes, look at something 20 feet away for 20 seconds)
- Suggest taking breaks, stretching, and staying hydrated
"""

@router.post("/send", response_model=ChatResponse)
async def send_message(token: str, request: ChatRequest):
    """Send a message to the AI chatbot via OpenRouter"""
    try:
        # Verify token
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_id = payload.get("sub")
        user = db.get_user_by_id(user_id)
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user's AI providers
        ai_providers = user.get("ai_providers", {})
        if not ai_providers:
            raise HTTPException(
                status_code=400, 
                detail="No AI provider configured. Please add one in Profile Settings."
            )
        
        # Use selected model or first available
        provider_key = request.model_key or list(ai_providers.keys())[0]
        if provider_key not in ai_providers:
            raise HTTPException(
                status_code=400,
                detail=f"Model '{provider_key}' not found. Please select a valid model."
            )
        provider_config = ai_providers[provider_key]
        
        # Decrypt API key
        device_id = user.get("device_id", "")
        api_key = decrypt_api_key(provider_config["api_key"], device_id)
        
        # Debug logging
        print(f"Using model: {provider_config['model']}")
        print(f"Provider key: {provider_key}")
        print(f"API key starts with: {api_key[:10] if api_key else 'None'}...")
        
        # Build system prompt
        system_prompt = build_system_prompt(user)
        
        # Build messages array
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add conversation history if provided
        if request.conversation_history:
            for msg in request.conversation_history[-10:]:  # Keep last 10 messages for context
                messages.append({"role": msg.role, "content": msg.content})
        
        # Add current message
        messages.append({"role": "user", "content": request.message})
        
        # Call OpenRouter API (works with ANY provider)
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://antiburnout.app",
                    "X-Title": "AntiBurnout"
                },
                json={
                    "model": provider_config["model"],
                    "messages": messages,
                    "max_tokens": 500,
                    "temperature": 0.7
                }
            )
            
            if response.status_code != 200:
                error_data = response.json()
                error_msg = error_data.get("error", {}).get("message", "Unknown error")
                print(f"OpenRouter error: {error_data}")
                raise HTTPException(
                    status_code=500, 
                    detail=f"AI provider error: {error_msg}"
                )
            
            data = response.json()
            
            # Extract response
            if not data.get("choices") or len(data["choices"]) == 0:
                print(f"OpenRouter response: {data}")
                raise HTTPException(status_code=500, detail="No response from AI")
            
            ai_response = data["choices"][0]["message"]["content"]
            
            print(f"Successfully got response from {provider_config['model']}")
            
            return ChatResponse(
                response=ai_response,
                model=provider_config["model"],
                provider=provider_config.get("provider", "openrouter")
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")
