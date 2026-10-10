import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { SystemNodesConfig } from '../../types/config';
import { GlassCard } from '../common/GlassCard';
import { SectionHeader } from '../common/SectionHeader';
import { HeaderGeneratorModal } from './HeaderGeneratorModal';
import { Cpu, Wifi, Radio, Server, Save, FileCode, CheckCircle2, Sliders } from 'lucide-react';

export const Esp32ConfigPanel: React.FC = () => {
  const [config, setConfig] = useState<SystemNodesConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'pir' | 'csi_router' | 'csi_dedicated' | 'broker'>('csi_router');
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const data = await api.getNodesConfig();
        setConfig(data);
      } catch (err) {
        console.error('Error cargando configuración de nodos:', err);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    try {
      const res = await api.updateNodesConfig(config);
      setConfig(res.config);
      setSuccessMsg('¡Configuración guardada y comandos de calibración despachados!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert('Error guardando configuración: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const calculateMhz = (channel: number) => 2412 + (channel - 1) * 5;

  if (!config) {
    return (
      <GlassCard>
        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
          Cargando parámetros de nodos ESP32...
        </div>
      </GlassCard>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <SectionHeader
          title="Configuración de Radiofrecuencia y Nodos ESP32"
          subtitle="Sintonización de canales Wi-Fi 2.4 GHz, frecuencias portadoras, pines GPIO y generación de firmware"
          icon={<Sliders size={18} />}
        />

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--accent-blue)',
            background: 'rgba(2, 132, 199, 0.1)',
            color: 'var(--accent-blue)',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            transition: 'all 0.15s ease',
          }}
        >
          <FileCode size={16} />
          Generar Código C (<code>config.h</code>)
        </button>
      </div>

      {successMsg && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#065f46',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tabs Selector */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '0.5rem',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('csi_router')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid',
            borderColor: activeTab === 'csi_router' ? 'var(--accent-blue)' : 'var(--input-border)',
            background: activeTab === 'csi_router' ? 'rgba(2, 132, 199, 0.15)' : 'var(--input-bg)',
            color: activeTab === 'csi_router' ? 'var(--accent-blue)' : 'var(--text-secondary)',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <Wifi size={16} />
          Nodo #2 — CSI Router (STA)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('csi_dedicated')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid',
            borderColor: activeTab === 'csi_dedicated' ? 'var(--accent-blue)' : 'var(--input-border)',
            background: activeTab === 'csi_dedicated' ? 'rgba(2, 132, 199, 0.15)' : 'var(--input-bg)',
            color: activeTab === 'csi_dedicated' ? 'var(--accent-blue)' : 'var(--text-secondary)',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <Radio size={16} />
          Nodo #3/#4 — CSI Par Dedicado
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pir')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid',
            borderColor: activeTab === 'pir' ? 'var(--accent-blue)' : 'var(--input-border)',
            background: activeTab === 'pir' ? 'rgba(2, 132, 199, 0.15)' : 'var(--input-bg)',
            color: activeTab === 'pir' ? 'var(--accent-blue)' : 'var(--text-secondary)',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <Cpu size={16} />
          Nodo #1 — Sensor PIR
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('broker')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid',
            borderColor: activeTab === 'broker' ? 'var(--accent-blue)' : 'var(--input-border)',
            background: activeTab === 'broker' ? 'rgba(2, 132, 199, 0.15)' : 'var(--input-bg)',
            color: activeTab === 'broker' ? 'var(--accent-blue)' : 'var(--text-secondary)',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <Server size={16} />
          Parámetros Broker MQTT
        </button>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSave}>
        <GlassCard>
          {/* TAB 1: CSI Router */}
          {activeTab === 'csi_router' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Canal Wi-Fi (Banda 2.4 GHz)
                </label>
                <select
                  value={config.csi_router.wifi_channel}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      csi_router: {
                        ...config.csi_router,
                        wifi_channel: Number(e.target.value),
                        frequency_mhz: calculateMhz(Number(e.target.value)),
                      },
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--input-text)',
                    fontSize: '0.85rem',
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((ch) => (
                    <option key={ch} value={ch}>
                      Canal {ch} — {calculateMhz(ch)} MHz
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Frecuencia portadora central: {calculateMhz(config.csi_router.wifi_channel)} MHz
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  SSID del Router Objetivo
                </label>
                <input
                  type="text"
                  value={config.csi_router.target_ssid}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      csi_router: { ...config.csi_router, target_ssid: e.target.value },
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--input-text)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Tasa de Captura CSI (Hz)
                </label>
                <select
                  value={config.csi_router.sampling_rate_hz}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      csi_router: { ...config.csi_router, sampling_rate_hz: Number(e.target.value) },
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--input-text)',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value={10}>10 Hz (100 ms por paquete)</option>
                  <option value={20}>20 Hz (50 ms por paquete)</option>
                  <option value={50}>50 Hz (20 ms por paquete)</option>
                  <option value={100}>100 Hz (10 ms por paquete)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Tópico MQTT de Telemetría
                </label>
                <input
                  type="text"
                  value={config.csi_router.mqtt_topic}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      csi_router: { ...config.csi_router, mqtt_topic: e.target.value },
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--input-text)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>
            </div>
          )}

          {/* TAB 2: CSI Dedicated */}
          {activeTab === 'csi_dedicated' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Canal Wi-Fi Fijo (Enlace Punto a Punto)
                </label>
                <select
                  value={config.csi_dedicated.wifi_channel}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      csi_dedicated: {
                        ...config.csi_dedicated,
                        wifi_channel: Number(e.target.value),
                        frequency_mhz: calculateMhz(Number(e.target.value)),
                      },
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--input-text)',
                    fontSize: '0.85rem',
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((ch) => (
                    <option key={ch} value={ch}>
                      Canal {ch} — {calculateMhz(ch)} MHz
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Frecuencia: {calculateMhz(config.csi_dedicated.wifi_channel)} MHz
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Potencia de Transmisión TX (dBm)
                </label>
                <input
                  type="number"
                  min={8}
                  max={20}
                  value={config.csi_dedicated.tx_power_dbm}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      csi_dedicated: { ...config.csi_dedicated, tx_power_dbm: Number(e.target.value) },
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--input-text)',
                    fontSize: '0.85rem',
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Rango recomendado: 12 dBm a 18 dBm
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Tasa de Inyección de Tramas (Hz)
                </label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={config.csi_dedicated.packet_rate_hz}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      csi_dedicated: { ...config.csi_dedicated, packet_rate_hz: Number(e.target.value) },
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--input-text)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  BSSID Virtual del Enlace
                </label>
                <input
                  type="text"
                  value={config.csi_dedicated.custom_bssid}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      csi_dedicated: { ...config.csi_dedicated, custom_bssid: e.target.value },
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--input-text)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>
            </div>
          )}

          {/* TAB 3: PIR */}
          {activeTab === 'pir' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Pin GPIO de Entrada PIR
                </label>
                <select
                  value={config.pir.gpio_pin}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      pir: { ...config.pir, gpio_pin: Number(e.target.value) },
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--input-text)',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value={13}>GPIO 13 (Recomendado)</option>
                  <option value={27}>GPIO 27</option>
                  <option value={14}>GPIO 14</option>
                  <option value={4}>GPIO 4</option>
                  <option value={32}>GPIO 32</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Modo de Interrupción / Trigger
                </label>
                <select
                  value={config.pir.trigger_mode}
                  onChange={(e: any) =>
                    setConfig({
                      ...config,
                      pir: { ...config.pir, trigger_mode: e.target.value },
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--input-text)',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="RISING">RISING (Flanco de Subida 0 -&gt; 1)</option>
                  <option value="FALLING">FALLING (Flanco de Bajada)</option>
                  <option value="CHANGE">CHANGE (Cualquier Cambio)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Tiempo de Retención / Debounce (ms)
                </label>
                <input
                  type="number"
                  min={500}
                  max={10000}
                  step={250}
                  value={config.pir.debounce_ms}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      pir: { ...config.pir, debounce_ms: Number(e.target.value) },
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--input-text)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Intervalo de Sondeo (ms)
                </label>
                <input
                  type="number"
                  min={50}
                  max={2000}
                  value={config.pir.sample_interval_ms}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      pir: { ...config.pir, sample_interval_ms: Number(e.target.value) },
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--input-text)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>
            </div>
          )}

          {/* TAB 4: Broker */}
          {activeTab === 'broker' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Host / IP del Broker Mosquitto
                </label>
                <input
                  type="text"
                  value={config.broker_host}
                  onChange={(e) => setConfig({ ...config, broker_host: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--input-text)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Puerto del Broker MQTT
                </label>
                <input
                  type="number"
                  value={config.broker_port}
                  onChange={(e) => setConfig({ ...config, broker_port: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--input-text)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>
            </div>
          )}

          {/* Botón Guardar */}
          <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '0.65rem 1.25rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'var(--accent-blue)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
              }}
            >
              <Save size={16} />
              {saving ? 'Guardando...' : 'Aplicar Parámetros y Despachar a Nodos'}
            </button>
          </div>
        </GlassCard>
      </form>

      {/* Modal de Cabecera C/C++ */}
      <HeaderGeneratorModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialNodeId={activeTab === 'broker' ? 'pir' : activeTab}
      />
    </div>
  );
};
