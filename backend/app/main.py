from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.logging_config import setup_logging, logger
from app.database import init_db
from app.telemetry import telemetry_service

from app.api.health import router as health_router
from app.api.telemetry import router as telemetry_router
from app.api.metrics import router as metrics_router
from app.api.websocket import router as ws_router
from app.api.pir_usb import router as pir_usb_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    setup_logging()
    logger.info("Iniciando %s v%s", settings.APP_NAME, settings.APP_VERSION)
    await init_db()
    await telemetry_service.initialize()
    try:
        yield
    finally:
        await telemetry_service.shutdown()


app = FastAPI(
    title="Sistema de Detección de Presencia mediante PIR y CSI Wi-Fi",
    description=(
        "API y Servicio de Telemetría en Tiempo Real para la comparación experimental "
        "de tres métodos de detección: Sensor PIR, CSI con Router y CSI en Red Dedicada. "
        "Taller de Proyecto II 2026 — Grupo M1."
    ),
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api/v1")
app.include_router(telemetry_router, prefix="/api/v1")
app.include_router(metrics_router, prefix="/api/v1")
app.include_router(pir_usb_router, prefix="/api/v1")
app.include_router(ws_router)


@app.get("/")
async def root():
    return {
        "project": "Detección de Presencia mediante PIR y CSI Wi-Fi",
        "group": "Grupo M1 - Taller de Proyecto II 2026",
        "docs_url": "/docs",
        "health_url": "/api/v1/health",
        "data_source": settings.DATA_SOURCE,
    }
