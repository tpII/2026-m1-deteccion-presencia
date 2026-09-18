# AGENTS.md

# Presence Detection Project

This repository contains a university engineering project for human presence detection using:

1. PIR sensor detection.
2. Wi-Fi CSI detection using a commercial router.
3. Wi-Fi CSI detection using a dedicated ESP32-to-ESP32 network.

The project includes:

- ESP32 telemetry acquisition.
- MQTT communication.
- CSI signal processing.
- Presence detection.
- Experimental metrics.
- FastAPI backend.
- WebSocket real-time communication.
- React dashboard.
- Experimental comparison between detection methods.

The codebase must remain simple enough that any member of the university group can understand, explain, modify and debug it.

Correctness, readability and maintainability are more important than clever or highly abstract code.

---

# 1. Core Engineering Principles

Always prioritize:

1. Correctness.
2. Readability.
3. Simplicity.
4. Modularity.
5. Maintainability.
6. Testability.
7. Reuse.
8. Performance.
9. Abstraction.

When choosing between:

- a shorter but harder-to-understand implementation;
- a slightly longer but clearer implementation;

prefer the clearer implementation.

Code should be understandable by someone who did not originally write it.

Avoid unnecessary complexity.

---

# 2. Technology Stack

Unless there is a strong architectural reason to change it, preserve the following stack.

## Frontend

- React
- TypeScript
- Vite
- React Router
- Apache ECharts
- WebSocket
- CSS / Tailwind according to the existing implementation

## Backend

- Python 3.12+
- FastAPI
- Pydantic
- Uvicorn

## Telemetry

- MQTT
- Eclipse Mosquitto
- Python MQTT client

## Persistence

Initial implementation:

- SQLite

Possible future implementation:

- InfluxDB

Do not introduce InfluxDB unless the amount or nature of time-series data justifies it.

---

# 3. System Architecture

The expected high-level architecture is:

```text
ESP32
  ↓
MQTT
  ↓
Mosquitto
  ↓
FastAPI Backend
  ↓
Validation
  ↓
Signal Processing
  ↓
Presence Detection
  ↓
Metrics
  ↓
Persistence
  ↓
REST / WebSocket
  ↓
React Dashboard
```
