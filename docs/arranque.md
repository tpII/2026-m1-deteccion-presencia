# Arrancar todo con un comando

Abrí una terminal en la raíz del repositorio y ejecutá el comando de tu sistema. No es necesario crear el entorno virtual, ejecutar pip o npm ni abrir tres terminales.

| Sistema | Comando |
| --- | --- |
| macOS o Linux | `./start.sh` |
| Windows | `.\start.bat` |

Si el archivo perdió el permiso de ejecución, en macOS/Linux también se puede usar `bash start.sh`. Los nombres son **start**, con la `t` final.

## Qué prepara automáticamente

1. Comprueba Python 3.12 o superior y Node 20.19 o superior con npm. Si faltan, intenta instalarlos.
2. Comprueba que los puertos 8000 y 5173 estén libres. No cierra otra instancia para apropiarse de esos puertos.
3. Crea `.env` desde `.env.example` si no existe. Conserva una configuración existente.
4. Crea `backend/.venv` e instala `backend/requirements.txt` con pip. Si encuentra un entorno incompatible, lo conserva como `.venv.backup-...` y crea otro.
5. Instala el frontend con `npm ci`, usando `frontend/package-lock.json`. No reescribe el lockfile.
6. Lee la configuración MQTT real del backend. Reutiliza un broker que responda; si el broker es local y falta, instala Mosquitto e intenta iniciarlo.
7. Inicia FastAPI y espera que se conecte a MQTT. Inicia Vite y espera una respuesta HTTP de la web.
8. Abre `http://localhost:5173` en el navegador disponible y deja los servicios en ejecución. Si el navegador no se abre, la dirección impresa permite abrirlo manualmente.

`Ctrl+C` detiene los procesos que inició el comando. Un broker que ya estaba activo permanece en ejecución. Las dependencias instaladas y los datos SQLite se conservan.

## Primera ejecución y siguientes

La primera ejecución necesita Internet para descargar herramientas y bibliotecas. El gestor del sistema puede pedir contraseña de administrador o una confirmación de Windows. Estas solicitudes corresponden a la instalación y no requieren introducir otro comando de arranque.

Las siguientes ejecuciones comparan las firmas de los archivos de dependencias y verifican componentes esenciales. Si no cambiaron y siguen disponibles, reutilizan las instalaciones. Si cambian los requisitos o faltan componentes comprobados, vuelven a instalar lo necesario. No se promete reparar automáticamente cualquier archivo borrado o corrupto dentro de una dependencia.

Las firmas se guardan dentro de `.venv` y `node_modules`; también se considera la plataforma, arquitectura y versión mayor de Node. Para forzar una reinstalación de bibliotecas, se puede borrar solo el archivo de firma correspondiente y repetir el mismo comando.

## Alcance por sistema

**macOS.** Usa Homebrew para Python, Node 24 y Mosquitto. Si falta Homebrew, descarga su instalador oficial y lo ejecuta. Homebrew puede solicitar permisos y herramientas de desarrollo de Apple. Si el sistema exige completar una instalación o reiniciar, resolvé esa solicitud y repetí `./start.sh`.

**Linux con apt.** Instala las herramientas faltantes mediante apt. La instalación automática requiere una distribución que ofrezca Python 3.12+, por ejemplo Ubuntu 24.04+ o Debian 13+. Si falta Node compatible, descarga Node 24 desde nodejs.org, comprueba el SHA256 publicado y lo guarda localmente en `.tools/node`. Instala Mosquitto con apt cuando hace falta un broker local. Puede necesitar sudo. En otras distribuciones, si las herramientas ya están disponibles, el arranque puede reutilizarlas; la instalación de herramientas faltantes requiere el gestor propio del sistema.

**Windows.** Usa WinGet para instalar Python 3.12, Node LTS y Mosquitto si faltan. Actualiza el PATH del proceso para intentar utilizarlos en esa ejecución. Si falta WinGet, el script explica cómo instalar App Installer de Microsoft; luego se repite `.\start.bat`. No modifica permanentemente la política de ejecución de PowerShell. Un instalador puede pedir elevación o reinicio.

## Configuración del broker y red

La configuración predeterminada usa `MQTT_HOST=localhost`, `MQTT_PORT=1883`. Si un broker local no responde, el script inicia Mosquitto con la configuración del proyecto. Para otro puerto local válido, genera una configuración en `.runtime/`. Si se configuró un broker remoto, ese servidor debe estar disponible: el script no instala programas en otra computadora.

Si el gestor de paquetes inicia un servicio Mosquitto, se lo reutiliza. Un broker que responda en la computadora puede escuchar solo en localhost o tener otra política de acceso. Para las placas, verificá que acepte conexiones desde la LAN y que el firewall permita el puerto MQTT en la red del ensayo. El arranque no detiene servicios ajenos ni cambia sus permisos silenciosamente.

Los scripts escuchan frontend y backend en `127.0.0.1`. El navegador de la misma computadora funciona directamente; abrir la web desde otro dispositivo requiere configurar escucha, direcciones del frontend, CORS y firewall. La adquisición por MQTT desde el ESP32 sí utiliza la IP LAN del broker.

## Qué sigue siendo una preparación física

El comando prepara el servidor y la web. No detecta contraseñas Wi-Fi, conecta cables, programa automáticamente una placa ni fabrica muestras. Configurá y cargá `firmware/pir/` y `firmware/csi_router/` con PlatformIO. Después, encendé las placas y calibrá CSI desde la web. El Caso 3 utiliza esas dos fuentes; no requiere un tercer firmware.

PlatformIO y las bibliotecas del análisis fuera de línea no son dependencias necesarias para ejecutar la web. Su preparación está en [pruebas.md](pruebas.md) y en la [captura CSI](../prueba_CSI/README.md).

## Si se interrumpe

| Situación | Qué hacer |
| --- | --- |
| Descarga fallida o sin Internet en la primera ejecución | Restablecer la conexión y repetir el mismo comando |
| Contraseña o elevación rechazada | Completar la autorización del sistema y repetir |
| Puerto 8000 o 5173 ocupado | Cerrar la instancia anterior; no lanzar otra encima |
| Broker remoto no responde | Revisar `.env`, red y servidor remoto |
| Web abierta pero sin lecturas | Comprobar placas, IP del broker, firewall, tópicos y `total_samples` |
| Paquete del sistema no disponible | Instalar una versión compatible con el gestor del sistema y repetir |

Para pruebas automatizadas sin abrir el navegador, usar `PRESENCE_OPEN_BROWSER=0 ./start.sh`; en PowerShell, definir `$env:PRESENCE_OPEN_BROWSER='0'` antes de `.\start.bat`.

## Fuentes de instalación

- Homebrew y su instalador oficial: https://docs.brew.sh/Installation
- Node oficial para Linux: https://nodejs.org/dist/latest-v24.x/
- WinGet y opciones de instalación: https://learn.microsoft.com/en-us/windows/package-manager/winget/install

Las instalaciones dependen de la disponibilidad y los permisos de esos gestores; no equivalen a una validación física del experimento.
