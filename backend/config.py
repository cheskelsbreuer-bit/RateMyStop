from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./ratemystop.db"
    upload_dir: str = "./uploads"
    max_upload_mb: int = 10

    # CORS — comma-separated list of allowed origins for the frontend
    cors_origins: str = "http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000,http://localhost:8080"

    # Resend (email). Leave RESEND_API_KEY blank to skip actually sending — complaints will still be logged.
    resend_api_key: str = ""
    resend_from: str = "RateMyStop <complaints@ratemystop.local>"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
