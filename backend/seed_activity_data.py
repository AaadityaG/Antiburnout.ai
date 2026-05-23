"""
Script to seed sample activity data for aditya@gmail.com
Creates realistic screen time data for the last 7 days
"""
from datetime import datetime, timedelta
from pymongo import MongoClient
from dotenv import load_dotenv
import os
import random

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "app_local")

client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]
users_collection = db["users"]
activity_collection = db["activity"]

# Find user by email
user = users_collection.find_one({"email": "aditya@gmail.com"})
if not user:
    print("❌ User aditya@gmail.com not found!")
    exit(1)

user_id = user["_id"]
print(f"✅ Found user: {user.get('email')} (ID: {user_id})")

# Clear existing activity data for this user
activity_collection.delete_many({"user_id": user_id})
print("🗑️  Cleared existing activity data")

# Generate data for last 7 days
today = datetime.utcnow()
activities = []

for days_ago in range(6, -1, -1):
    date = (today - timedelta(days=days_ago)).strftime("%Y-%m-%d")
    
    # Generate realistic session data
    num_sessions = random.randint(4, 8)
    sessions = []
    total_duration = 0
    breaks_taken = 0
    breaks_skipped = 0
    
    for _ in range(num_sessions):
        # Session duration between 15-45 minutes (in seconds)
        session_duration = random.randint(900, 2700)
        target_duration = random.choice([1800, 2400, 2700])  # 30, 40, or 45 min target
        completed = random.random() > 0.2  # 80% completion rate
        skipped = not completed and random.random() > 0.5
        
        session = {
            "session_duration": session_duration,
            "target_duration": target_duration,
            "completed": completed,
            "skipped": skipped,
            "timestamp": datetime.utcnow() - timedelta(hours=random.randint(1, 12))
        }
        sessions.append(session)
        total_duration += session_duration
        
        if completed:
            breaks_taken += 1
        if skipped:
            breaks_skipped += 1
    
    activity_doc = {
        "user_id": user_id,
        "date": date,
        "sessions": sessions,
        "total_session_duration": total_duration,
        "total_breaks_taken": breaks_taken,
        "total_breaks_skipped": breaks_skipped,
        "last_updated": datetime.utcnow()
    }
    
    activities.append(activity_doc)
    print(f"📅 {date}: {num_sessions} sessions, {total_duration//60}min total, {breaks_taken} breaks")

# Insert all activities
activity_collection.insert_many(activities)
print(f"\n✅ Successfully seeded {len(activities)} days of activity data!")
print(f"📊 Total sessions: {sum(len(a['sessions']) for a in activities)}")
print(f"⏱️  Total screen time: {sum(a['total_session_duration'] for a in activities)//60} minutes")
