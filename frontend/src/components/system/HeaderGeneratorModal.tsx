import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import { CHeaderResponse } from '../../types/config';
import { X, Copy, Check, Download, FileCode, Cpu } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialNodeId?: string;
}

export const HeaderGeneratorModal: React.FC<Props> = ({ isOpen, onClose, initialNodeId = 'pir' }) => {
  const [selectedNode, setSelectedNode] = useState<string>(initialNodeId);
  const [headerData, setHeaderData] = useState<CHeaderResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (initialNodeId) {
      setSelectedNode(initialNodeId);
    }
  }, [initialNodeId]);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadHeader() {
      setLoading(true);
      try {
        const res = await api.getNodeHeader(selectedNode);
        if (isMounted) {
          setHeaderData(res);
        }
      } catch (err: any) {
        console.error('Error cargando cabecera C:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadHeader();
    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedNode]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!headerData) return;
    navigator.clipboard.writeText(headerData.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    if (!headerData) return;
    const blob = new Blob([headerData.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = headerData.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return createPortal(
    <div
      className="header-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="header-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="header-modal-title"
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--glass-shadow)',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div
          style={{
            padding: '1.2rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <FileCode size={22} style={{ color: 'var(--accent-blue)' }} />
            <div>
              <h2 id="header-modal-title" style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Generador de Firmware C/C++ (<code>config.h</code>)
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                Código listo para compilar y flashear en PlatformIO o Arduino IDE
              </p>
            </div>
          </div>
          <button
            aria-label="Cerrar generador de cabecera"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Selector de Nodos */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
            padding: '1rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--header-bg)',
          }}
        >
          {[
            { id: 'pir', label: 'ESP32 #1 — PIR' },
            { id: 'csi_router', label: 'ESP32 #2 — CSI Router (STA)' },
            { id: 'csi_dedicated', label: 'ESP32 #3/#4 — CSI Dedicado' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedNode(tab.id)}
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid',
                borderColor: selectedNode === tab.id ? 'var(--accent-blue)' : 'var(--input-border)',
                background: selectedNode === tab.id ? 'rgba(2, 132, 199, 0.15)' : 'var(--input-bg)',
                color: selectedNode === tab.id ? 'var(--accent-blue)' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              }}
            >
              <Cpu size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Visor de Código */}
        <div className="header-modal-code" style={{ padding: '1.2rem 1.5rem', flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              Generando archivo de cabecera...
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: '0.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>Archivo: <code>{headerData?.filename}</code></span>
                <span>Lenguaje: C / C++ Header</span>
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: '1.2rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--code-bg, rgba(15, 23, 42, 0.85))',
                  color: 'var(--code-text, #e2e8f0)',
                  fontSize: '0.82rem',
                  lineHeight: '1.5',
                  fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  overflowX: 'auto',
                  border: '1px solid var(--border-color)',
                }}
              >
                <code>{headerData?.content}</code>
              </pre>
            </div>
          )}
        </div>

        {/* Footer con Acciones */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <button
            onClick={handleCopy}
            disabled={!headerData || loading}
            style={{
              padding: '0.55rem 1rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--input-border)',
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {copied ? <Check size={16} style={{ color: '#059669' }} /> : <Copy size={16} />}
            {copied ? '¡Copiado!' : 'Copiar Código'}
          </button>
          <button
            onClick={handleDownload}
            disabled={!headerData || loading}
            style={{
              padding: '0.55rem 1.15rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'var(--accent-blue)',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
            }}
          >
            <Download size={16} />
            Descargar {headerData?.filename || '.h'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
