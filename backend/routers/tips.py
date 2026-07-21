from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from auth import verify_token
from db import db
from services.encryption import decrypt_api_key
import httpx
from datetime import datetime
import random

router = APIRouter(prefix="/tips", tags=["Break Tips"])

class TipRequest(BaseModel):
    break_number: Optional[int] = 1  # Which break of the day
    time_of_day: Optional[str] = None  # morning, afternoon, evening
    focus_area: Optional[str] = None  # eyes, stress, posture, mindfulness

class TipResponse(BaseModel):
    tip: str
    category: str  # eyes, stress, posture, mindfulness, hydration, movement
    duration: str  # suggested duration for the activity
    instruction: str  # detailed step-by-step instruction

# Fallback tips in case AI is not available (COMMENTED OUT - NOT USED)
# FALLBACK_TIPS = [
#     {
#         "tip": "20-20-20 Rule",
#         "category": "eyes",
#         "duration": "20 seconds",
#         "instruction": "Look at something 20 feet away for 20 seconds. This reduces eye strain by giving your focusing muscles a break."
#     },
#     {
#         "tip": "Palming Exercise",
#         "category": "eyes",
#         "duration": "30 seconds",
#         "instruction": "Rub your hands together to warm them, then gently cup your palms over closed eyes without pressing. Breathe deeply and relax."
#     },
#     {
#         "tip": "Eye Rolling",
#         "category": "eyes",
#         "duration": "15 seconds",
#         "instruction": "Slowly roll your eyes in a circle 5 times clockwise, then 5 times counter-clockwise. This relieves eye muscle tension."
#     },
#     {
#         "tip": "Blinking Exercise",
#         "category": "eyes",
#         "duration": "20 seconds",
#         "instruction": "Blink rapidly 10 times, then close your eyes for 20 seconds. This rehydrates your eyes and reduces dryness."
#     },
#     {
#         "tip": "Neck Stretch",
#         "category": "posture",
#         "duration": "30 seconds",
#         "instruction": "Tilt your head to the right, bringing ear toward shoulder. Hold for 15 seconds, then switch to left side. Repeat 2 times."
#     },
#     {
#         "tip": "Shoulder Rolls",
#         "category": "posture",
#         "duration": "20 seconds",
#         "instruction": "Roll your shoulders forward 5 times, then backward 5 times. This releases tension from sitting at your desk."
#     },
#     {
#         "tip": "Deep Breathing (4-7-8)",
#         "category": "stress",
#         "duration": "60 seconds",
#         "instruction": "Inhale through nose for 4 counts, hold for 7 counts, exhale through mouth for 8 counts. Repeat 3 times to calm your nervous system."
#     },
#     {
#         "tip": "Box Breathing",
#         "category": "mindfulness",
#         "duration": "60 seconds",
#         "instruction": "Inhale for 4 counts, hold for 4, exhale for 4, hold for 4. Repeat 4 times. This technique is used by Navy SEALs for stress management."
#     },
#     {
#         "tip": "Hydration Break",
#         "category": "hydration",
#         "duration": "30 seconds",
#         "instruction": "Drink a full glass of water. Dehydration causes fatigue, headaches, and reduced concentration. Keep water at your desk!"
#     },
#     {
#         "tip": "Wrist and Finger Stretch",
#         "category": "posture",
#         "duration": "30 seconds",
#         "instruction": "Extend one arm, pull fingers back gently with other hand. Hold 15 seconds. Switch hands. Then shake out both wrists."
#     },
#     {
#         "tip": "Stand and Stretch",
#         "category": "movement",
#         "duration": "45 seconds",
#         "instruction": "Stand up, reach your arms overhead, stretch to the left for 10 seconds, then to the right. Feel the stretch along your sides."
#     },
#     {
#         "tip": "Progressive Muscle Relaxation",
#         "category": "stress",
#         "duration": "60 seconds",
#         "instruction": "Tense your shoulders tightly for 5 seconds, then release. Notice the difference. Move to your arms, then face, repeating the pattern."
#     },
#     {
#         "tip": "Focus Shift Exercise",
#         "category": "eyes",
#         "duration": "30 seconds",
#         "instruction": "Hold your thumb 10 inches from your face. Focus on it for 10 seconds, then focus on something across the room for 10 seconds. Repeat 3 times."
#     },
#     {
#         "tip": "Mindful Observation",
#         "category": "mindfulness",
#         "duration": "60 seconds",
#         "instruction": "Look out a window or around the room. Find 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste."
#     },
#     {
#         "tip": "Seated Spinal Twist",
#         "category": "posture",
#         "duration": "40 seconds",
#         "instruction": "Sit tall, place right hand on left knee, left hand behind you. Gently twist left, hold 20 seconds. Switch sides."
#     },
#     {
#         "tip": "Quick Walk",
#         "category": "movement",
#         "duration": "60 seconds",
#         "instruction": "Walk around your workspace or do a quick lap. Movement increases blood flow and refreshes your mind better than staying seated."
#     },
#     {
#         "tip": "Gratitude Moment",
#         "category": "mindfulness",
#         "duration": "30 seconds",
#         "instruction": "Think of 3 things you're grateful for right now. This simple practice reduces stress and improves overall wellbeing."
#     }
# ]

