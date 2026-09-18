"""Punto de entrada principal para el backend FastAPI."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.database.connection import init_db
from app.services.telemetry_service import telemetry_service

# Routers
from app.api.routes.health import router as health_router
from app.api.routes.telemetry import router as telemetry_router
from app.api.routes.metrics import router as metrics_router
from app.api.routes.cases import router as cases_router
from app.api.routes.websocket import router as ws_router

# Inicializar logging
setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ciclo de vida de la aplicación: arranque y apagado limpio."""
    logger.info("==================================================")
    logger.info(f"Iniciando {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Modo de Fuente de Datos: {settings.DATA_SOURCE.upper()}")
    logger.info("==================================================")

    # 1. Inicializar base de datos SQLite y semillas
    await init_db()

    # 2. Inicializar servicio de telemetría y generador/suscriptor de datos
    await telemetry_service.initialize()

    yield

    # Apagado limpio
    logger.info("Cerrando servicios de telemetría y conexiones...")
    await telemetry_service.shutdown()
    logger.info("Servicios detenidos correctamente.")


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

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusión de Rutas
app.include_router(health_router, prefix="/api/v1")
app.include_router(telemetry_router, prefix="/api/v1")
app.include_router(metrics_router, prefix="/api/v1")
app.include_router(cases_router, prefix="/api/v1")
app.include_router(ws_router)


@app.get("/")
async def root():
    """Redirección o bienvenida."""
    return {
        "project": "Detección de Presencia mediante PIR y CSI Wi-Fi",
        "group": "Grupo M1 - Taller de Proyecto II 2026",
        "docs_url": "/docs",
        "health_url": "/api/v1/health",
        "data_source": settings.DATA_SOURCE,
    }
