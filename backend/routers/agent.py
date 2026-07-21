from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from auth import verify_token
from database import db
import httpx
from datetime import datetime
import math

router = APIRouter(prefix="/agent", tags=["Burnout Agent"])

class AgentRecommendation(BaseModel):
    id: str
    type: str  # "brightness", "volume", "session_break"
    title: str
    message: str
    priority: int  # 1-5, 5 is highest
    action_type: str  # "execute", "dismiss", "ignore"
    execute_endpoint: Optional[str] = None
    execute_params: Optional[dict] = None
    created_at: str

class SystemMetrics(BaseModel):
    brightness: Optional[int] = None  # 0-100
    volume: Optional[int] = None  # 0-100
    current_hour: Optional[int] = None
    consecutive_sessions: Optional[int] = None
    last_break_skipped: Optional[bool] = None

class AgentRecommendationsResponse(BaseModel):
    recommendation: Optional[AgentRecommendation] = None
    all_recommendations: List[AgentRecommendation] = []

def get_brightness_recommendation(brightness: int, hour: int) -> Optional[AgentRecommendation]:
    """Check if brightness is appropriate for current time"""
    
    # Determine optimal brightness based on time
    if 6 <= hour < 18:  # Daytime
        optimal_min, optimal_max = 60, 75
        time_context = "daytime"
    elif 18 <= hour < 21:  # Evening
        optimal_min, optimal_max = 50, 65
        time_context = "evening"
    else:  # Night (9PM - 6AM)
        optimal_min, optimal_max = 30, 50
        time_context = "night"
    
    if brightness > optimal_max:
        recommended = optimal_max
        return AgentRecommendation(
            id=f"brightness_{datetime.utcnow().strftime('%Y%m%d_%H')}",
            type="brightness",
            title="Reduce Screen Brightness",
            message=f"Your brightness is at {brightness}%. For {time_context} comfort, {recommended}% is recommended to reduce eye strain.",
            priority=4 if brightness > optimal_max + 20 else 3,
            action_type="execute",
            execute_endpoint="agent/execute/brightness",
            execute_params={"target_brightness": recommended},
            created_at=datetime.utcnow().isoformat()
        )
    elif brightness < optimal_min:
        recommended = optimal_min
        return AgentRecommendation(
            id=f"brightness_{datetime.utcnow().strftime('%Y%m%d_%H')}",
            type="brightness",
            title="Increase Screen Brightness",
            message=f"Your brightness is at {brightness}%. For {time_context}, {recommended}% would be more comfortable.",
            priority=2,
            action_type="execute",
            execute_endpoint="agent/execute/brightness",
            execute_params={"target_brightness": recommended},
            created_at=datetime.utcnow().isoformat()
        )
    
    return None

def get_volume_recommendation(volume: int) -> Optional[AgentRecommendation]:
    """Check if volume is safe for long-term use"""
    
    # WHO guidelines: max 60% for extended listening
    if volume > 70:
        return AgentRecommendation(
            id=f"volume_{datetime.utcnow().strftime('%Y%m%d_%H')}",
            type="volume",
            title="Lower Volume for Hearing Protection",
            message=f"Your volume is at {volume}%. For long work sessions, keep it under 60% to protect your hearing (WHO guidelines).",
            priority=5 if volume > 85 else 4,
            action_type="execute",
            execute_endpoint="agent/execute/volume",
            execute_params={"target_volume": 60},
            created_at=datetime.utcnow().isoformat()
        )
    elif volume > 60:
        return AgentRecommendation(
            id=f"volume_{datetime.utcnow().strftime('%Y%m%d_%H')}",
            type="volume",
            title="Consider Lowering Volume",
            message=f"Your volume is at {volume}%. For extended use, 60% or lower is recommended for hearing health.",
            priority=2,
            action_type="execute",
            execute_endpoint="agent/execute/volume",
            execute_params={"target_volume": 60},
            created_at=datetime.utcnow().isoformat()
        )
    
    return None

def get_session_break_recommendation(consecutive_sessions: int) -> Optional[AgentRecommendation]:
    """Suggest longer breaks for extended work sessions"""
    
    if consecutive_sessions >= 5:
        activities = [
            "Take a 10-minute walk outside to reset your focus and get fresh air",
            "Do some light stretching - focus on neck, shoulders, and back for 5-10 minutes",
            "Try the 4-7-8 breathing technique: inhale 4s, hold 7s, exhale 8s (repeat 4 times)",
            "Step away from screens completely. Look at distant objects and rest your eyes for 10 minutes",
            "Grab a glass of water and do a quick body scan meditation for 5 minutes"
        ]
        # Rotate activities based on hour to vary recommendations
        hour = datetime.utcnow().hour
        activity = activities[hour % len(activities)]
        
        return AgentRecommendation(
            id=f"session_{datetime.utcnow().strftime('%Y%m%d_%H')}",
            type="session_break",
            title="Extended Session Detected - Take a Real Break",
            message=f"You've completed {consecutive_sessions} work sessions. {activity}.",
            priority=5,
            action_type="dismiss",
            execute_endpoint=None,
            execute_params=None,
            created_at=datetime.utcnow().isoformat()
        )
    elif consecutive_sessions >= 3:
        return AgentRecommendation(
            id=f"session_{datetime.utcnow().strftime('%Y%m%d_%H')}",
            type="session_break",
            title="Time for a Longer Break",
            message=f"You've done {consecutive_sessions} sessions. Consider a 5-minute break with some stretching or hydration.",
            priority=3,
            action_type="dismiss",
            execute_endpoint=None,
            execute_params=None,
            created_at=datetime.utcnow().isoformat()
        )
    
    return None

@router.get("/recommendations", response_model=AgentRecommendationsResponse)
async def get_recommendations(
    token: str,
    brightness: Optional[int] = None,
    volume: Optional[int] = None,
    current_hour: Optional[int] = None,
    consecutive_sessions: Optional[int] = None,
    show_all: Optional[bool] = False
):
    """Get personalized burnout prevention recommendations"""
    try:
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Generate all recommendations
        recommendations = []
        
        if brightness is not None and current_hour is not None:
            rec = get_brightness_recommendation(brightness, current_hour)
            if rec:
                recommendations.append(rec)
        
        if volume is not None:
            rec = get_volume_recommendation(volume)
            if rec:
                recommendations.append(rec)
        
        if consecutive_sessions is not None:
            rec = get_session_break_recommendation(consecutive_sessions)
            if rec:
                recommendations.append(rec)
        
        # Sort by priority (highest first)
        recommendations.sort(key=lambda x: x.priority, reverse=True)
        
        # Return all if requested, otherwise return highest priority only
        if show_all:
            return AgentRecommendationsResponse(
                recommendation=recommendations[0] if recommendations else None,
                all_recommendations=recommendations
            )
        else:
            return AgentRecommendationsResponse(
                recommendation=recommendations[0] if recommendations else None,
                all_recommendations=[]
            )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")

@router.post("/execute/{action_type}")
async def execute_recommendation(action_type: str, token: str, params: dict):
    """Execute a recommendation (brightness/volume adjustment)"""
    try:
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Note: Actual system control would require Electron IPC
        # This endpoint acknowledges the action and could trigger Electron commands
        
        return {
            "success": True,
            "message": f"Action {action_type} acknowledged. System adjustment will be applied.",
            "params": params
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Execution error: {str(e)}")
