from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Save Eyes Reminder API",
    description="Backend API for Save Eyes Reminder application",
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

@app.get("/")
async def root():
    return {"message": "Save Eyes Reminder API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
