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
