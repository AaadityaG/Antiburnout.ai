from db.users import UserDB
from db.settings import SettingsDB
from db.chat_history import ChatHistoryDB
from db.activity import ActivityDB

db = UserDB()
settings_db = SettingsDB()
chat_history_db = ChatHistoryDB()
activity_db = ActivityDB()