def build_tip_system_prompt(request: TipRequest, user: dict) -> str:
    """Build system prompt for generating personalized break tips"""
    
    time_context = ""
    if request.time_of_day:
        time_context = f"\n- Current time of day: {request.time_of_day}"
    
    break_context = ""
    if request.break_number:
        break_context = f"\n- This is break number {request.break_number} today"
    
    focus_context = ""
    if request.focus_area:
        focus_context = f"\n- User wants to focus on: {request.focus_area}"
    
    return f"""You are an expert wellness coach specializing in preventing burnout, eye strain, and stress for desk workers.

Generate ONE specific, actionable tip for a break activity. The tip should help reduce:
- Eye strain and tension from screen time
- Stress and mental fatigue
- Physical tension from sitting
- Overall burnout prevention

Requirements:
1. Make it SPECIFIC and ACTIONABLE (not generic advice)
2. Keep the instruction VERY SHORT (1-2 sentences max, under 50 words)
3. Make it different each time - variety is crucial
4. Focus on techniques that can be done at a desk or nearby
5. Base recommendations on scientific evidence
6. Make it engaging and encouraging

Context:
- User has been using AntiBurnout app
- They're taking a scheduled break{time_context}{break_context}{focus_context}

Categories to rotate through:
- eyes: Eye exercises and relaxation techniques
- stress: Stress reduction and relaxation
- posture: Stretches and posture correction
- mindfulness: Mental breaks and awareness
- hydration: Water intake and health
- movement: Physical activity and exercise

Return ONLY valid JSON with this structure:
{{
  "tip": "Short title of the tip",
  "category": "one of the categories above",
  "duration": "suggested time to spend",
  "instruction": "Very brief instruction (1-2 sentences, under 50 words)"
}}

Do NOT include any other text. Only return the JSON object."""

@router.post("/recommendation", response_model=TipResponse)
async def get_tip_recommendation(token: str, request: TipRequest = TipRequest()):
    """Get a personalized break tip recommendation"""
    try:
        # Verify token
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_id = payload.get("sub")
        user = db.get_user_by_id(user_id)
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Try to get AI provider
        ai_providers = user.get("ai_providers", {})
        
        # If no AI provider, return error (no fallback)
        if not ai_providers:
            raise HTTPException(status_code=400, detail="No AI provider configured. Please add an AI provider in your profile settings.")
        
        # Use first available provider
        provider_key = list(ai_providers.keys())[0]
        provider_config = ai_providers[provider_key]
        
        # Decrypt API key
        device_id = user.get("device_id", "")
        api_key = decrypt_api_key(provider_config["api_key"], device_id)
        
        # Build system prompt
        system_prompt = build_tip_system_prompt(request, user)
        
        # Call OpenRouter API
        async with httpx.AsyncClient(timeout=30.0) as client:
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
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": "Give me a fresh break tip"}
                    ],
                    "max_tokens": 300,
                    "temperature": 0.9  # Higher temperature for variety
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=502, detail=f"AI provider failed with status: {response.status_code}")
            
            data = response.json()
            
            if not data.get("choices") or len(data["choices"]) == 0:
                raise HTTPException(status_code=502, detail="AI provider returned empty response")
            
            ai_response = data["choices"][0]["message"]["content"]
            
            # Parse JSON from response
            import json
            try:
                # Extract JSON from potential markdown code blocks
                if "```" in ai_response:
                    json_str = ai_response.split("```")[1]
                    if json_str.startswith("json"):
                        json_str = json_str[4:]
                    tip_data = json.loads(json_str.strip())
                else:
                    tip_data = json.loads(ai_response)
                
                return TipResponse(
                    tip=tip_data["tip"],
                    category=tip_data["category"],
                    duration=tip_data["duration"],
                    instruction=tip_data["instruction"]
                )
            except (json.JSONDecodeError, KeyError) as e:
                raise HTTPException(status_code=502, detail=f"Failed to parse AI response: {str(e)}")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate tip: {str(e)}")

# @router.get("/fallback", response_model=TipResponse)
# async def get_fallback_tip():
#     """Get a fallback tip without authentication (for testing)"""
#     tip = random.choice(FALLBACK_TIPS)
#     return TipResponse(**tip)
