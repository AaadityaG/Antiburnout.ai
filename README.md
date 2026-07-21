# AntiBurnout.ai

AI-powered desktop wellness assistant that prevents digital burnout during long screen sessions.

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- MongoDB Atlas (or it falls back to local JSON)

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt

# Create .env from example
copy .env.example .env
# Edit .env with your MONGODB_URI and JWT_SECRET

python main.py
# Runs on http://localhost:8010
```

### Frontend
```bash
cd desk-app
npm install
npm run dev
# Opens Electron app
```

## Environment Variables

```env
# backend/.env
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=app_local
JWT_SECRET=your-secret-key
YOUTUBE_API_KEY=AIza...
```

## Features

### AI Chat Agent
- Wellness coach powered by LangGraph agent
- 5 tools: settings optimization, activity tracking, break tips, music, settings
- Auto-execute mode: applies brightness/volume changes directly
- BYOK: users bring their own OpenRouter API key

### Break Timer
- Configurable interval and duration
- Auto-start on app launch
- Full-screen break overlay with exercises
- System tray integration

### System Control
- Reads/writes actual system brightness (WMI)
- Reads/writes system volume (native module)
- Night mode toggle (Windows Registry)

### Music Player
- Mood-based YouTube music recommendations
- 8 moods: stressed, anxious, tired, sad, focus, happy, sleep, meditate
- Embedded player with playback controls

### Chat History Search
- Semantic search using ChromaDB
- Embeds every conversation (all-MiniLM-L6-v2)
- Star icon toggle in sidebar for AI-powered search

## Project Structure

```
antiburnout.ai/
├── backend/
│   ├── main.py              # FastAPI entry
│   ├── auth.py              # JWT
│   ├── db/                  # Database layer
│   │   ├── connection.py    # Mongo + JSON fallback
│   │   ├── users.py
│   │   ├── settings.py
│   │   ├── chat_history.py
│   │   └── activity.py
│   ├── services/            # Business logic
│   │   ├── encryption.py    # API key encrypt/decrypt
│   │   └── agent_runner.py  # LangGraph orchestration
│   ├── routers/             # API endpoints (8 routers, 20 endpoints)
│   ├── agent/               # AI agent
│   │   ├── graph.py         # LangGraph StateGraph
│   │   └── tools.py         # 5 LangChain tools
│   └── rag/                 # RAG
│       └── vector_store.py  # ChromaDB
├── desk-app/                # Electron + React
│   ├── electron/            # Main process (IPC, tray, timer)
│   └── src/                 # React app
│       ├── components/      # UI overlays
│       └── store/           # Redux slices
```

## API Quick Reference

| Endpoint | Method | What |
|----------|--------|------|
| `/auth/device` | POST | Login with device ID |
| `/chat/send` | POST | Send message to AI agent |
| `/chat/history/search` | POST | Semantic search chat history |
| `/settings/user` | GET/PUT | Break interval/duration |
| `/activity/session` | POST | Save completed session |
| `/tips/recommendation` | POST | Get AI wellness tip |
| `/music/mood/{mood}` | GET | Get music by mood |

Full API docs: http://localhost:8010/docs

## Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| LLM Provider | OpenRouter | Users bring own key, access to multiple models |
| Agent Framework | LangGraph | Stateful multi-tool agent loop |
| Database | MongoDB + JSON fallback | Cloud primary, never crashes without DB |
| Embeddings | all-MiniLM-L6-v2 | Free, local, no API key needed |
| Vector Store | ChromaDB | Zero config, embedded, local |
| Desktop | Electron | Cross-platform, native system access |

## Testing

```bash
# Backend health check
curl http://localhost:8010/health

# Semantic search test
curl -X POST "http://localhost:8010/chat/history/search?token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "eye strain tips", "k": 5}'
```
