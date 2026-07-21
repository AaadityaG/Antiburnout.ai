from typing import Optional
from datetime import datetime, timedelta
from db.connection import USE_MONGO, activity_collection, _mem_activity, _persist


class ActivityDB:
    def save_session(self, user_id: str, session_data: dict) -> dict:
        if USE_MONGO:
            from bson import ObjectId
            today = datetime.utcnow().strftime("%Y-%m-%d")
            existing = activity_collection.find_one({
                "user_id": ObjectId(user_id),
                "date": today
            })
            if existing:
                activity_collection.update_one(
                    {"_id": existing["_id"]},
                    {
                        "$push": {
                            "sessions": {
                                "session_duration": session_data["session_duration"],
                                "target_duration": session_data["target_duration"],
                                "completed": session_data["completed"],
                                "skipped": session_data.get("skipped", False),
                                "timestamp": datetime.utcnow()
                            }
                        },
                        "$inc": {
                            "total_session_duration": session_data["session_duration"],
                            "total_breaks_taken": 1,
                            "total_breaks_skipped": 1 if session_data.get("skipped") else 0
                        },
                        "$set": {"last_updated": datetime.utcnow()}
                    }
                )
            else:
                activity_collection.insert_one({
                    "user_id": ObjectId(user_id),
                    "date": today,
                    "sessions": [{
                        "session_duration": session_data["session_duration"],
                        "target_duration": session_data["target_duration"],
                        "completed": session_data["completed"],
                        "skipped": session_data.get("skipped", False),
                        "timestamp": datetime.utcnow()
                    }],
                    "total_session_duration": session_data["session_duration"],
                    "total_breaks_taken": 1,
                    "total_breaks_skipped": 1 if session_data.get("skipped") else 0,
                    "last_updated": datetime.utcnow()
                })
            return {"status": "ok", "date": today}
        today = datetime.utcnow().strftime("%Y-%m-%d")
        for r in _mem_activity:
            if r["user_id"] == user_id and r["date"] == today:
                r["sessions"].append({
                    "session_duration": session_data["session_duration"],
                    "target_duration": session_data["target_duration"],
                    "completed": session_data["completed"],
                    "skipped": session_data.get("skipped", False),
                    "timestamp": datetime.utcnow()
                })
                r["total_session_duration"] += session_data["session_duration"]
                r["total_breaks_taken"] += 1
                if session_data.get("skipped"):
                    r["total_breaks_skipped"] += 1
                r["last_updated"] = datetime.utcnow()
                _persist()
                return {"status": "ok", "date": today}
        _mem_activity.append({
            "user_id": user_id,
            "date": today,
            "sessions": [{
                "session_duration": session_data["session_duration"],
                "target_duration": session_data["target_duration"],
                "completed": session_data["completed"],
                "skipped": session_data.get("skipped", False),
                "timestamp": datetime.utcnow()
            }],
            "total_session_duration": session_data["session_duration"],
            "total_breaks_taken": 1,
            "total_breaks_skipped": 1 if session_data.get("skipped") else 0,
            "last_updated": datetime.utcnow()
        })
        _persist()
        return {"status": "ok", "date": today}

    def get_user_activity(self, user_id: str, days: int = 7) -> list:
        if USE_MONGO:
            from bson import ObjectId
            start_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
            records = list(
                activity_collection.find({
                    "user_id": ObjectId(user_id),
                    "date": {"$gte": start_date}
                }).sort("date", -1)
            )
            formatted = []
            for r in records:
                formatted.append({
                    "date": r["date"],
                    "total_session_duration": r.get("total_session_duration", 0),
                    "total_breaks_taken": r.get("total_breaks_taken", 0),
                    "total_breaks_skipped": r.get("total_breaks_skipped", 0),
                    "sessions_count": len(r.get("sessions", []))
                })
            return formatted
        start_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
        user_records = [r for r in _mem_activity if r["user_id"] == user_id and r["date"] >= start_date]
        user_records.sort(key=lambda x: x["date"], reverse=True)
        formatted = []
        for r in user_records:
            formatted.append({
                "date": r["date"],
                "total_session_duration": r.get("total_session_duration", 0),
                "total_breaks_taken": r.get("total_breaks_taken", 0),
                "total_breaks_skipped": r.get("total_breaks_skipped", 0),
                "sessions_count": len(r.get("sessions", []))
            })
        return formatted

    def get_user_activity_by_date(self, user_id: str, date: str) -> Optional[dict]:
        if USE_MONGO:
            from bson import ObjectId
            record = activity_collection.find_one({
                "user_id": ObjectId(user_id),
                "date": date
            })
            if record:
                record["id"] = str(record["_id"])
                record.pop("_id", None)
                record.pop("user_id", None)
                return record
            return None
        for r in _mem_activity:
            if r["user_id"] == user_id and r["date"] == date:
                copy = dict(r)
                copy.pop("user_id", None)
                return copy
        return None
