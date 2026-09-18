"""Rutas REST descriptivas para información técnica de los 3 casos de estudio."""

from typing import List, Dict, Any
from fastapi import APIRouter
from app.core.constants import CaseId

router = APIRouter(prefix="/cases", tags=["Casos de Estudio"])

CASES_INFO = {
    CaseId.PIR.value: {
        "id": CaseId.PIR.value,
        "name": "Caso 1 — Sensor Infrarrojo Pasivo (PIR)",
        "short_name": "PIR",
        "description": "Detección de radiación térmica infrarroja emitida por el cuerpo humano en movimiento a través de una lente de Fresnel.",
        "technology": "Sensor piroeléctrico analógico + comparador / GPIO",
        "hardware": "ESP32 DevKit v1 + Sensor HC-SR501 / AM312",
        "signal_nature": "Digital binaria (0 = Ausencia, 1 = Detección de calor/movimiento)",
        "advantages": ["Bajo consumo energético", "Latencia física instantánea", "Simplicidad de procesamiento"],
        "limitations": ["Requiere línea de visión directa", "Incapaz de detectar personas estáticas o dormidas", "Sensible a cambios térmicos ambientales"],
    },
    CaseId.CSI_ROUTER.value: {
        "id": CaseId.CSI_ROUTER.value,
        "name": "Caso 2 — CSI con Router Wi-Fi Existente",
        "short_name": "CSI Router",
        "description": "Aprovechamiento de la infraestructura Wi-Fi existente (router del laboratorio/hogar) donde un único ESP32 receptor captura el Channel State Information de los paquetes beacon y tráfico de datos.",
        "technology": "Wi-Fi 802.11 b/g/n OFDM Subcarriers CSI",
        "hardware": "ESP32 en modo Station conectado a Router comercial",
        "signal_nature": "Analógica continua multidimensional (matriz subportadoras x tiempo)",
        "advantages": ["No requiere despliegue de nuevos puntos de acceso", "Detecta presencia sin línea de visión (a través de paredes delgadas)", "Sensible a micro-movimientos"],
        "limitations": ["Fluctuaciones de tráfico no controladas de otros clientes Wi-Fi", "Ruido de canal no coordinado"],
    },
    CaseId.CSI_DEDICATED.value: {
        "id": CaseId.CSI_DEDICATED.value,
        "name": "Caso 3 — CSI en Red Wi-Fi Dedicada",
        "short_name": "CSI Dedicado",
        "description": "Enlace punto a punto cerrado y controlado formado por dos nodos ESP32: un nodo transmisor como Access Point emitiendo tramas a tasa constante y un nodo receptor analizando el canal libre de interferencia externa.",
        "technology": "Enlace Wi-Fi dedicado con tasa de transmisión fija (CSI Injection)",
        "hardware": "ESP32_1 (Access Point emisor) + ESP32_2 (Station receptor)",
        "signal_nature": "Analógica continua de alta reproducibilidad y baja varianza base",
        "advantages": ["Canal RF estrictamente controlado y limpio", "Máxima consistencia experimental", "Permite calibración fina de zonas de Fresnel"],
        "limitations": ["Requiere desplegar dos dispositivos dedicados", "Consumo de energía ligeramente superior"],
    },
}


@router.get("", response_model=List[Dict[str, Any]])
async def list_cases():
    """Retorna la lista y especificación técnica de los tres casos de estudio."""
    return list(CASES_INFO.values())


@router.get("/{case_id}", response_model=Dict[str, Any])
async def get_case_detail(case_id: str):
    """Retorna los detalles técnicos y de hardware de un caso específico."""
    if case_id not in CASES_INFO:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    return CASES_INFO[case_id]
