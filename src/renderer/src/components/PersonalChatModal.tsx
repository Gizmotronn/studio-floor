import { useState } from 'react';
import { PixelButton } from './PixelButton';
import { PixelPanel } from './PixelPanel';
import { useStore } from '@/store/store';

export function PersonalChatModal({ onClose }: { onClose: () => void }) {
  const carla = useStore((s) => s.agents.find((a) => a.name === 'Carla'));
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const send = async () => {
    if (!carla || !draft.trim()) return;
    setStatus('sending…');
    const result = await window.cth.hiveSend({ to: carla.id, act: 'inform', conversation: `personal-${Date.now().toString(36)}`, subject: 'Personal time', body: `Liam has stepped away from work with you for some personal time. Keep this warm, candid, and separate from project work.\n\n${draft.trim()}` }, 'human');
    setStatus(result.ok ? 'sent to Carla' : (result.error ?? 'could not send'));
    if (result.ok) setDraft('');
  };
  return <div style={{ position: 'fixed', inset: 0, zIndex: 121, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(20,24,28,.48)' }}>
    <PixelPanel variant="default" noPadding style={{ width: 'min(600px, 100%)', background: 'var(--cth-paper-100)' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--cth-ink-700)', fontFamily: 'var(--cth-font-display)', fontSize: 11 }}>PERSONAL TIME · LIAM + CARLA</div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--cth-ink-700)' }}>You and Carla are off the clock in the bedroom. Messages sent here are personal and won’t be framed as work handoffs.</div>
        <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} placeholder="Talk with Carla…" style={{ width: '100%', boxSizing: 'border-box', padding: 9, resize: 'vertical', fontFamily: 'var(--cth-font-ui)', fontSize: 14 }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>{status && <span style={{ fontSize: 12, color: 'var(--cth-ink-700)' }}>{status}</span>}<PixelButton variant="secondary" size="sm" onClick={onClose}>close</PixelButton><PixelButton variant="primary" size="sm" onClick={() => { void send(); }} disabled={!draft.trim() || !carla}>send to Carla</PixelButton></div>
      </div>
    </PixelPanel>
  </div>;
}
