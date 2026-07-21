# AntiBurnout.ai — Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Electron Desktop App                   │
│  React + Redux + Tailwind + Framer Motion               │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │   Chat   │ │  Timer   │ │ Settings │ │ Insights │   │
│  │ Overlay  │ │  System  │ │ Overlay  │ │ Overlay  │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │
│       │             │            │             │          │
│  ┌────┴─────────────┴────────────┴─────────────┴────┐   │
│  │              Electron IPC Layer                   │   │
│  │  System brightness / volume / night mode / tray   │   │
│  └──────────────────────┬───────────────────────────┘   │
└─────────────────────────┼───────────────────────────────┘
                          │ HTTP + JWT
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    FastAPI Backend                       │
│                                                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │
│  │  Auth   │  │  Chat   │  │ Activity│  │ Settings│   │
│  │ Router  │  │ Router  │  │ Router  │  │ Router  │   │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘   │
│       │            │            │             │          │
│  ┌────┴────────────┴────────────┴─────────────┴────┐   │
│  │                  Services Layer                  │   │
│  │  encryption.py    agent_runner.py                │   │
│  └──────────────────────┬──────────────────────────┘   │
│                         │                               │
│  ┌──────────────────────┴──────────────────────────┐   │
│  │                  Agent Layer                     │   │
│  │  LangGraph StateGraph + 5 LangChain Tools        │   │
│  └──────────────────────┬──────────────────────────┘   │
│                         │                               │
│  ┌──────────┐  ┌────────┴───────┐  ┌───────────────┐  │
│  │   RAG    │  │   Database     │  │   External    │  │
│  │ ChromaDB │  │  MongoDB/JSON  │  │  OpenRouter   │  │
│  └──────────┘  └────────────────┘  │  YouTube API  │  │
│                                    └───────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Backend Directory Structure

```
backend/
├── main.py                    # FastAPI app, CORS, router mounts
├── auth.py                    # JWT create/verify
│
├── db/                        # Database layer
│   ├── __init__.py            # Re-exports: db, settings_db, chat_history_db, activity_db
│   ├── connection.py          # MongoDB connection + JSON fallback
│   ├── users.py               # UserDB — user CRUD
│   ├── settings.py            # SettingsDB — break settings CRUD
│   ├── chat_history.py        # ChatHistoryDB — chat session CRUD
│   └── activity.py            # ActivityDB — activity tracking
│
├── services/                  # Business logic layer
│   ├── __init__.py
│   ├── encryption.py          # Fernet encrypt/decrypt for API keys
│   └── agent_runner.py        # LangGraph agent orchestration + tool parsing
│
├── routers/                   # API endpoints
│   ├── device_auth.py         # POST /auth/device, GET /auth/me, PUT /auth/profile
│   ├── chat.py                # POST /chat/send
│   ├── chat_history.py        # GET/DELETE /chat/history, POST /chat/history/search
│   ├── settings.py            # GET/PUT /settings/user
│   ├── activity.py            # POST /activity/session, GET /activity/history
│   ├── agent.py               # GET /agent/recommendations, POST /agent/execute/{type}
│   ├── tips.py                # POST /tips/recommendation
│   └── music.py               # GET /music/search, GET /music/mood/{mood}
│
├── agent/                     # AI agent layer
│   ├── __init__.py
│   ├── graph.py               # LangGraph StateGraph + system prompt
│   └── tools.py               # 5 LangChain tools
│
├── rag/                       # RAG layer
│   ├── __init__.py
│   └── vector_store.py        # ChromaDB + HuggingFace embeddings
│
├── requirements.txt
├── .env                       # MONGODB_URI, JWT keys, YOUTUBE_API_KEY
└── local_db.json              # Fallback when MongoDB is unreachable
```

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/auth/device` | Device login (auto-register) |
| GET | `/auth/me` | Get current profile |
| PUT | `/auth/profile` | Update profile + AI providers |
| GET | `/auth/ai-providers/{key}` | Get decrypted AI provider config |
| POST | `/chat/send` | Send message → agent → response |
| GET | `/chat/history/` | List chat sessions |
| GET | `/chat/history/{id}` | Get session messages |
| POST | `/chat/history/search` | Semantic search (ChromaDB) |
| DELETE | `/chat/history/{id}` | Delete session |
| DELETE | `/chat/history/clear` | Clear all history |
| GET | `/settings/user` | Get break settings |
| PUT | `/settings/user` | Update break settings |
| POST | `/activity/session` | Save completed session |
| GET | `/activity/history` | Get activity history |
| GET | `/activity/today` | Get today's activity |
| GET | `/agent/recommendations` | Rule-based recommendations |
| POST | `/agent/execute/{type}` | Execute a recommendation |
| POST | `/tips/recommendation` | AI-generated wellness tip |
| GET | `/music/search` | Search YouTube music |
| GET | `/music/mood/{mood}` | Music by mood |

## Agent Architecture

```
User message
    ↓
