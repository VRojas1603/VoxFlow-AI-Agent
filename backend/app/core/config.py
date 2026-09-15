from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

# Absolute path to backend/.env
ENV_FILE_PATH = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    ASSEMBLYAI_API_KEY: str = ""
    ENVIRONMENT: str = "development"
    PORT: int = 8000
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    ASSEMBLYAI_WS_URL: str = "wss://agents.assemblyai.com/v1/ws"

    model_config = SettingsConfigDict(
        env_file=ENV_FILE_PATH,
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
