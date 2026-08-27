import { useEffect, useMemo, useState } from 'react';
import { PixelButton } from './PixelButton';
import { PixelPanel } from './PixelPanel';
import { useStore, type Agent } from '@/store/store';

const EXECUTIVE_NAMES = new Set(['Nick', 'Bjorn', 'Mike', 'Andrew', 'Rob']);
function isExecutive(a: Agent): boolean {
  return EXECUTIVE_NAMES.has(a.name) || /advisor|executive|ceo|research|scientist/i.test(a.description);
}

export function BoardMeetingModal({ onClose }: { onClose: () => void }) {
  const agents = useStore((s) => s.agents);
  const meeting = useStore((s) => s.boardMeeting);
  const start = useStore((s) => s.startBoardMeeting);
  const end = useStore((s) => s.endBoardMeeting);
  const participants = useMemo(() => agents.filter((a) => !a.isGod && !a.isAssistant && isExecutive(a)), [agents]);
  const [selected, setSelected] = useState<string[]>(meeting?.participantIds ?? participants.map((a) => a.id));
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  type MeetingMessage = Awaited<ReturnType<Window['cth']['hiveInbox']>>[number];
  const [messages, setMessages] = useState<MeetingMessage[]>([]);
  useEffect(() => {
    if (!meeting) return;
    let alive = true;
    const load = async () => {
      try {
        const all = await Promise.all(meeting.participantIds.map((id) => window.cth.hiveInbox(id)));
        const merged = all.flat().filter((m) => m.conversation === `board-meeting-${meeting.startedAt}`).sort((a, b) => a.created_at.localeCompare(b.created_at)).filter((m, i, list) => m.from !== 'human' || list.findIndex((x) => x.from === 'human' && x.body === m.body) === i);
        if (alive) setMessages(merged);
      } catch { /* keep last good transcript */ }
    };
    void load();
    const timer = setInterval(load, 2500);
    return () => { alive = false; clearInterval(timer); };
  }, [meeting?.startedAt, meeting?.participantIds.join(',')]);
  const toggle = (id: string) => setSelected((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const send = async () => {
    const body = draft.trim();
    if (!body || selected.length === 0) return;
    setStatus('sending…');
    const results = await Promise.all(selected.map((id) => window.cth.hiveSend({
      to: id, act: 'inform', conversation: `board-meeting-${meeting?.startedAt ?? Date.now()}`,
      subject: 'Board meeting', body: `You are in a live board meeting with Liam and the other attendees. Respond directly and concisely to the group.\n\n${body}`
    }, 'human')));
    const failed = results.filter((r) => !r.ok).length;
    setDraft('');
    setStatus(failed ? `${failed} message${failed === 1 ? '' : 's'} failed` : 'sent to everyone');
  };
  const begin = () => { if (selected.length) start(selected); };
  return <div style={{ position: 'fixed', inset: 0, zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(20,24,28,.48)' }}>
    <PixelPanel variant="default" noPadding style={{ width: 'min(720px, 100%)', maxHeight: '90vh', overflow: 'auto', background: 'var(--cth-paper-100)' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--cth-ink-700)', fontFamily: 'var(--cth-font-display)', fontSize: 11 }}>BOARD MEETING</div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--cth-ink-700)' }}>Bring the advisory group into the board room and keep the door closed while you talk.</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{participants.map((a) => <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 9px', border: '1px solid var(--cth-ink-500)', background: selected.includes(a.id) ? 'var(--cth-paper-200)' : 'transparent', cursor: 'pointer' }}><input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} />{a.name}</label>)}</div>
        {!meeting ? <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><PixelButton variant="secondary" size="sm" onClick={onClose}>cancel</PixelButton><PixelButton variant="primary" size="sm" onClick={begin} disabled={!selected.length}>start board meeting</PixelButton></div> : <>
          <div style={{ padding: 10, border: '1px solid var(--cth-mint)', background: 'rgba(100,180,140,.12)', fontSize: 12 }}>Meeting in progress · boardroom door locked · {selected.length} attending</div>
          <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 7, padding: 8, background: 'var(--cth-paper-200)', border: '1px solid var(--cth-ink-300)' }}>{messages.length === 0 ? <span style={{ fontSize: 12, color: 'var(--cth-ink-600)' }}>The board is taking their seats…</span> : messages.map((m, i) => <div key={`${m.id}-${i}`} style={{ padding: 8, background: m.from === 'human' ? 'var(--cth-paper-100)' : '#e9f0e8', border: '1px solid var(--cth-ink-300)', fontSize: 13, lineHeight: '18px' }}><div style={{ fontFamily: 'var(--cth-font-display)', fontSize: 9, marginBottom: 3 }}>{m.from === 'human' ? 'LIAM' : (participants.find((a) => a.id === m.from)?.name ?? m.from)}</div>{m.body}</div>)}</div>
          <label style={{ fontSize: 12, color: 'var(--cth-ink-700)' }}>Message everyone<textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} placeholder="Ask the board a question or share an idea…" style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, padding: 9, resize: 'vertical', fontFamily: 'var(--cth-font-ui)', fontSize: 14 }} /></label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>{status && <span style={{ fontSize: 12, color: 'var(--cth-ink-700)' }}>{status}</span>}<PixelButton variant="secondary" size="sm" onClick={onClose}>close</PixelButton><PixelButton variant="primary" size="sm" onClick={() => { void send(); }} disabled={!draft.trim()}>send to board</PixelButton><PixelButton variant="destructive" size="sm" onClick={() => { end(); onClose(); }}>end meeting</PixelButton></div>
        </>}
      </div>
    </PixelPanel>
  </div>;
}
