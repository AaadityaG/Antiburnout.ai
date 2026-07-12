from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/music", tags=["Music"])

YOUTUBE_API_KEY = os.getenv("YTKEY")
YOUTUBE_BASE = "https://www.googleapis.com/youtube/v3"


class VideoResult(BaseModel):
    video_id: str
    title: str
    channel: str
    thumbnail: str
    duration: Optional[str] = None


class MusicSearchResponse(BaseModel):
    query: str
    videos: List[VideoResult]


MOOD_QUERIES = {
    "stressed": "calming rain sounds relaxation 1 hour",
    "anxious": "soft piano music anxiety relief relaxing",
    "tired": "nature sounds recharge energy ambient",
    "sad": "gentle comforting music peaceful melodies",
    "focus": "lo-fi beats study focus concentration 1 hour",
    "happy": "uplifting acoustic feel good vibes music",
    "sleep": "sleep music deep calm ambient 1 hour",
    "meditate": "meditation music zen calm peaceful 30 min",
}


@router.get("/search", response_model=MusicSearchResponse)
async def search_music(
    q: str = Query(..., description="Search query"),
    max_results: int = Query(6, ge=1, le=20),
):
    if not YOUTUBE_API_KEY:
        raise HTTPException(status_code=500, detail="YouTube API key not configured")

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{YOUTUBE_BASE}/search",
            params={
                "key": YOUTUBE_API_KEY,
                "q": q,
                "part": "snippet",
                "type": "video",
                "videoCategoryId": "10",
                "maxResults": max_results,
                "order": "relevance",
            },
        )

        if response.status_code != 200:
            error = response.json().get("error", {}).get("message", "Unknown error")
            raise HTTPException(status_code=502, detail=f"YouTube API error: {error}")

        data = response.json()
        videos = []
        for item in data.get("items", []):
            snippet = item["snippet"]
            videos.append(VideoResult(
                video_id=item["id"]["videoId"],
                title=snippet["title"],
                channel=snippet["channelTitle"],
                thumbnail=snippet["thumbnails"]["high"]["url"],
            ))

        return MusicSearchResponse(query=q, videos=videos)


@router.get("/mood/{mood}", response_model=MusicSearchResponse)
async def get_mood_music(mood: str, max_results: int = Query(6, ge=1, le=20)):
    query = MOOD_QUERIES.get(mood.lower(), f"{mood} relaxing music 1 hour")

    if not YOUTUBE_API_KEY:
        raise HTTPException(status_code=500, detail="YouTube API key not configured")

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{YOUTUBE_BASE}/search",
            params={
                "key": YOUTUBE_API_KEY,
                "q": query,
                "part": "snippet",
                "type": "video",
                "videoCategoryId": "10",
                "maxResults": max_results,
                "order": "relevance",
            },
        )

        if response.status_code != 200:
            error = response.json().get("error", {}).get("message", "Unknown error")
            raise HTTPException(status_code=502, detail=f"YouTube API error: {error}")

        data = response.json()
        videos = []
        for item in data.get("items", []):
            snippet = item["snippet"]
            videos.append(VideoResult(
                video_id=item["id"]["videoId"],
                title=snippet["title"],
                channel=snippet["channelTitle"],
                thumbnail=snippet["thumbnails"]["high"]["url"],
            ))

        return MusicSearchResponse(query=query, videos=videos)
