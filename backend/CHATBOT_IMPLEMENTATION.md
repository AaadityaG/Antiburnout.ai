# AntiBurnout AI Chatbot - Backend Implementation Guide

## Overview
The chatbot will use the user's configured AI provider (OpenAI, Anthropic, Google, etc.) to provide personalized assistance about eye health, break patterns, and productivity.

## Architecture Flow

```
Frontend (Chat Message)
    ↓
Backend API (/api/chat)
    ↓
Get User's AI Provider Config (from users.json)
    ↓
Decrypt API Key (using device-specific Fernet key)
    ↓
Call AI Provider API (OpenAI/Anthropic/Google)
    ↓
Return Response to Frontend
```

## Implementation Steps

### 1. Create Chat Router (`backend/routers/chat.py`)

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from auth import verify_token
from database import db
from routers.device_auth import decrypt_api_key
import httpx

router = APIRouter(prefix="/chat", tags=["Chat"])

class ChatMessage(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str
    provider: str
```

### 2. System Prompt Design

Create a helpful system prompt that makes the AI an eye health assistant:

```python
SYSTEM_PROMPT = """
You are AntiBurnout Assistant, an AI helper integrated into a desktop break reminder app.

Your role:
- Help users establish healthy screen habits
- Provide eye care tips (20-20-20 rule, blinking, etc.)
- Suggest optimal break intervals based on user patterns
- Answer questions about eye strain and fatigue
- Provide productivity tips that incorporate regular breaks
- Be friendly, concise, and encouraging

User Context:
- The user has been using the app for {usage_duration}
- Their current break interval is {break_interval} minutes
- Their break duration is {break_duration} seconds
- They have completed {total_breaks} breaks

Keep responses under 150 words unless the user asks for detailed information.
"""
```

### 3. Main Chat Endpoint

```python
@router.post("/send")
async def send_message(token: str, request: ChatMessage):
    """Send a message to the AI chatbot"""
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
        
        # Use first available provider
        provider_key = list(ai_providers.keys())[0]
        provider_config = ai_providers[provider_key]
        
        # Decrypt API key
        device_id = user.get("device_id", "")
        api_key = decrypt_api_key(provider_config["api_key"], device_id)
        
        # Build system prompt with user context
        system_prompt = build_system_prompt(user)
        
        # Call AI provider
        response = await call_ai_provider(
            provider=provider_config["provider"],
            model=provider_config["model"],
            api_key=api_key,
            system_prompt=system_prompt,
            user_message=request.message
        )
        
        return ChatResponse(
            response=response,
            provider=provider_config["provider"]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")
```

### 4. AI Provider Integration

```python
async def call_ai_provider(provider: str, model: str, api_key: str, 
                          system_prompt: str, user_message: str) -> str:
    """Call the appropriate AI provider based on user config"""
    
    if provider == "openai":
        return await call_openai(model, api_key, system_prompt, user_message)
    elif provider == "anthropic":
        return await call_anthropic(model, api_key, system_prompt, user_message)
    elif provider == "google":
        return await call_google(model, api_key, system_prompt, user_message)
    else:
        raise ValueError(f"Unsupported provider: {provider}")

async def call_openai(model: str, api_key: str, system_prompt: str, message: str):
    """Call OpenAI API"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message}
                ],
                "max_tokens": 500,
                "temperature": 0.7
            }
        )
        
        if response.status_code != 200:
            raise Exception(f"OpenAI error: {response.text}")
        
        data = response.json()
        return data["choices"][0]["message"]["content"]

async def call_anthropic(model: str, api_key: str, system_prompt: str, message: str):
    """Call Anthropic Claude API"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json"
            },
            json={
                "model": model,
                "max_tokens": 500,
                "system": system_prompt,
                "messages": [
                    {"role": "user", "content": message}
                ]
            }
        )
        
        if response.status_code != 200:
            raise Exception(f"Anthropic error: {response.text}")
        
        data = response.json()
        return data["content"][0]["text"]

async def call_google(model: str, api_key: str, system_prompt: str, message: str):
    """Call Google Gemini API"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            params={"key": api_key},
            json={
                "contents": [
                    {
                        "parts": [
                            {"text": f"{system_prompt}\n\nUser: {message}"}
                        ]
                    }
                ],
                "generationConfig": {
                    "maxOutputTokens": 500,
                    "temperature": 0.7
                }
            }
        )
        
        if response.status_code != 200:
            raise Exception(f"Google error: {response.text}")
        
        data = response.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]
```

### 5. Build System Prompt with Context

```python
def build_system_prompt(user: dict) -> str:
    """Build personalized system prompt with user context"""
    
    # Calculate usage duration
    created_at = datetime.fromisoformat(user["created_at"])
    days_using = (datetime.utcnow() - created_at).days
    
    # Get user settings (from settings.json)
    settings = load_user_settings(user["id"])
    
    return SYSTEM_PROMPT.format(
        usage_duration=f"{days_using} days",
        break_interval=settings.get("break_interval", 30),
        break_duration=settings.get("break_duration", 20),
        total_breaks="unknown"  # Can be tracked in future
    )
```

### 6. Add Router to Main App

In `backend/main.py`:

```python
from routers import chat
app.include_router(chat.router)
```

## Security Considerations

✅ **Already Implemented:**
- API keys are encrypted with device-specific Fernet keys
- Keys are only decrypted when needed for AI calls
- Keys are never returned to frontend
- JWT token verification on all requests

## Future Enhancements

1. **Conversation History**: Store chat history per user for context
2. **Break Pattern Analysis**: AI suggests optimal break times based on usage
3. **Multi-turn Conversations**: Maintain conversation context
4. **Provider Fallback**: Try next provider if one fails
5. **Rate Limiting**: Prevent abuse of AI API calls
6. **Usage Tracking**: Track how many AI calls per day
7. **Custom Instructions**: Let users customize AI personality
8. **Voice Responses**: Text-to-speech for break reminders

## Testing Locally

1. Ensure user has AI provider configured in profile
2. Send POST request to `/chat/send`:
```bash
curl -X POST "http://localhost:8000/chat/send?token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "How often should I take breaks?"}'
```

## Error Handling

- **No API Key**: "Please configure an AI provider in your Profile Settings"
- **Invalid Key**: "Your API key is invalid. Please update it in Profile Settings"
- **Rate Limit**: "Too many requests. Please try again in a few minutes"
- **Provider Down**: "AI service is temporarily unavailable. Please try again"

## Dependencies

Add to `backend/requirements.txt`:
```
httpx>=0.24.0
```

Install:
```bash
pip install httpx
```

---

This implementation:
✅ Uses user's own AI provider & API key
✅ Supports multiple providers (OpenAI, Anthropic, Google)
✅ Maintains security (keys stay encrypted)
✅ Provides personalized responses
✅ Is cost-effective (user pays for their own API usage)
