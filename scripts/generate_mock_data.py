#!/usr/bin/env python3
"""
Script para generar lotes adicionales de ensayos sintéticos con Ground Truth
y persistirlos en la base de datos SQLite.
"""

import asyncio
import random
import sys
import os

# Agregar directorio padre para importar backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.database.connection import init_db
from app.repositories.metrics_repository import metrics_repo
from app.core.constants import CaseId


async def main():
    print("Iniciando generación de ensayos sintéticos experimentales...")
    await init_db()

    # Generar 20 ensayos por cada caso con probabilidades representativas
    cases_config = [
        (CaseId.PIR.value, 0.97, 145.0, 15.0),
        (CaseId.CSI_ROUTER.value, 0.94, 320.0, 20.0),
        (CaseId.CSI_DEDICATED.value, 0.91, 400.0, 25.0),
    ]

    for case_id, accuracy_prob, mean_lat, std_lat in cases_config:
        print(f"Generando ensayos para {case_id}...")
        for i in range(25):
            ground_truth = random.choice([True, False])
            # Acertar según la probabilidad del método
            if random.random() < accuracy_prob:
                detected = ground_truth
            else:
                detected = not ground_truth

            lat = max(50.0, random.gauss(mean_lat, std_lat))
            score = random.uniform(0.75, 0.98) if detected else random.uniform(0.05, 0.35)

            await metrics_repo.add_trial(
                case_id=case_id,
                ground_truth=ground_truth,
                detected_presence=detected,
                latency_ms=lat,
                score=score,
                notes=f"Ensayo sintético automatizado #{i+1}",
            )

    print("Generación completada con éxito.")


if __name__ == "__main__":
    asyncio.run(main())
