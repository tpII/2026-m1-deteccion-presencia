# Frontend — Dashboard de Detección de Presencia (PIR & CSI Wi-Fi)

Dashboard interactivo en tiempo real desarrollado con **React**, **TypeScript**, **Vite**, **React Router**, **Apache ECharts** y diseño con estética **Liquid Glass** de laboratorio.

## Características

- **Separación de Responsabilidades**: Los componentes visuales consumen hooks y servicios; no realizan `fetch` directo ni contienen URLs hardcodeadas.
- **Apache ECharts en Canvas**: Gráficos de alta frecuencia con mínimo overhead de memoria (cronograma binario para PIR y curvas de amplitud continuo + umbrales para CSI).
- **Pipeline Visual Interactivo**: Diagrama de bloques transparente animado con las 5 etapas del procesamiento: Señal Cruda → Filtro → Señal Filtrada → Descriptores (Varianza, Energía) → Decisión Final de Presencia.
- **Resiliencia WebSocket**: Reconexión automática exponencial e indicador de estado accesible de triple canal (texto + color + icono).
- **Páginas**:
  - `OverviewPage`: Resumen general con 3 cards de métodos y pipeline CSI en vivo.
  - `PirCasePage`: Señal digital 0/1, eventos de disparo y latencia física.
  - `CsiRouterCasePage`: Señales continuas sobre router Wi-Fi y pipeline.
  - `CsiDedicatedCasePage`: Par AP-STA dedicado con zona de Fresnel controlada.
  - `ComparisonPage`: Tabla comparativa académica y gráficos de barras.
  - `SystemPage`: Configuración de entorno, estado de servidores y formulario de auditoría de Ground Truth.

## Ejecución Local

```bash
cd frontend
npm install
npm run dev
```

La aplicación se abrirá en [http://localhost:5173](http://localhost:5173).

## Prueba mínima del PIR por USB

Abrí **Prueba PIR — USB** en el menú o [http://localhost:5173/test/pir-usb](http://localhost:5173/test/pir-usb).
La ruta usa un servicio (`services/pirSerial.ts`), un hook (`hooks/usePirSerial.ts`) y los componentes Glass existentes.
Lee directamente desde la computadora mediante [Web Serial nativo](https://developer.chrome.com/docs/capabilities/serial), sin nuevas dependencias.
La lectura en vivo no necesita backend ni broker y no se incorpora a las métricas ni a la telemetría MQTT.
El botón **Guardar lecturas en la base** permite guardar manualmente hasta los últimos 50 mensajes en SQLite.
Para guardar y consultar el historial, iniciá el backend con `./start.sh` desde la raíz del proyecto.
Los registros se almacenan en la tabla separada `pir_usb_readings`; al recargar se consulta nuevamente el historial guardado.
Guardá antes de salir o reconectar: el historial local está limitado a 50 mensajes y no se guarda automáticamente.
Los registros anteriores permanecen en la base aunque la página solo muestre los últimos 50.
Repetir el guardado de una misma lectura (hora de recepción y movimiento) no la duplica.
El encabezado general sigue mostrando el estado del backend; el panel de prueba tiene su propio indicador USB.

1. Conectá PIR **HW-416-B**: VCC → VIN/5V, GND → GND y OUT → **GPIO27** de la ESP32.
2. Conectá la ESP32 por USB a la misma computadora que abre la página.
3. Usá Chrome o Edge de escritorio en **localhost** o **HTTPS**. La página detecta si Web Serial está disponible.
4. Cerrá el monitor serial de Arduino u otra aplicación que esté usando el puerto.
5. El firmware existente debe usar `Serial.begin(115200)` y emitir `Serial.println("MOVIMIENTO")`
   o `Serial.println("SIN MOVIMIENTO")`. Cada mensaje debe terminar con `\n` (también se acepta `\r\n`).
6. Presioná **Conectar ESP32**, seleccioná el puerto y observá el estado y los últimos 50 mensajes válidos.
7. Presioná **Desconectar ESP32** para liberar el puerto. Al navegar a otra página también se cierra la conexión.

La interfaz espera un mensaje válido antes de mostrar el nivel lógico. Ignora mensajes de arranque y texto ajeno al protocolo.
No calcula latencia del sensor: las horas corresponden a la recepción en la computadora.
`SIN MOVIMIENTO` significa salida baja del PIR, no una garantía de ausencia de personas.
Si el firmware solo envía cambios, el estado inicial seguirá pendiente hasta el primer mensaje.
Al reconectar se limpia el historial local en vivo; el historial guardado en SQLite permanece.
Al desconectar, el último mensaje queda como historial y deja de mostrarse como estado activo.

Verificación automática sin hardware (Node 20+):

```bash
cd frontend
npm run test:pir
npm run build
```

Estas pruebas simulan el puerto con Streams nativos; la comprobación física requiere seleccionar la ESP32 en el navegador.
