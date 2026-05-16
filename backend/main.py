from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import device_auth, settings, chat

app = FastAPI(
    title="AntiBurnout API",
    description="Backend API for AntiBurnout desktop application",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(device_auth.router)
app.include_router(settings.router)
app.include_router(chat.router)

@app.get("/")
async def root():
    return {"message": "AntiBurnout API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
