# Broker Mosquitto

El broker recibe mensajes MQTT de los ESP32.
FastAPI se suscribe por TCP; React recibe datos desde FastAPI por WebSocket.

## Ejecución nativa (macOS/Linux)

La guía principal está en [README.md](../../README.md). Después de instalar Mosquitto:

```bash
./start.sh
```

El script usa `mosquitto.local.conf`, con listener TCP 1883 en todas las interfaces,
conexiones anónimas de laboratorio y sin persistencia del broker. Si ya hay un broker,
lo reutiliza sin detenerlo al salir. Comprobá que acepte conexiones desde la LAN;
los servicios predeterminados pueden permitir únicamente localhost.

Para iniciar solo el broker desde la raíz:

```bash
mosquitto -c infrastructure/mosquitto/mosquitto.local.conf -v
```

Para observar el PIR:

```bash
mosquitto_sub -h localhost -p 1883 -t presence/pir/telemetry -v
```

La ESP32 usa la IP LAN de la computadora como dirección del broker.
No exponer este listener sin autenticación a Internet.

## Docker

`docker-compose.yml` usa `mosquitto.conf`: listener TCP 1883 y listener WebSocket 9001
opcional para otras herramientas. La persistencia del broker queda en su volumen Docker.
Para hardware: `docker compose up --build` desde la raíz.
Nuestra web utiliza `/ws/telemetry` de FastAPI, no el puerto 9001.
