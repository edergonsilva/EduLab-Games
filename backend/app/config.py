from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_DIR = Path(__file__).resolve().parents[1]
APP_DIR = PROJECT_DIR / "app"
DEFAULT_DATA_DIR = APP_DIR / "data"
DEFAULT_STORAGE_DIR = PROJECT_DIR / "data_storage"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "EduLab Games"
    app_version: str = "0.1.0"
    admin_password: str = "edulab@admin"
    data_dir: Path = DEFAULT_DATA_DIR
    storage_dir: Path = DEFAULT_STORAGE_DIR
    database_name: str = "edulab.sqlite3"

    @property
    def database_path(self) -> Path:
        return self.storage_dir / self.database_name


settings = Settings()
