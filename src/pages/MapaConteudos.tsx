import { useState } from 'react';
import jsPDF from 'jspdf';

interface Publication {
  id: string;
  time: string;
  description: string;
}

interface DayData {
  [dayKey: string]: Publication[];
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const WEEKDAYS_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function dayKey(year: number, month: number, day: number) {
  return `${year}-${month}-${day}`;
}

export default function MapaConteudos() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [clientName, setClientName] = useState('');
  const [days, setDays] = useState<DayData>({});
  const [exporting, setExporting] = useState(false);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const addPublication = (day: number) => {
    const key = dayKey(year, month, day);
    setDays(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), { id: `${Date.now()}-${Math.random()}`, time: '09:00', description: '' }],
    }));
  };

  const updatePublication = (day: number, pubId: string, field: 'time' | 'description', value: string) => {
    const key = dayKey(year, month, day);
    setDays(prev => ({
      ...prev,
      [key]: (prev[key] || []).map(p => p.id === pubId ? { ...p, [field]: value } : p),
    }));
  };

  const removePublication = (day: number, pubId: string) => {
    const key = dayKey(year, month, day);
    setDays(prev => ({
      ...prev,
      [key]: (prev[key] || []).filter(p => p.id !== pubId),
    }));
  };

  const getDayPublications = (day: number): Publication[] => {
    return days[dayKey(year, month, day)] || [];
  };

  const totalPublications = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    .reduce((acc, d) => acc + getDayPublications(d).length, 0);

  const handleExport = () => {
    setExporting(true);

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 18;
      const contentW = pageW - margin * 2;
      let y = margin;

      const checkPage = (needed: number) => {
        if (y + needed > pageH - margin) {
          pdf.addPage();
          y = margin;
        }
      };

      // ── Header ──
      pdf.setFillColor(5, 5, 5);
      pdf.rect(margin, y, contentW, 14, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.setTextColor(255, 255, 255);
      pdf.text('MAPA DE CONTEÚDOS', margin + 4, y + 9);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${MONTHS[month].toUpperCase()} ${year}`, pageW - margin - 4, y + 9, { align: 'right' });
      y += 18;

      if (clientName.trim()) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(5, 5, 5);
        pdf.text(`Cliente: ${clientName.trim()}`, margin, y);
        y += 7;
      }

      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Gerado em ${new Date().toLocaleDateString('pt-PT')} · Pontofinal`, pageW - margin, y, { align: 'right' });
      y += 8;

      // ── Days ──
      let hasAny = false;

      for (let d = 1; d <= daysInMonth; d++) {
        const pubs = getDayPublications(d);
        if (pubs.length === 0) continue;
        hasAny = true;

        const weekdayName = WEEKDAYS_FULL[new Date(year, month, d).getDay()];
        const rowH = 8;

        checkPage(rowH + pubs.length * 10 + 6);

        // Day header bar
        pdf.setFillColor(30, 30, 30);
        pdf.rect(margin, y, contentW, rowH, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(255, 255, 255);
        pdf.text(`${d} ${MONTHS_SHORT[month]}  ·  ${weekdayName}`, margin + 3, y + 5.5);
        pdf.setTextColor(180, 180, 180);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.text(`${pubs.length} publicação${pubs.length !== 1 ? 'ões' : ''}`, pageW - margin - 3, y + 5.5, { align: 'right' });
        y += rowH;

        // Publications
        pubs.forEach((pub, idx) => {
          const pubH = 9;
          if (idx % 2 === 0) {
            pdf.setFillColor(247, 247, 247);
          } else {
            pdf.setFillColor(255, 255, 255);
          }
          pdf.rect(margin, y, contentW, pubH, 'F');
          pdf.setDrawColor(220, 220, 220);
          pdf.rect(margin, y, contentW, pubH, 'S');

          // Time
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9);
          pdf.setTextColor(200, 40, 40);
          pdf.text(pub.time, margin + 3, y + 6);

          // Description
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9);
          pdf.setTextColor(50, 50, 50);
          const desc = pub.description.trim() || 'Sem descrição';
          const lines = pdf.splitTextToSize(desc, contentW - 22);
          pdf.text(lines[0], margin + 22, y + 6);
          y += pubH;
        });

        y += 5;
      }

      if (!hasAny) {
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(10);
        pdf.setTextColor(150, 150, 150);
        pdf.text('Nenhuma publicação adicionada para este mês.', margin, y + 8);
        y += 16;
      }

      // ── Footer summary ──
      checkPage(14);
      y += 4;
      pdf.setDrawColor(5, 5, 5);
      pdf.setLineWidth(0.4);
      pdf.line(margin, y, pageW - margin, y);
      y += 6;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(5, 5, 5);
      pdf.text(
        `Total: ${totalPublications} publicação${totalPublications !== 1 ? 'ões' : ''} em ${MONTHS[month]} ${year}`,
        margin, y
      );

      pdf.save(`mapa-conteudos-${MONTHS[month].toLowerCase()}-${year}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  // Build calendar weeks
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <main style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{ background: '#050505', color: 'white', padding: '1.5rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontWeight: 900, fontSize: '1.5rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Mapa de Conteúdos
        </h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            style={{ padding: '0.5rem 0.75rem', fontWeight: 700, border: '2px solid white', background: '#050505', color: 'white', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <input
            type="number"
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{ width: '90px', padding: '0.5rem', fontWeight: 700, border: '2px solid white', background: '#050505', color: 'white', fontSize: '0.9rem', textAlign: 'center' }}
            min={2020}
            max={2035}
          />
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              padding: '0.5rem 1.25rem',
              background: exporting ? '#555' : '#FF2A2A',
              color: 'white',
              border: '2px solid white',
              fontWeight: 900,
              cursor: exporting ? 'default' : 'pointer',
              fontSize: '0.9rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {exporting ? 'A exportar...' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      {/* Client name */}
      <div style={{ padding: '1.5rem 2rem 0', maxWidth: '1400px', margin: '0 auto' }}>
        <input
          type="text"
          value={clientName}
          onChange={e => setClientName(e.target.value)}
          placeholder="Nome do cliente..."
          style={{ width: '320px', padding: '0.6rem 0.75rem', fontSize: '1rem', fontWeight: 700, border: '2px solid #050505', outline: 'none', fontFamily: 'inherit', background: 'white' }}
        />
      </div>

      {/* Month label */}
      <div style={{ padding: '0.75rem 2rem 0.5rem', maxWidth: '1400px', margin: '0 auto' }}>
        <p style={{ fontWeight: 700, fontSize: '1.1rem', color: '#444', marginBottom: '1rem' }}>
          {MONTHS[month]} {year} — {daysInMonth} dias · {totalPublications} publicação{totalPublications !== 1 ? 'ões' : ''} agendada{totalPublications !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Interactive Calendar Grid */}
      <div style={{ padding: '0 2rem 2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', marginBottom: '3px' }}>
          {WEEKDAYS.map(d => (
            <div key={d} style={{ background: '#050505', color: 'white', textAlign: 'center', padding: '0.5rem', fontWeight: 900, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', marginBottom: '3px' }}>
            {week.map((day, di) => {
              if (!day) {
                return <div key={di} style={{ background: '#E8E8E8', minHeight: '140px' }} />;
              }
              const pubs = getDayPublications(day);
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              return (
                <div
                  key={di}
                  style={{
                    border: isToday ? '3px solid #FF2A2A' : '2px solid #050505',
                    minHeight: '140px',
                    padding: '0.4rem',
                    background: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: '0.85rem', marginBottom: '0.3rem', color: isToday ? '#FF2A2A' : '#050505' }}>
                    {day}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {pubs.map(pub => (
                      <div key={pub.id} style={{ background: '#F0F0F0', border: '1px solid #DDD', padding: '0.25rem 0.3rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.15rem' }}>
                          <input
                            type="time"
                            value={pub.time}
                            onChange={e => updatePublication(day, pub.id, 'time', e.target.value)}
                            style={{ fontSize: '0.65rem', fontWeight: 700, border: 'none', background: 'transparent', flex: 1, outline: 'none', color: '#050505' }}
                          />
                          <button
                            onClick={() => removePublication(day, pub.id)}
                            style={{ fontSize: '0.6rem', color: '#FF2A2A', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 900, padding: '0 0.1rem', lineHeight: 1 }}
                          >
                            ✕
                          </button>
                        </div>
                        <textarea
                          value={pub.description}
                          onChange={e => updatePublication(day, pub.id, 'description', e.target.value)}
                          placeholder="Descrição da publicação..."
                          rows={2}
                          style={{ fontSize: '0.65rem', border: 'none', background: 'transparent', width: '100%', resize: 'none', outline: 'none', fontFamily: 'inherit', color: '#333' }}
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => addPublication(day)}
                    style={{ marginTop: '0.25rem', fontSize: '0.65rem', background: 'none', border: '1px dashed #AAA', width: '100%', cursor: 'pointer', padding: '0.2rem', color: '#777', fontFamily: 'inherit' }}
                  >
                    + publicação
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </main>
  );
}
