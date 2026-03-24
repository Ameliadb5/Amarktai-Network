import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Amarktai Marketing API", version="1.0.0")

_cors_origins_raw = os.getenv("CORS_ALLOWED_ORIGINS", "")
_allowed_origins = [o.strip() for o in _cors_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "service": "amarktai-marketing-api"}
