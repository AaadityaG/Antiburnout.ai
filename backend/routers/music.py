from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
import httpx
import os
import random
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
    "stressed": [
        "calming rain sounds relaxation 1 hour",
        "gentle piano stress relief relaxing",
        "soft ambient music calm down 1 hour",
        "nature sounds river peaceful relaxing",
        "lo-fi chill beats stress free music",
    ],
    "anxious": [
        "soft piano music anxiety relief relaxing",
        "calming ambient drone peaceful 1 hour",
        "gentle guitar soothing anxiety music",
        "rain on window sounds calming 1 hour",
        "binaural beats anxiety relief peaceful",
    ],
    "tired": [
        "nature sounds recharge energy ambient",
        "uplifting acoustic guitar energizing",
        "light classical music refresh mood",
        "morning birds chirping peaceful ambient",
        "gentle electronic uplifting vibes",
    ],
    "sad": [
        "gentle comforting music peaceful melodies",
        "warm piano emotional healing music",
        "soft strings comforting sadness",
        "hopeful ambient music uplifting 1 hour",
        "calm acoustic guitar gentle vibes",
    ],
    "focus": [
        "lo-fi beats study focus concentration 1 hour",
        "deep focus ambient electronic 1 hour",
        "classical piano study music concentration",
        "chill hop beats productive coding music",
        "minimal ambient focus soundtrack 1 hour",
    ],
    "happy": [
        "uplifting acoustic feel good vibes music",
        "cheerful happy indie folk music",
        "feel good pop acoustic covers",
        "bright piano happy melody music",
        "summer vibes uplifting guitar music",
    ],
    "sleep": [
        "sleep music deep calm ambient 1 hour",
        "delta waves sleep deep rest ambient",
        "gentle rain sleep sounds 1 hour",
        "soft drone sleep meditation music",
        "peaceful night sounds sleep well",
    ],
    "meditate": [
        "meditation music zen calm peaceful 30 min",
        "tibetan singing bowls meditation",
        "om chanting meditation peaceful",
        "nature sounds meditation garden ambient",
        "deep meditation drone calm music",
    ],
}

AMBIENT_MOOD_QUERIES = {
    "stressed": ["4K rain sounds relaxation 1 hour", "4K rain on window peaceful", "4K rainy forest calm 1 hour"],
    "anxious": ["4K ocean waves calm 1 hour", "4K soothing water nature relaxing", "4K peaceful lake ambient 1 hour"],
    "tired": ["4K sunset landscape relaxing 1 hour", "4K golden hour nature calm", "4K warm sunset clouds ambient"],
    "sad": ["4K waterfall nature peaceful 1 hour", "4K gentle rain sounds relaxing", "4K calm stream nature 1 hour"],
    "sleep": ["4K night sky stars ambient 1 hour", "4K moonlight ocean relaxing", "4K peaceful night nature calm"],
    "meditate": ["4K zen garden nature peaceful 1 hour", "4K bamboo forest calm relaxing", "4K calm lake reflection ambient"],
}


async def _youtube_search(query: str, max_results: int = 6) -> List[VideoResult]:
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

        return videos


@router.get("/search", response_model=MusicSearchResponse)
async def search_music(
    q: str = Query(..., description="Search query"),
    max_results: int = Query(6, ge=1, le=20),
):
    videos = await _youtube_search(q, max_results)
    return MusicSearchResponse(query=q, videos=videos)


@router.get("/mood/{mood}", response_model=MusicSearchResponse)
async def get_mood_music(mood: str, max_results: int = Query(6, ge=1, le=20)):
    queries = MOOD_QUERIES.get(mood.lower(), [f"{mood} relaxing music 1 hour"])
    query = random.choice(queries)
    videos = await _youtube_search(query, max_results)
    return MusicSearchResponse(query=query, videos=videos)


@router.get("/ambient/{mood}", response_model=MusicSearchResponse)
async def get_ambient_video(mood: str, max_results: int = Query(6, ge=1, le=20)):
    queries = AMBIENT_MOOD_QUERIES.get(mood.lower(), ["4K nature relaxing 1 hour"])
    query = random.choice(queries)
    videos = await _youtube_search(query, max_results)
    return MusicSearchResponse(query=query, videos=videos)
