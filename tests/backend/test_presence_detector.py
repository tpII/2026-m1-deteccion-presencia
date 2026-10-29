"""Tests del detector CSI de dos indicadores (movimiento y forma) y de su calibración."""

import numpy as np
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.signal_processing.presence_detector import CalibrationState, CsiPresenceDetector

SUBCARRIERS = 55
PACKET_PERIOD = 0.1  # 10 paquetes por segundo, como el firmware
RNG = np.random.default_rng(0)
EMPTY_ROOM = 15 + 5 * np.sin(np.linspace(0, 3, SUBCARRIERS))  # forma fija del canal vacío
PERSON_STILL = 15 + 5 * np.sin(np.linspace(0, 3, SUBCARRIERS) + 1.2)  # otra forma, igual de estable


def empty_packet():
    return EMPTY_ROOM * RNG.normal(1, 0.01) + RNG.normal(0, 0.15, SUBCARRIERS)


def still_person_packet():
    return PERSON_STILL * RNG.normal(1, 0.01) + RNG.normal(0, 0.15, SUBCARRIERS)


def walking_packet():
    return EMPTY_ROOM * np.abs(RNG.normal(1, 0.35, SUBCARRIERS))


def feed(detector, start, seconds, make_packet):
    """Envía paquetes a 10 por segundo y devuelve los resultados y el instante final."""
    results, now = [], start
    for _ in range(int(seconds / PACKET_PERIOD)):
        results.append(detector.process(now, list(make_packet())))
        now += PACKET_PERIOD
    return results, now


def calibrated_detector():
    detector = CsiPresenceDetector()
    detector.start_calibration(0.0, delay_seconds=2, duration_seconds=30)
    _, now = feed(detector, 0.0, 33, empty_packet)
    assert detector.state == CalibrationState.READY
    return detector, now


def test_without_calibration_there_is_no_presence_but_movement_is_measured():
    detector = CsiPresenceDetector()
    results, _ = feed(detector, 0.0, 3, walking_packet)
    assert detector.state == CalibrationState.NOT_CALIBRATED
    assert all(result.presence is False for result in results)
    assert results[-1].movement_index is not None
    assert results[-1].shape_index is None


def test_calibration_goes_through_waiting_and_running():
    detector = CsiPresenceDetector()
    detector.start_calibration(0.0, delay_seconds=2, duration_seconds=20)
    assert detector.calibration_progress(1.0) == (0.0, 1.0)
    assert detector.state == CalibrationState.WAITING
    feed(detector, 0.0, 12, empty_packet)
    assert detector.state == CalibrationState.RUNNING
    progress, remaining = detector.calibration_progress(12.0)
    assert progress == pytest.approx(0.5)
    assert remaining == pytest.approx(10.0)


def test_calibrated_detector_separates_empty_still_and_walking():
    detector, now = calibrated_detector()
    assert detector.movement_threshold > 0 and detector.shape_threshold > 0

    empty, now = feed(detector, now, 20, empty_packet)
    walking, now = feed(detector, now, 20, walking_packet)
    still, now = feed(detector, now, 20, still_person_packet)

    def rate(results):
        return np.mean([result.presence for result in results[50:]])  # se descarta la transición

    assert rate(empty) < 0.05
    assert rate(walking) > 0.95
    assert rate(still) > 0.95
    # La persona quieta se detecta por la forma del canal, no por el movimiento
    assert still[-1].movement_index < detector.movement_threshold
    assert still[-1].shape_index > detector.shape_threshold


def test_calibration_fails_without_enough_packets_and_keeps_previous_state():
    detector = CsiPresenceDetector()
    detector.start_calibration(0.0, delay_seconds=0, duration_seconds=20)
    detector.process(1.0, list(empty_packet()))
    detector.calibration_progress(25.0)
    assert detector.state == CalibrationState.NOT_CALIBRATED
    assert "fallida" in detector.message


def test_a_different_number_of_subcarriers_asks_for_a_new_calibration():
    detector, now = calibrated_detector()
    result = detector.process(now, list(empty_packet()[:40]))
    assert detector.state == CalibrationState.NOT_CALIBRATED
    assert result.presence is False


async def test_calibration_endpoints():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        started = await client.post("/api/v1/csi/csi_router/calibration",
                                    json={"delay_seconds": 5, "duration_seconds": 30})
        status = await client.get("/api/v1/csi/csi_router/calibration")
        rejected = await client.post("/api/v1/csi/pir/calibration")
        invalid = await client.post("/api/v1/csi/csi_router/calibration", json={"duration_seconds": 1})
    assert started.status_code == 200
    assert started.json()["state"] == "esperando"
    assert status.json()["seconds_remaining"] > 0
    assert rejected.status_code == 422
    assert invalid.status_code == 422
