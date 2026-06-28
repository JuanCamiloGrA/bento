from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from bento.infrastructure.settings import Settings, get_settings
from bento.interfaces.http.routes import router


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or get_settings()
    app = FastAPI(title=resolved_settings.app_name, version=resolved_settings.app_version)
    app.state.settings = resolved_settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router, prefix="/api")
    return app


app = create_app()


def main() -> None:
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "bento.interfaces.http.main:app",
        host=settings.host,
        port=settings.api_port,
        reload=False,
    )


if __name__ == "__main__":
    main()