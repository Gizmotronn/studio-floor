import { useEffect, useMemo, useState } from 'react';
import { PixelButton } from './PixelButton';
import { PixelPanel } from './PixelPanel';
import { useStore, type Agent } from '@/store/store';

const PROMPTS_KEY = 'studio.handoffPrompts.v1';

function promptKey(from: Agent, to: Agent): string {
  return `${from.id}→${to.id}`;
}

function loadPrompts(): Record<string, string> {
  try {
    const value = JSON.parse(localStorage.getItem(PROMPTS_KEY) ?? '{}');
    return value && typeof value === 'object' ? value as Record<string, string> : {};
  } catch { return {}; }
}

export function HandoffModal({ from, onClose }: { from: Agent; onClose: () => void }) {
  const agents = useStore((s) => s.agents);
  const targets = useMemo(() => agents.filter((a) => a.id !== from.id), [agents, from.id]);
  const [targetId, setTargetId] = useState(targets[0]?.id ?? '');
  const [prompts, setPrompts] = useState<Record<string, string>>(loadPrompts);
  const [status, setStatus] = useState<string | null>(null);
  const target = targets.find((a) => a.id === targetId);
  const key = target ? promptKey(from, target) : '';
  const prompt = key ? (prompts[key] ?? '') : '';

  useEffect(() => {
    if (!target && targets[0]) setTargetId(targets[0].id);
  }, [target, targets]);

  const setPrompt = (value: string) => {
    if (!key) return;
    setPrompts((current) => ({ ...current, [key]: value }));
  };

  const send = async () => {
    if (!target || !prompt.trim()) return;
    setStatus('sending…');
    try {
      const result = await window.cth.hiveSend({
        to: target.id,
        act: 'request',
        conversation: `handoff-${Date.now().toString(36)}`,
        subject: `Handoff from ${from.name}`,
        body: prompt.trim()
      }, from.id);
      if (!result.ok) throw new Error(result.error ?? 'Could not send handoff');
      localStorage.setItem(PROMPTS_KEY, JSON.stringify(prompts));
      setStatus(`sent to ${target.name}`);
      setTimeout(onClose, 700);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not send handoff');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(20, 24, 28, .42)' }}>
      <PixelPanel variant="default" noPadding style={{ width: 'min(620px, 100%)', maxHeight: '90vh', overflow: 'auto', background: 'var(--cth-paper-100)' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--cth-ink-700)', fontFamily: 'var(--cth-font-display)', fontSize: 11 }}>HAND OFF FROM {from.name.toUpperCase()}</div>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {targets.length === 0 ? <p>No other agents are available yet.</p> : <>
            <label style={{ fontSize: 12, color: 'var(--cth-ink-700)' }}>Send to
              <select value={targetId} onChange={(e) => setTargetId(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 4, padding: 7, fontSize: 14 }}>
                {targets.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.description}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, color: 'var(--cth-ink-700)' }}>Prompt for this pair
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={7} placeholder={`Tell ${target?.name ?? 'the agent'} what to pick up, the context to use, and the outcome you want…`} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, padding: 8, resize: 'vertical', fontFamily: 'var(--cth-font-ui)', fontSize: 14, lineHeight: '20px' }} />
            </label>
            <div style={{ fontSize: 11, color: 'var(--cth-ink-500)' }}>Each from/to pair has its own saved prompt template. Edit it whenever you like.</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
              {status && <span style={{ fontSize: 12, color: status.startsWith('sent') ? 'var(--cth-mint)' : 'var(--cth-coral)' }}>{status}</span>}
              <PixelButton variant="secondary" size="sm" onClick={onClose}>cancel</PixelButton>
              <PixelButton variant="primary" size="sm" onClick={() => { void send(); }} disabled={!prompt.trim() || !target || status === 'sending…'}>send handoff</PixelButton>
            </div>
          </>}
        </div>
      </PixelPanel>
    </div>
  );
}
