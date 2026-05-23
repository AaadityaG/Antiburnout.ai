from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from auth import verify_token
from database import db, chat_history_db
from routers.device_auth import decrypt_api_key
import httpx
from datetime import datetime
from routers.agent import get_recommendations as get_agent_recommendations

router = APIRouter(prefix="/chat", tags=["Chat"])

class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[Message]] = []
    model_key: Optional[str] = None  # Which model to use (e.g., "model_1", "model_2")
    session_id: Optional[str] = None  # Continue existing session or create new
    brightness: Optional[int] = None  # Current system brightness
    volume: Optional[int] = None  # Current system volume
    is_night_mode_enabled: Optional[bool] = None  # Night mode status

class ChatResponse(BaseModel):
    response: str
    model: str
    provider: str
    session_id: str  # Return session ID for future messages
    recommendations: Optional[List[dict]] = []  # Agent recommendations with actions

def build_system_prompt(user: dict, needs_optimization: bool = True, settings_status: dict = None, current_settings: dict = None) -> str:
    """Build personalized system prompt for AntiBurnout Assistant"""
    
    # Calculate usage duration
    created_at = datetime.fromisoformat(user.get("created_at", datetime.utcnow().isoformat()))
    days_using = (datetime.utcnow() - created_at).days
    
    if needs_optimization:
        optimization_context = """- The user's system settings NEED optimization
- Interactive recommendation cards with Execute/Reject buttons will appear below your message
- Keep your response brief and tell users they can click Execute to apply settings instantly
- Focus on the specific settings that need changing (brightness, volume, or night mode)"""
    else:
        # Build specific status message with ACTUAL current values
        status_points = []
        if current_settings:
            brightness = current_settings.get('brightness')
            volume = current_settings.get('volume')
            night_mode = current_settings.get('night_mode')
            hour = current_settings.get('hour', 12)
            
            # Only mention settings that are optimal
            if settings_status and settings_status.get('brightness') == 'optimal' and brightness is not None:
                status_points.append(f'☀️ Brightness is at {brightness}% - perfect for this time of day')
            
            if settings_status and settings_status.get('volume') == 'optimal' and volume is not None:
                status_points.append(f'🔊 Volume is at {volume}% - safe for long sessions')
            
            # Only mention night mode if it's evening/night time (8PM - 6AM)
            is_night_time = hour >= 20 or hour < 6
            if is_night_time and settings_status and settings_status.get('night_mode') == 'optimal':
                status_points.append('🌙 Night mode is enabled - great for evening use')
        
        status_message = '\n'.join([f'- {point}' for point in status_points]) if status_points else '- Your settings look good'
        
        optimization_context = f"""- The user's system settings are ALREADY OPTIMIZED
- NO recommendation cards will appear below your message
- Confirm their settings are good with these specific points (use EXACT values shown):
{status_message}
- DO NOT suggest changing settings that are already optimal
- DO NOT mention night mode unless it's evening/night time (8PM-6AM)
- Keep it brief and positive
- Then ask: "If you're still feeling burnout, can you share more with me?"
- Be conversational and supportive"""
    
    return f"""You are AntiBurnout Assistant, an AI helper for preventing digital burnout and maintaining wellness during screen time.

Your role:
- Help users reduce burnout through proper system settings and healthy screen habits
- Recommend optimal brightness, volume, and night mode settings to reduce eye strain and fatigue
- Suggest break patterns and micro-activities to prevent burnout
- Provide ergonomic and posture guidance
- Promote hydration and healthy work habits
- Be friendly, concise, and practical

IMPORTANT: When users ask about recommendations, best practices, or reducing burnout:
- Keep your response brief (under 100 words)
- Focus on actionable system settings (brightness, volume, night mode)
{optimization_context}

User Context:
- Has been using AntiBurnout for {days_using} days
- Works long hours on screens
- Wants to prevent burnout and maintain wellness

Guidelines:
- Keep responses under 100 words unless asked for details
- Be specific and actionable
- Use encouraging tone
- Focus on prevention, not just treatment
- If settings are optimized, confirm they're good with specific current values, then ask what they're experiencing
- NEVER suggest changing settings that are already in optimal range
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
        
        # Check if user is asking for recommendations or checking current settings
        is_recommendation_request = any(
            keyword in request.message.lower() 
            for keyword in ['recommendation', 'what should i do', 'suggest', 'agent', 'wellness', 
                          'burnout', 'best practice', 'settings', 'brightness', 'volume', 'night mode',
                          'reduce strain', 'prevent', 'optimal', 'better', 'ok now', 'good now', 'check']
        )
        
        # Fetch agent recommendations if requested WITH REAL SYSTEM METRICS
        agent_recommendations = []
        settings_need_optimization = False
        settings_status = {}  # Track which settings are good
        current_settings_info = {}  # Actual current values for LLM context
        
        if is_recommendation_request:
            try:
                # Get current hour
                current_hour = datetime.utcnow().hour
                
                # Use real system metrics from frontend if provided
                current_brightness = request.brightness
                current_volume = request.volume
                current_night_mode = request.is_night_mode_enabled or False
                
                # Store current settings info for LLM
                current_settings_info = {
                    'brightness': current_brightness,
                    'volume': current_volume,
                    'night_mode': current_night_mode,
                    'hour': current_hour
                }
                
                print(f"Checking recommendations with metrics: brightness={current_brightness}, volume={current_volume}, night_mode={current_night_mode}")
                
                # If no metrics provided, skip recommendations (let LLM handle it)
                if current_brightness is not None or current_volume is not None:
                    # Import recommendation functions
                    from routers.agent import (
                        get_brightness_recommendation,
                        get_volume_recommendation,
                        get_night_mode_recommendation
                    )
                    
                    # Get brightness recommendation if metric provided
                    if current_brightness is not None:
                        brightness_rec = get_brightness_recommendation(current_brightness, current_hour)
                        if brightness_rec and brightness_rec.action_type == 'execute':
                            agent_recommendations.append(brightness_rec)
                            settings_need_optimization = True
                            settings_status['brightness'] = 'needs_adjustment'
                        else:
                            settings_status['brightness'] = 'optimal'
                    
                    # Get volume recommendation if metric provided
                    if current_volume is not None:
                        volume_rec = get_volume_recommendation(current_volume)
                        if volume_rec and volume_rec.action_type == 'execute':
                            agent_recommendations.append(volume_rec)
                            settings_need_optimization = True
                            settings_status['volume'] = 'needs_adjustment'
                        else:
                            settings_status['volume'] = 'optimal'
                    
                    # Get night mode recommendation
                    night_rec = get_night_mode_recommendation(current_hour, current_night_mode)
                    if night_rec and night_rec.action_type == 'execute':
                        agent_recommendations.append(night_rec)
                        settings_need_optimization = True
                        settings_status['night_mode'] = 'needs_adjustment'
                    else:
                        settings_status['night_mode'] = 'optimal'
                    
                    print(f"Found {len(agent_recommendations)} recommendations, needs optimization: {settings_need_optimization}")
                    print(f"Settings status: {settings_status}")
            except Exception as e:
                print(f"Failed to fetch agent recommendations: {e}")
                import traceback
                traceback.print_exc()
        
        # Build dynamic system prompt based on settings status
        system_prompt = build_system_prompt(user, settings_need_optimization, settings_status, current_settings_info)
        
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
            
            # Save to chat history (session-based)
            try:
                if request.session_id:
                    # Add to existing session
                    chat_history_db.add_message_to_session(
                        user_id=user_id,
                        session_id=request.session_id,
                        message=request.message,
                        response=ai_response,
                        model=provider_config["model"],
                        provider_key=provider_key
                    )
                    session_id = request.session_id
                else:
                    # Create new session
                    session_doc = chat_history_db.create_session(
                        user_id=user_id,
                        first_message=request.message,
                        first_response=ai_response,
                        model=provider_config["model"],
                        provider_key=provider_key
                    )
                    session_id = session_doc["id"]
                    
            except Exception as e:
                print(f"Warning: Failed to save chat history: {e}")
                session_id = ""
            
            return ChatResponse(
                response=ai_response,
                model=provider_config["model"],
                provider=provider_config.get("provider", "openrouter"),
                session_id=session_id,
                recommendations=[rec.dict() for rec in agent_recommendations] if agent_recommendations else []
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")
