import logging
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import router as api_router
from app.services.assemblyai_proxy import handle_agent_proxy

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("vocal_coach_backend")

app = FastAPI(
    title="AI Vocal Coach API",
    version="1.0.0",
    description="Backend API and WebSocket Proxy for AssemblyAI Voice Agent Vocal Coach"
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST API routes
app.include_router(api_router, prefix="/api")


# WebSocket endpoint for real-time voice agent communication
@app.websocket("/ws/agent")
async def websocket_agent_endpoint(websocket: WebSocket):
    await handle_agent_proxy(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
