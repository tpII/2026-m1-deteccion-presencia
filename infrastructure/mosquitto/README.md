# Configuración de Mosquitto Broker

Este directorio contiene la configuración para el broker MQTT Eclipse Mosquitto.

## Puertos Configurados

- `1883`: Puerto MQTT estándar (TCP) para conexión de los microcontroladores ESP32 y el backend de FastAPI.
- `9001`: Puerto WebSockets (opcional) para utilidades de inspección.

## Ejecución Local

Si se dispone de Mosquitto instalado nativamente en el sistema:

```bash
# macOS (Homebrew)
brew services start mosquitto

# Linux (Debian/Ubuntu)
sudo systemctl start mosquitto
```

O bien ejecutando con el archivo de configuración provisto:

```bash
mosquitto -c infrastructure/mosquitto/mosquitto.conf -v
```

## Ejecución con Docker

```bash
docker run -d --name mosquitto -p 1883:1883 -v $(pwd)/infrastructure/mosquitto/mosquitto.conf:/mosquitto/config/mosquitto.conf eclipse-mosquitto:2.0
```
