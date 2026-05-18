from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from auth import verify_token
from database import activity_db

router = APIRouter(prefix="/activity", tags=["Activity"])

class SessionRecord(BaseModel):
    session_duration: int
    target_duration: int
    completed: bool
    skipped: bool = False

class SaveSessionRequest(BaseModel):
    session_duration: int
    target_duration: int
    completed: bool
    skipped: bool = False

class ActivityResponse(BaseModel):
    date: str
    total_session_duration: int
    total_breaks_taken: int
    total_breaks_skipped: int
    sessions_count: int

@router.post("/session")
async def save_session(request: SaveSessionRequest, token: str):
    try:
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        print(f"[Activity API] Saving session for user {user_id}: duration={request.session_duration}s, completed={request.completed}")

        session_data = {
            "session_duration": request.session_duration,
            "target_duration": request.target_duration,
            "completed": request.completed,
            "skipped": request.skipped
        }

        result = activity_db.save_session(user_id, session_data)
        return {"status": "ok", "date": result["date"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save session: {str(e)}")

@router.get("/history")
async def get_activity_history(token: str, days: int = 7):
    try:
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        print(f"[Activity API] Fetching activity history for user {user_id}, days={days}")
        history = activity_db.get_user_activity(user_id, days)
        return history
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get activity: {str(e)}")

@router.get("/today")
async def get_today_activity(token: str):
    try:
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        from datetime import datetime
        today = datetime.utcnow().strftime("%Y-%m-%d")
        activity = activity_db.get_user_activity_by_date(user_id, today)
        if not activity:
            return {
                "date": today,
                "total_session_duration": 0,
                "total_breaks_taken": 0,
                "total_breaks_skipped": 0,
                "sessions_count": 0
            }
        return activity
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get today activity: {str(e)}")