import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

interface Obligation {
  id: string;
  time: string;
  description: string;
  done?: boolean;
}

interface ClientCalendar {
  [dayKey: string]: Obligation[];
}

interface Client {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  notes: string;
  calendar: ClientCalendar;
}

interface GeneralNote {
  id: string;
  text: string;
  done: boolean;
}

interface AggregatedObligation {
  date: string;
  clientId: string;
  clientName: string;
  oblId: string;
  time: string;
  description: string;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function makeDayKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export default function CRM() {
  const navigate = useNavigate();
  const today = new Date();
  const todayKey = makeDayKey(today.getFullYear(), today.getMonth(), today.getDate());

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'clientes' | 'geral'>('clientes');
  const [clients, setClients] = useState<Client[]>([]);
  const [generalNotes, setGeneralNotes] = useState('');
  const [generalNotesList, setGeneralNotesList] = useState<GeneralNote[]>([]);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [fullscreenNoteId, setFullscreenNoteId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [editName, setEditName] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());

  const clientTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [clientsSnap, notesSnap] = await Promise.all([
          getDocs(collection(db, 'crm_clients')),
          getDoc(doc(db, 'crm_settings', 'general')),
        ]);
        const loaded: Client[] = [];
        clientsSnap.forEach(d => loaded.push(d.data() as Client));
        setClients(loaded);
        if (notesSnap.exists()) {
          setGeneralNotes(notesSnap.data().notes || '');
          setGeneralNotesList(notesSnap.data().notesList || []);
        }
      } catch (err) {
        console.error('CRM load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const scheduleClientSave = (client: Client) => {
    if (clientTimers.current[client.id]) clearTimeout(clientTimers.current[client.id]);
    clientTimers.current[client.id] = setTimeout(() => {
      setDoc(doc(db, 'crm_clients', client.id), client).catch(console.error);
    }, 700);
  };

  const saveGeneralSettings = (notes: string, notesList: GeneralNote[]) => {
    setDoc(doc(db, 'crm_settings', 'general'), { notes, notesList }).catch(console.error);
  };

  const handleGeneralNotesChange = (value: string) => {
    setGeneralNotes(value);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      saveGeneralSettings(value, generalNotesList);
    }, 1000);
  };

  const saveNote = () => {
    if (!generalNotes.trim()) return;
    const newNote: GeneralNote = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text: generalNotes.trim(), done: false };
    const updated = [...generalNotesList, newNote];
    setGeneralNotesList(updated);
    setGeneralNotes('');
    saveGeneralSettings('', updated);
  };

  const openNote = (note: GeneralNote) => {
    setExpandedNoteId(note.id);
    setEditingNoteText(note.text);
  };

  const openFullscreen = (note: GeneralNote) => {
    setFullscreenNoteId(note.id);
    setEditingNoteText(note.text);
    setExpandedNoteId(null);
  };

  const closeFullscreen = () => setFullscreenNoteId(null);

  const saveFullscreenNote = () => {
    if (!fullscreenNoteId || !editingNoteText.trim()) return;
    const updated = generalNotesList.map(n => n.id === fullscreenNoteId ? { ...n, text: editingNoteText.trim() } : n);
    setGeneralNotesList(updated);
    saveGeneralSettings(generalNotes, updated);
    setFullscreenNoteId(null);
  };

  const saveEditedNote = (id: string) => {
    if (!editingNoteText.trim()) return;
    const updated = generalNotesList.map(n => n.id === id ? { ...n, text: editingNoteText.trim() } : n);
    setGeneralNotesList(updated);
    setExpandedNoteId(null);
    saveGeneralSettings(generalNotes, updated);
  };

  const toggleGeneralNote = (id: string) => {
    const updated = generalNotesList.map(n => n.id === id ? { ...n, done: !n.done } : n);
    setGeneralNotesList(updated);
    saveGeneralSettings(generalNotes, updated);
  };

  const deleteGeneralNote = (id: string) => {
    if (!window.confirm('Apagar esta nota? Esta ação não pode ser desfeita.')) return;
    const updated = generalNotesList.filter(n => n.id !== id);
    setGeneralNotesList(updated);
    saveGeneralSettings(generalNotes, updated);
  };

  const selectedClient = clients.find(c => c.id === selectedClientId) ?? null;

  const addClient = () => {
    if (!newName.trim()) return;
    const client: Client = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: newName.trim(),
      company: newCompany.trim(),
      phone: newPhone.trim(),
      email: newEmail.trim(),
      notes: '',
      calendar: {},
    };
    setClients(prev => [...prev, client]);
    setDoc(doc(db, 'crm_clients', client.id), client).catch(console.error);
    setNewName(''); setNewCompany(''); setNewPhone(''); setNewEmail('');
    setShowAddForm(false);
  };

  const deleteClient = (id: string) => {
    if (!window.confirm('Apagar este cliente e todos os seus dados?')) return;
    setClients(prev => prev.filter(c => c.id !== id));
    deleteDoc(doc(db, 'crm_clients', id)).catch(console.error);
    if (selectedClientId === id) setSelectedClientId(null);
  };

  const startEditing = (client: Client) => {
    setEditingClientId(client.id);
    setEditName(client.name);
    setEditCompany(client.company);
    setEditPhone(client.phone);
    setEditEmail(client.email);
  };

  const saveEdit = () => {
    if (!editingClientId || !editName.trim()) return;
    setClients(prev => prev.map(c => {
      if (c.id !== editingClientId) return c;
      const updated = { ...c, name: editName.trim(), company: editCompany.trim(), phone: editPhone.trim(), email: editEmail.trim() };
      setDoc(doc(db, 'crm_clients', updated.id), updated).catch(console.error);
      return updated;
    }));
    setEditingClientId(null);
  };

  const updateClientNotes = (notes: string) => {
    if (!selectedClientId) return;
    setClients(prev => prev.map(c => {
      if (c.id !== selectedClientId) return c;
      const updated = { ...c, notes };
      scheduleClientSave(updated);
      return updated;
    }));
  };

  const addObligation = (day: number) => {
    if (!selectedClientId) return;
    const key = makeDayKey(calYear, calMonth, day);
    setClients(prev => prev.map(c => {
      if (c.id !== selectedClientId) return c;
      const updated = { ...c, calendar: { ...c.calendar, [key]: [...(c.calendar[key] || []), { id: `${Date.now()}-${Math.random()}`, time: '09:00', description: '' }] } };
      scheduleClientSave(updated);
      return updated;
    }));
  };

  const updateObligation = (day: number, oblId: string, field: 'time' | 'description', value: string) => {
    if (!selectedClientId) return;
    const key = makeDayKey(calYear, calMonth, day);
    setClients(prev => prev.map(c => {
      if (c.id !== selectedClientId) return c;
      const updated = { ...c, calendar: { ...c.calendar, [key]: (c.calendar[key] || []).map(o => o.id === oblId ? { ...o, [field]: value } : o) } };
      scheduleClientSave(updated);
      return updated;
    }));
  };

  const toggleObligation = (day: number, oblId: string) => {
    if (!selectedClientId) return;
    const key = makeDayKey(calYear, calMonth, day);
    setClients(prev => prev.map(c => {
      if (c.id !== selectedClientId) return c;
      const updated = { ...c, calendar: { ...c.calendar, [key]: (c.calendar[key] || []).map(o => o.id === oblId ? { ...o, done: !o.done } : o) } };
      setDoc(doc(db, 'crm_clients', updated.id), updated).catch(console.error);
      return updated;
    }));
  };

  const removeObligation = (day: number, oblId: string) => {
    if (!selectedClientId) return;
    const key = makeDayKey(calYear, calMonth, day);
    setClients(prev => prev.map(c => {
      if (c.id !== selectedClientId) return c;
      const updated = { ...c, calendar: { ...c.calendar, [key]: (c.calendar[key] || []).filter(o => o.id !== oblId) } };
      setDoc(doc(db, 'crm_clients', updated.id), updated).catch(console.error);
      return updated;
    }));
  };

  const getDayObligations = (day: number): Obligation[] => {
    if (!selectedClient) return [];
    return selectedClient.calendar[makeDayKey(calYear, calMonth, day)] || [];
  };

  // Calendar grid
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  // Aggregate all obligations
  const allObligations: AggregatedObligation[] = [];
  clients.forEach(client => {
    Object.entries(client.calendar).forEach(([key, obs]) => {
      obs.filter(ob => !ob.done).forEach(ob => {
        allObligations.push({ date: key, clientId: client.id, clientName: client.name, oblId: ob.id, time: ob.time, description: ob.description });
      });
    });
  });
  allObligations.sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    return dc !== 0 ? dc : a.time.localeCompare(b.time);
  });

  const headerBg: React.CSSProperties = {
    background: '#050505', color: 'white', padding: '1.25rem 2rem',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: '1rem',
  };

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '0.4rem 1.1rem', background: active ? '#FF2A2A' : 'transparent',
    color: 'white', border: '2px solid white', fontWeight: 900,
    cursor: active ? 'default' : 'pointer', fontSize: '0.85rem',
    textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'inherit',
  });

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
        <p style={{ fontWeight: 700, color: '#555' }}>A carregar CRM...</p>
      </main>
    );
  }

  // ── MAPA GERAL ──
  if (tab === 'geral') {
    const fullscreenNote = fullscreenNoteId ? generalNotesList.find(n => n.id === fullscreenNoteId) : null;

    return (
      <main style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: 'inherit' }}>
        {/* Fullscreen overlay */}
        {fullscreenNote && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#050505', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '2px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'white', fontWeight: 900, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nota — Modo Fullscreen</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={saveFullscreenNote}
                  disabled={!editingNoteText.trim()}
                  style={{ padding: '0.4rem 1.2rem', background: '#FF2A2A', color: 'white', border: '2px solid white', fontWeight: 900, cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit' }}
                >Guardar</button>
                <button
                  onClick={closeFullscreen}
                  style={{ padding: '0.4rem 1.2rem', background: 'transparent', color: 'white', border: '2px solid white', fontWeight: 900, cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit' }}
                >✕ Fechar</button>
              </div>
            </div>
            <textarea
              value={editingNoteText}
              onChange={e => setEditingNoteText(e.target.value)}
              autoFocus
              style={{ flex: 1, padding: '2rem', background: '#111', color: '#F0F0F0', border: 'none', outline: 'none', fontSize: '1rem', fontFamily: 'inherit', resize: 'none', lineHeight: 1.7 }}
            />
          </div>
        )}
        <div style={headerBg}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => navigate(-1)}
              style={{ background: 'none', border: '2px solid white', color: 'white', padding: '0.3rem 0.8rem', cursor: 'pointer', fontWeight: 900, fontSize: '0.85rem', fontFamily: 'inherit' }}
            >← Voltar</button>
            <h1 style={{ fontWeight: 900, fontSize: '1.4rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CRM</h1>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button style={tabBtn(false)} onClick={() => setTab('clientes')}>Clientes</button>
            <button style={tabBtn(true)}>Mapa Geral</button>
          </div>
        </div>

        <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ marginBottom: '2rem' }}>
            <p style={{ fontWeight: 900, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem', color: '#777' }}>Notas Gerais</p>
            <textarea
              value={generalNotes}
              onChange={e => handleGeneralNotesChange(e.target.value)}
              placeholder="Escreve uma nota e clica em Guardar..."
              style={{ width: '100%', minHeight: '100px', padding: '0.75rem', border: '2px solid #050505', fontFamily: 'inherit', fontSize: '0.9rem', resize: 'vertical', outline: 'none', background: 'white', boxSizing: 'border-box', display: 'block' }}
            />
            <button
              onClick={saveNote}
              disabled={!generalNotes.trim()}
              style={{ marginTop: '0.5rem', padding: '0.45rem 1.4rem', background: generalNotes.trim() ? '#050505' : '#CCC', color: 'white', border: '2px solid #050505', fontWeight: 900, cursor: generalNotes.trim() ? 'pointer' : 'default', fontSize: '0.85rem', fontFamily: 'inherit' }}
            >Guardar nota</button>

            {generalNotesList.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <p style={{ fontWeight: 900, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem', color: '#777' }}>Notas Guardadas ({generalNotesList.length})</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {generalNotesList.map(note => {
                    const isExpanded = expandedNoteId === note.id;
                    const preview = note.text.split('\n')[0].slice(0, 80) + (note.text.length > 80 || note.text.includes('\n') ? '…' : '');
                    return (
                      <div key={note.id} style={{ background: 'white', border: `2px solid ${note.done ? '#DDD' : '#050505'}`, opacity: note.done ? 0.5 : 1 }}>
                        {/* Collapsed row */}
                        {!isExpanded ? (
                          <div style={{ padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <input
                              type="checkbox"
                              checked={note.done}
                              onChange={() => toggleGeneralNote(note.id)}
                              style={{ cursor: 'pointer', accentColor: '#050505', flexShrink: 0, width: '1rem', height: '1rem' }}
                            />
                            <p
                              onClick={() => !note.done && openNote(note)}
                              style={{ flex: 1, margin: 0, fontSize: '0.88rem', color: '#333', textDecoration: note.done ? 'line-through' : 'none', cursor: note.done ? 'default' : 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                              title={note.done ? undefined : 'Clica para editar'}
                            >{preview}</p>
                            {!note.done && (
                              <button
                                onClick={() => openFullscreen(note)}
                                title="Abrir em fullscreen"
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.2rem 0.4rem', color: '#888', fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}
                              >⛶</button>
                            )}
                            <button
                              onClick={() => deleteGeneralNote(note.id)}
                              style={{ background: 'transparent', border: '2px solid #050505', padding: '0.3rem 0.75rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem', fontFamily: 'inherit', flexShrink: 0 }}
                            >Apagar</button>
                          </div>
                        ) : (
                          /* Expanded / edit mode */
                          <div style={{ padding: '0.75rem 1rem' }}>
                            <textarea
                              value={editingNoteText}
                              onChange={e => setEditingNoteText(e.target.value)}
                              autoFocus
                              rows={4}
                              style={{ width: '100%', padding: '0.5rem', border: '2px solid #050505', fontFamily: 'inherit', fontSize: '0.88rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box', display: 'block', marginBottom: '0.5rem' }}
                            />
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                onClick={() => saveEditedNote(note.id)}
                                disabled={!editingNoteText.trim()}
                                style={{ padding: '0.35rem 1.1rem', background: '#050505', color: 'white', border: '2px solid #050505', fontWeight: 900, cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit' }}
                              >Guardar</button>
                              <button
                                onClick={() => setExpandedNoteId(null)}
                                style={{ padding: '0.35rem 1.1rem', background: 'white', color: '#050505', border: '2px solid #050505', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit' }}
                              >Cancelar</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {clients.some(c => c.notes.trim()) && (
            <div style={{ marginBottom: '2rem' }}>
              <p style={{ fontWeight: 900, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem', color: '#777' }}>Notas por Cliente</p>
              {clients.filter(c => c.notes.trim()).map(c => (
                <div key={c.id} style={{ background: 'white', border: '2px solid #050505', padding: '0.75rem 1rem', marginBottom: '0.5rem' }}>
                  <p style={{ fontWeight: 900, fontSize: '0.8rem', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                    {c.name}{c.company ? ` — ${c.company}` : ''}
                  </p>
                  <p style={{ fontSize: '0.85rem', color: '#444', margin: 0, whiteSpace: 'pre-wrap' }}>{c.notes}</p>
                </div>
              ))}
            </div>
          )}

          <div>
            <p style={{ fontWeight: 900, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem', color: '#777' }}>
              Todas as Obrigações ({allObligations.length})
            </p>
            {allObligations.length === 0 ? (
              <p style={{ color: '#AAA', fontSize: '0.9rem' }}>Nenhuma obrigação registada.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {allObligations.map((ob, i) => {
                  const isPast = ob.date < todayKey;
                  const [y, m] = ob.date.split('-').map(Number);
                  return (
                    <div
                      key={`${ob.oblId}-${i}`}
                      onClick={() => { setCalMonth(m - 1); setCalYear(y); setSelectedClientId(ob.clientId); setTab('clientes'); }}
                      title={`Ver calendário de ${ob.clientName}`}
                      style={{
                        background: 'white', border: `2px solid ${isPast ? '#DDD' : '#050505'}`,
                        padding: '0.6rem 1rem', display: 'flex', gap: '1rem',
                        alignItems: 'flex-start', opacity: isPast ? 0.5 : 1,
                        cursor: 'pointer',
                      }}>
                      <div style={{ minWidth: '140px' }}>
                        <p style={{ fontWeight: 900, fontSize: '0.8rem', margin: 0, color: '#FF2A2A' }}>{ob.time}</p>
                        <p style={{ fontSize: '0.72rem', margin: 0, color: '#666' }}>{formatDayKey(ob.date)}</p>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>{ob.description || '(sem descrição)'}</p>
                      </div>
                      <div style={{ minWidth: '90px', textAlign: 'right' }}>
                        <p style={{ fontSize: '0.72rem', color: '#888', margin: 0, textTransform: 'uppercase', fontWeight: 700 }}>{ob.clientName}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  // ── CLIENT DETAIL ──
  if (selectedClient) {
    const isEditing = editingClientId === selectedClient.id;

    const editFields: { label: string; value: string; set: React.Dispatch<React.SetStateAction<string>> }[] = [
      { label: 'Nome *', value: editName, set: setEditName },
      { label: 'Empresa', value: editCompany, set: setEditCompany },
      { label: 'Telefone', value: editPhone, set: setEditPhone },
      { label: 'Email', value: editEmail, set: setEditEmail },
    ];

    return (
      <main style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: 'inherit' }}>
        <div style={headerBg}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => { setSelectedClientId(null); setEditingClientId(null); }}
              style={{ background: 'none', border: '2px solid white', color: 'white', padding: '0.3rem 0.8rem', cursor: 'pointer', fontWeight: 900, fontSize: '0.85rem', fontFamily: 'inherit' }}
            >← Voltar</button>
            <h1 style={{ fontWeight: 900, fontSize: '1.4rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {selectedClient.name}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button style={tabBtn(true)}>Clientes</button>
            <button style={tabBtn(false)} onClick={() => { setTab('geral'); setSelectedClientId(null); setEditingClientId(null); }}>Mapa Geral</button>
          </div>
        </div>

        {/* Info bar — view or edit mode */}
        {isEditing ? (
          <div style={{ background: '#FFFBEA', borderBottom: '2px solid #050505', padding: '1rem 2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem 1rem', marginBottom: '0.75rem', maxWidth: '1000px' }}>
              {editFields.map(f => (
                <div key={f.label}>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.2rem', color: '#666' }}>{f.label}</label>
                  <input
                    type="text"
                    value={f.value}
                    onChange={e => f.set(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveEdit()}
                    style={{ width: '100%', padding: '0.4rem 0.5rem', border: '2px solid #050505', fontFamily: 'inherit', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={saveEdit} style={{ padding: '0.4rem 1.2rem', background: '#FF2A2A', color: 'white', border: '2px solid #050505', fontWeight: 900, cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit' }}>Guardar</button>
              <button onClick={() => setEditingClientId(null)} style={{ padding: '0.4rem 1.2rem', background: 'white', color: '#050505', border: '2px solid #050505', fontWeight: 900, cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit' }}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div style={{ background: '#F0F0F0', borderBottom: '2px solid #050505', padding: '0.9rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
              {selectedClient.company && <span style={{ fontSize: '0.82rem', color: '#555', fontWeight: 700 }}>{selectedClient.company}</span>}
              {selectedClient.phone && <span style={{ fontSize: '0.78rem', color: '#666' }}>📞 {selectedClient.phone}</span>}
              {selectedClient.email && <span style={{ fontSize: '0.78rem', color: '#666' }}>✉️ {selectedClient.email}</span>}
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              <button
                onClick={() => startEditing(selectedClient)}
                style={{ padding: '0.35rem 0.9rem', background: 'white', color: '#050505', border: '2px solid #050505', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit' }}
              >Editar dados</button>
              <select
                value={calMonth}
                onChange={e => setCalMonth(Number(e.target.value))}
                style={{ padding: '0.45rem 0.7rem', fontWeight: 700, border: '2px solid #050505', background: 'white', cursor: 'pointer', fontSize: '0.88rem', fontFamily: 'inherit' }}
              >
                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <input
                type="number"
                value={calYear}
                onChange={e => setCalYear(Number(e.target.value))}
                style={{ width: '84px', padding: '0.45rem', fontWeight: 700, border: '2px solid #050505', background: 'white', fontSize: '0.88rem', textAlign: 'center', fontFamily: 'inherit', outline: 'none' }}
                min={2020} max={2035}
              />
            </div>
          </div>
        )}

        {/* Client notes */}
        <div style={{ padding: '0.75rem 2rem 0', maxWidth: '1400px', margin: '0 auto' }}>
          <textarea
            value={selectedClient.notes}
            onChange={e => updateClientNotes(e.target.value)}
            placeholder={`Notas sobre ${selectedClient.name}...`}
            rows={2}
            style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', border: '2px solid #D0D0D0', fontFamily: 'inherit', resize: 'vertical', outline: 'none', background: 'white', boxSizing: 'border-box' }}
          />
        </div>

        {/* Month label + calendar (hidden while editing) */}
        {!isEditing && (
          <>
            <div style={{ padding: '0.4rem 2rem 0', maxWidth: '1400px', margin: '0 auto' }}>
              <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#555' }}>{MONTHS[calMonth]} {calYear}</p>
            </div>

            <div style={{ padding: '0 2rem 2rem', maxWidth: '1400px', margin: '0 auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', marginBottom: '3px' }}>
                {WEEKDAYS.map(d => (
                  <div key={d} style={{ background: '#050505', color: 'white', textAlign: 'center', padding: '0.5rem', fontWeight: 900, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{d}</div>
                ))}
              </div>
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', marginBottom: '3px' }}>
                  {week.map((day, di) => {
                    if (!day) return <div key={di} style={{ background: '#E8E8E8', minHeight: '140px' }} />;
                    const obs = getDayObligations(day);
                    const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                    return (
                      <div key={di} style={{ border: isToday ? '3px solid #FF2A2A' : '2px solid #050505', minHeight: '140px', padding: '0.4rem', background: 'white', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontWeight: 900, fontSize: '0.85rem', marginBottom: '0.3rem', color: isToday ? '#FF2A2A' : '#050505' }}>{day}</div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {obs.map(ob => (
                            <div key={ob.id} style={{ background: ob.done ? '#F8F8F8' : '#F0F0F0', border: '1px solid #DDD', padding: '0.25rem 0.3rem', opacity: ob.done ? 0.45 : 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.15rem' }}>
                                <input
                                  type="checkbox"
                                  checked={!!ob.done}
                                  onChange={() => toggleObligation(day, ob.id)}
                                  title="Marcar como concluída"
                                  style={{ cursor: 'pointer', accentColor: '#050505', flexShrink: 0 }}
                                />
                                <input
                                  type="time"
                                  value={ob.time}
                                  onChange={e => updateObligation(day, ob.id, 'time', e.target.value)}
                                  style={{ fontSize: '0.65rem', fontWeight: 700, border: 'none', background: 'transparent', flex: 1, outline: 'none', color: '#050505', textDecoration: ob.done ? 'line-through' : 'none' }}
                                />
                                <button
                                  onClick={() => removeObligation(day, ob.id)}
                                  style={{ fontSize: '0.6rem', color: '#FF2A2A', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 900, padding: '0 0.1rem', lineHeight: 1 }}
                                >✕</button>
                              </div>
                              <textarea
                                value={ob.description}
                                onChange={e => updateObligation(day, ob.id, 'description', e.target.value)}
                                placeholder="Obrigação..."
                                rows={2}
                                style={{ fontSize: '0.65rem', border: 'none', background: 'transparent', width: '100%', resize: 'none', outline: 'none', fontFamily: 'inherit', color: '#333', textDecoration: ob.done ? 'line-through' : 'none' }}
                              />
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => addObligation(day)}
                          style={{ marginTop: '0.25rem', fontSize: '0.65rem', background: 'none', border: '1px dashed #AAA', width: '100%', cursor: 'pointer', padding: '0.2rem', color: '#777', fontFamily: 'inherit' }}
                        >+ obrigação</button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    );
  }

  // ── CLIENT LIST ──
  const addFields: { label: string; value: string; set: React.Dispatch<React.SetStateAction<string>>; ph: string }[] = [
    { label: 'Nome *', value: newName, set: setNewName, ph: 'Nome do cliente' },
    { label: 'Empresa', value: newCompany, set: setNewCompany, ph: 'Empresa (opcional)' },
    { label: 'Telefone', value: newPhone, set: setNewPhone, ph: '+351 000 000 000' },
    { label: 'Email', value: newEmail, set: setNewEmail, ph: 'email@exemplo.com' },
  ];

  return (
    <main style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: 'inherit' }}>
      <div style={headerBg}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: '2px solid white', color: 'white', padding: '0.3rem 0.8rem', cursor: 'pointer', fontWeight: 900, fontSize: '0.85rem', fontFamily: 'inherit' }}
          >← Voltar</button>
          <h1 style={{ fontWeight: 900, fontSize: '1.4rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CRM — Gestão de Clientes</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button style={tabBtn(true)}>Clientes</button>
          <button style={tabBtn(false)} onClick={() => setTab('geral')}>Mapa Geral</button>
        </div>
      </div>

      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setShowAddForm(prev => !prev)}
            style={{ padding: '0.6rem 1.5rem', background: '#050505', color: 'white', border: '2px solid #050505', fontWeight: 900, cursor: 'pointer', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'inherit' }}
          >
            {showAddForm ? '✕ Cancelar' : '+ Novo Cliente'}
          </button>
        </div>

        {showAddForm && (
          <div style={{ background: 'white', border: '3px solid #050505', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '4px 4px 0 #050505' }}>
            <p style={{ fontWeight: 900, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Novo Cliente</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem', marginBottom: '1rem' }}>
              {addFields.map(f => (
                <div key={f.label}>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.72rem', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{f.label}</label>
                  <input
                    type="text"
                    value={f.value}
                    onChange={e => f.set(e.target.value)}
                    placeholder={f.ph}
                    onKeyDown={e => e.key === 'Enter' && addClient()}
                    style={{ width: '100%', padding: '0.5rem 0.6rem', border: '2px solid #050505', fontFamily: 'inherit', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
            </div>
            <button
              onClick={addClient}
              style={{ padding: '0.5rem 1.5rem', background: '#FF2A2A', color: 'white', border: '2px solid #050505', fontWeight: 900, cursor: 'pointer', fontSize: '0.88rem', fontFamily: 'inherit' }}
            >Adicionar</button>
          </div>
        )}

        {clients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem 2rem', color: '#BBB' }}>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Nenhum cliente ainda.</p>
            <p style={{ fontSize: '0.9rem' }}>Clique em "+ Novo Cliente" para começar.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {clients.map(client => {
              const totalObs = Object.values(client.calendar).reduce((s, obs) => s + obs.length, 0);
              return (
                <div
                  key={client.id}
                  style={{ background: 'white', border: '2px solid #050505', padding: '1.25rem', cursor: 'pointer', boxShadow: '3px 3px 0 #050505', position: 'relative' }}
                  onClick={() => { setSelectedClientId(client.id); setCalMonth(today.getMonth()); setCalYear(today.getFullYear()); }}
                >
                  <button
                    onClick={e => { e.stopPropagation(); deleteClient(client.id); }}
                    style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'none', border: 'none', cursor: 'pointer', color: '#CCC', fontWeight: 900, fontSize: '0.9rem', padding: '0.1rem 0.3rem', lineHeight: 1 }}
                    title="Apagar cliente"
                  >✕</button>
                  <p style={{ fontWeight: 900, fontSize: '1rem', margin: '0 0 0.2rem', textTransform: 'uppercase' }}>{client.name}</p>
                  {client.company && <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#666' }}>{client.company}</p>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginBottom: '0.75rem' }}>
                    {client.phone && <span style={{ fontSize: '0.75rem', color: '#888' }}>📞 {client.phone}</span>}
                    {client.email && <span style={{ fontSize: '0.75rem', color: '#888' }}>✉️ {client.email}</span>}
                  </div>
                  <div style={{ borderTop: '1px solid #EEE', paddingTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: totalObs > 0 ? '#FF2A2A' : '#CCC' }}>
                      {totalObs} obrigaç{totalObs !== 1 ? 'ões' : 'ão'} registada{totalObs !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
