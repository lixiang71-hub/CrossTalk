import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from dotenv import load_dotenv

# Import from the flattened structure
from api.endpoints import router as api_router

load_dotenv()

def create_app() -> FastAPI:
    app = FastAPI(title="职能沟通翻译助手")

    # Enable CORS for frontend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Dynamic path discovery for UI
    base_dir = os.path.dirname(os.path.abspath(__file__))
    ui_dir = os.path.join(base_dir, "ui")

    # Include API Router FIRST so it takes precedence over static files
    app.include_router(api_router)

    # Mount static files (CSS, JS, Assets) at the root
    # Using html=True so it handles index.html and relative paths correctly
    if os.path.exists(ui_dir):
        @app.get("/ui")
        async def serve_ui():
            return FileResponse(os.path.join(ui_dir, "index.html"))

        @app.get("/")
        async def root_redirect():
            return RedirectResponse(url="/ui")

        app.mount("/", StaticFiles(directory=ui_dir, html=True), name="ui")

    return app

app = create_app()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
