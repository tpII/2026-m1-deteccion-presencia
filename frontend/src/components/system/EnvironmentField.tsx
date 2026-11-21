import { useState } from 'react';
import { GlassPanel } from '../ui/GlassPanel';
import { SectionHeader } from '../ui/SectionHeader';

const STORAGE_KEY = 'presence-trials.environment.v1';

type EnvironmentScope = 'pir' | 'csi_router' | 'combined';

export function useTrialEnvironment(scope: EnvironmentScope) {
  const storageKey = `${STORAGE_KEY}.${scope}`;
  const [environment, setEnvironment] = useState(() => {
    try {
      return localStorage.getItem(storageKey) ?? '';
    } catch {
      return '';
    }
  });

  function updateEnvironment(value: string) {
    setEnvironment(value);
    try {
      localStorage.setItem(storageKey, value);
    } catch {
      // El ensayo también se puede registrar sin almacenamiento local.
    }
  }

  return [environment, updateEnvironment] as const;
}

interface EnvironmentFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
}

export function EnvironmentField({ value, onChange, disabled, required = true }: EnvironmentFieldProps) {
  return (
    <label>
      Ambiente
      <input value={value} onChange={(event) => onChange(event.target.value)}
        placeholder="Ej. Casa A · living" maxLength={100} required={required} disabled={disabled} />
    </label>
  );
}

export function TrialEnvironmentPanel({ value, onChange }: EnvironmentFieldProps) {
  return (
    <GlassPanel>
      <SectionHeader title="Registrar presencia observada"
        subtitle="Ingresá el ambiente antes de marcar lo que observás en la telemetría en vivo." />
      <div className="trial-form trial-environment">
        <EnvironmentField value={value} onChange={onChange} />
      </div>
    </GlassPanel>
  );
}