[agent_node] → LLM (OpenRouter) + bound tools
    ↓                          ↓
  No tool calls           Tool calls
    ↓                          ↓
   END                    [tools_node] → execute tool
                              ↓
                         [agent_node] → loop again
```

### 5 Agent Tools

| Tool | Purpose |
|------|---------|
| `check_system_settings` | Analyze brightness/volume/night mode against health guidelines |
| `get_user_activity` | Query user's break history from DB |
| `get_user_break_settings` | Get user's configured break preferences |
| `get_break_tip` | Return wellness tip from curated library |
| `recommend_music` | Map mood → YouTube music category |

### RAG Pipeline

```
Every chat response
    ↓
Embed (all-MiniLM-L6-v2, 384 dims)
    ↓
Store in Chroma (per-user collection)
    ↓
POST /chat/history/search
    ↓
Embed query → cosine similarity → return top-k
```

## Data Flow: Chat Message

```
1. Client → POST /chat/send { message, session_id, brightness, volume }
2. Backend verifies JWT, loads user + AI provider config
3. Decrypts API key (Fernet, device-specific)
4. Builds system prompt with user context + system metrics
5. Creates LangGraph agent with 5 tools
6. Agent loops: LLM → tool calls → LLM → ... → final text
7. Extracts recommendations from tool responses
8. Saves to MongoDB chatbot-history
9. Embeds pair → stores in Chroma
10. Returns { response, session_id, recommendations, tools_used }
```

## Frontend Directory Structure

```
desk-app/
├── electron/
│   ├── main.ts               # Electron main process (window, tray, timer, IPC)
│   └── preload.ts            # Context bridge for renderer
├── src/
│   ├── App.tsx               # Root component, overlay orchestration
│   ├── main.tsx              # Entry point (Redux + Toast providers)
│   ├── components/
│   │   ├── ChatOverlay.tsx   # AI chat with sidebar history + semantic search
│   │   ├── BreakView.tsx     # Full-screen break timer
│   │   ├── SettingsOverlay.tsx
│   │   ├── ProfileOverlay.tsx
│   │   ├── InsightsOverlay.tsx
│   │   ├── MusicOverlay.tsx
│   │   ├── AgentRecommendation.tsx
│   │   ├── LoginModal.tsx
│   │   ├── ConfirmDialog.tsx
│   │   └── Toast.tsx
│   ├── store/                # Redux Toolkit
│   │   ├── authSlice.ts
│   │   ├── chatSlice.ts
│   │   ├── settingsSlice.ts
│   │   ├── activitySlice.ts
│   │   └── tipSlice.ts
│   └── types/
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 38 + React 19 |
| Styling | Tailwind CSS v4 + Framer Motion |
| State | Redux Toolkit |
| Backend | Python FastAPI + Uvicorn |
| Database | MongoDB Atlas (JSON fallback) |
| AI Agent | LangGraph + LangChain + OpenRouter |
| Embeddings | all-MiniLM-L6-v2 (local) |
| Vector Store | ChromaDB (local SQLite) |
| Auth | JWT + device ID |
