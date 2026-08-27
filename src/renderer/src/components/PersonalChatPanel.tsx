import { useEffect, useState } from 'react';
import { PixelPanel } from './PixelPanel';
import { PixelButton } from './PixelButton';
import { useStore } from '@/store/store';
type HiveMessage = Awaited<ReturnType<Window['cth']['hiveInbox']>>[number];

export function PersonalChatPanel() {
  const carla = useStore((s) => s.agents.find((a) => a.name === 'Carla'));
  const [messages, setMessages] = useState<HiveMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => { if (!carla) return; let alive = true; const load = async () => { try { const m = await window.cth.hiveInbox(carla.id); if (alive) setMessages(m.slice(-30)); } catch {} }; void load(); const t = setInterval(load, 2500); return () => { alive = false; clearInterval(t); }; }, [carla?.id]);
  const send = async () => { if (!carla || !draft.trim()) return; setStatus('sending…'); const result = await window.cth.hiveSend({ to: carla.id, act: 'inform', conversation: 'personal-time', subject: 'Personal time', body: `Liam is talking with you privately outside work. Reply warmly and personally, without turning this into a project task.\n\n${draft.trim()}` }, 'human'); setStatus(result.ok ? 'sent' : (result.error ?? 'could not send')); if (result.ok) setDraft(''); };
  return <PixelPanel variant="default" noPadding style={{ height: '100%', display: 'flex', flexDirection: 'column' }}><div style={{ padding: '12px 14px', borderBottom: '1px solid var(--cth-ink-700)', fontFamily: 'var(--cth-font-display)', fontSize: 11 }}>PERSONAL CHAT · CARLA</div><div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--cth-paper-200)' }}>{messages.length === 0 ? <div style={{ color: 'var(--cth-ink-600)', fontSize: 13 }}>You and Carla are off the clock. Start a private conversation.</div> : messages.map((m) => <div key={m.id} style={{ padding: 9, background: m.from === 'human' ? 'var(--cth-paper-100)' : '#f4e4ef', border: '1px solid var(--cth-ink-500)', fontSize: 13, lineHeight: '18px' }}><div style={{ fontFamily: 'var(--cth-font-display)', fontSize: 9, marginBottom: 4 }}>{m.from === 'human' ? 'LIAM' : 'CARLA'}</div>{m.body}</div>)}</div><div style={{ padding: 10, borderTop: '1px solid var(--cth-ink-700)' }}><textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} placeholder="Talk with Carla…" style={{ width: '100%', boxSizing: 'border-box', padding: 8, resize: 'vertical', fontFamily: 'var(--cth-font-ui)', fontSize: 14 }} /><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center', marginTop: 8 }}>{status && <span style={{ fontSize: 12 }}>{status}</span>}<PixelButton variant="primary" size="sm" onClick={() => { void send(); }} disabled={!draft.trim() || !carla}>send</PixelButton></div></div></PixelPanel>;
}
