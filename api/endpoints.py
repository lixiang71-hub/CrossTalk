from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

# Absolute imports from the flattened structure
from models.schemas import TranslationRequest
from core.prompts import SYSTEM_PROMPTS
from services.translation import app_graph

router = APIRouter()

@router.post("/translate")
async def translate(request: TranslationRequest):
    if request.direction not in SYSTEM_PROMPTS:
        raise HTTPException(status_code=400, detail="Invalid translation direction")
    
    try:
        async def event_stream():
            async for event in app_graph.astream_events(
                {"content": request.content, "direction": request.direction},
                version="v2"
            ):
                if event["event"] == "on_chat_model_stream":
                    chunk = event["data"]["chunk"]
                    if chunk.content:
                        yield chunk.content

        return StreamingResponse(event_stream(), media_type="text/plain")
    
    except Exception as e:
        print(f"Error in translate: {e}")
        raise HTTPException(status_code=500, detail=str(e))
