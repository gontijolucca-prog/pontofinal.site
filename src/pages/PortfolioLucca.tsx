import { useEffect, useMemo, useState } from 'react';
import './portfolio-lucca.css';

type Video = {
  id: string;
  title: string;
  format: 'short' | 'longform';
  client: string;
  tags: string[];
  likes: number;
  comments: number;
  provider: 'youtube' | 'drive';
};

// format: short = vídeos verticais/reels/shorts; longform = vídeos normais
// client: agrupa por cliente/projeto — ajusta os nomes à vontade
const POSTS: Video[] = [
  // ---- Cliente IMOVENDO ----
  { id: 'GAeqBhtehec', title: 'O Passo a Passo para Realizar um Anúncio de TV', format: 'longform', client: 'IMOVENDO', tags: ['Commercial', 'Anúncio TV'], likes: 1284, comments: 96, provider: 'youtube' },

  // ---- Cliente TST PEDRo ----
  { id: 'v5Yh2Tc-IBM', title: 'Client Testimonial — TST PEDRo', format: 'longform', client: 'TST PEDRo', tags: ['Testimonial'], likes: 512, comments: 28, provider: 'youtube' },

  // ---- Cliente Amor de Ganga ----
  { id: 'SnfH-RkmmK0', title: 'Amor de Ganga — Lyric Video', format: 'longform', client: 'Amor de Ganga', tags: ['Music', 'Lyric'], likes: 1520, comments: 132, provider: 'youtube' },

  // ---- Cliente Bomba Relógio ----
  { id: 'rE67F31FEo0', title: 'Bomba Relógio — Lyric Video', format: 'longform', client: 'Bomba Relógio', tags: ['Music', 'Lyric'], likes: 1103, comments: 89, provider: 'youtube' },

  // ---- Marrocos (filmagens) ----
  { id: '1wNXf0f29gkf_4NrTxjzOvm4jj5iu9YpB', title: 'Marrocos 1', format: 'longform', client: 'Marrocos', tags: ['Travel', 'Film'], likes: 986, comments: 73, provider: 'drive' },
  { id: '1bAj4tPyTZT6vGzkn-U2I_Y1VMdkXHhI0', title: 'Marrocos 2', format: 'longform', client: 'Marrocos', tags: ['Travel', 'Film'], likes: 1042, comments: 81, provider: 'drive' },
  { id: '1BDR9ecJzgfMi1DcRPs1-oBGFaZ6_Cbql', title: 'Marrocos 3', format: 'longform', client: 'Marrocos', tags: ['Travel', 'Film'], likes: 899, comments: 64, provider: 'drive' },

  // ---- Tutoriais / canal próprio ----
  { id: 'moC6hMej78s', title: 'DaVinci Resolve 20 — 11 Novidades', format: 'longform', client: 'Canal Lucca', tags: ['Editing', 'Tutorial'], likes: 842, comments: 57, provider: 'youtube' },
  { id: 'qtpCxm-X_AA', title: 'Blackmagic PYXIS 6K vs RED Komodo-X', format: 'longform', client: 'Canal Lucca', tags: ['Camera', 'Review'], likes: 961, comments: 71, provider: 'youtube' },
  { id: 'k_grFO7zqiw', title: 'Como Usar a Nova App Edits', format: 'longform', client: 'Canal Lucca', tags: ['Editing', 'Tutorial'], likes: 614, comments: 38, provider: 'youtube' },
  { id: 'mFBKipOUv_I', title: 'Como Criar um Estúdio para YouTube', format: 'longform', client: 'Canal Lucca', tags: ['Production', 'Setup'], likes: 733, comments: 44, provider: 'youtube' },
  { id: 'r0ARluISKWU', title: 'Melhores Apps Storyboards & Shot Lists', format: 'longform', client: 'Canal Lucca', tags: ['Pre-production'], likes: 588, comments: 31, provider: 'youtube' },

  // ---- Showreel / pieces ----
  { id: 'rBlwKlP0uW8', title: 'Portfolio Piece', format: 'longform', client: 'Showreel', tags: ['Showreel'], likes: 880, comments: 62, provider: 'youtube' },
  { id: '1BcWIdoQXcg', title: 'Portfolio Piece', format: 'longform', client: 'Showreel', tags: ['Edit'], likes: 740, comments: 41, provider: 'youtube' },
  { id: 'Y23cUleAtwM', title: 'Motion Graphics Logo', format: 'longform', client: 'Showreel', tags: ['Motion', 'Branding'], likes: 665, comments: 39, provider: 'youtube' },

  // ---- Shorts / Reels ----
  { id: 'NtqHUwRE7Ps', title: 'DO NOT BUY These 3 UK Honey Brands', format: 'short', client: 'Shorts/Reels', tags: ['Short'], likes: 2290, comments: 187, provider: 'youtube' },
  { id: 'HI3MTX5_MR8', title: 'The Best Soap in the UK Is NOT Dove', format: 'short', client: 'Shorts/Reels', tags: ['Short'], likes: 1930, comments: 154, provider: 'youtube' },
];

const FORMATS = [
  { key: 'all', label: 'Tudo' },
  { key: 'longform', label: 'Longform' },
  { key: 'short', label: 'Shorts/Reels' },
];

export default function PortfolioLucca() {
  const [active, setActive] = useState<Video | null>(null);
  const [fmt, setFmt] = useState<string>('all');
  const [client, setClient] = useState<string>('all');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setActive(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const clients = useMemo(() => {
    const set = new Set<string>();
    POSTS.forEach((p) => set.add(p.client));
    return ['all', ...Array.from(set)];
  }, []);

  const posts = useMemo(() => {
    let list = POSTS;
    if (fmt !== 'all') list = list.filter((p) => p.format === fmt);
    if (client !== 'all') list = list.filter((p) => p.client === client);
    return list;
  }, [fmt, client]);

  // Resolução máxima: maxresdefault (1280x720) com fallback automático para hqdefault (480p)
  const thumb = (v: Video) =>
    v.provider === 'youtube'
      ? `https://i.ytimg.com/vi/${v.id}/maxresdefault.jpg`
      : `https://drive.google.com/thumbnail?id=${v.id}&sz=w1600`;

  const embed = (v: Video) =>
    v.provider === 'youtube'
      ? `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0&hd=1`
      : `https://drive.google.com/file/d/${v.id}/preview`;

  return (
    <div className="pf">
      {/* TOP BAR */}
      <header className="pf-topbar">
        <div className="pf-topbar-inner">
          <span className="pf-logo">Lucca<span>.</span></span>
          <a className="pf-contact-btn" href="mailto:gontijolucca@gmail.com">Contact</a>
        </div>
      </header>

      {/* PROFILE HEADER */}
      <div className="pf-main">
        <section className="pf-profile">
          <div className="pf-profile-grid">
            <div className="pf-avatar-wrap">
              <div className="pf-avatar">
                <div className="pf-avatar-inner">
                  <img src="/lucca-portfolio/lucca.png" alt="Lucca Gontijo" />
                </div>
              </div>
            </div>
            <div>
              <div className="pf-identity">
                <span className="pf-username">lucca.gontijo</span>
                <div className="pf-actions">
                  <a className="pf-btn blue" href="#pf-grid">Ver trabalho</a>
                  <a className="pf-btn" href="https://wa.me/351915136439" target="_blank" rel="noreferrer">Mensagem</a>
                </div>
              </div>
              <div className="pf-stats">
                <div className="pf-stat"><b>{POSTS.length}</b><span>projetos</span></div>
                <div className="pf-stat"><b>{POSTS.filter((p) => p.format === 'short').length}</b><span>shorts</span></div>
                <div className="pf-stat"><b>7yrs</b><span>experiência</span></div>
              </div>
              <div className="pf-bio">
                <div><span className="pf-name">Lucca Gontijo</span></div>
                <div>Editor de vídeo · Motion designer</div>
                <div>Storytelling claro e eficaz. Adaptável a qualquer estilo. 7 anos de experiência.</div>
                <div className="pf-site">pontofinal.site/#/portfolio/lucca</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* TABS */}
      <div className="pf-main" style={{ paddingTop: 0 }}>
        <div className="pf-tabs">
          <div className={`pf-tab${fmt === 'all' ? ' active' : ''}`} onClick={() => setFmt('all')}>
            <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>Tudo
          </div>
          {FORMATS.slice(1).map((t) => (
            <div key={t.key} className={`pf-tab${fmt === t.key ? ' active' : ''}`} onClick={() => setFmt(t.key)}>{t.label}</div>
          ))}
        </div>

        {/* POST GRID */}
        <div id="pf-grid">
          {fmt === 'all' && client === 'all' ? (
            /* Modo separadores: grupo Longform + grupo Shorts/Reels */
            (['longform', 'short'] as const).map((f) => {
              const group = POSTS.filter((p) => p.format === f);
              if (group.length === 0) return null;
              return (
                <div key={f} className="pf-pgroup">
                  <div className="pf-psep">
                    <span>{f === 'longform' ? 'Longform' : 'Shorts / Reels'}</span>
                    <b>{group.length}</b>
                  </div>
                  <div className="pf-grid">
                    {group.map((v) => (
                      <div key={v.id} className="pf-post" onClick={() => setActive(v)}>
                        <img
                          src={thumb(v)}
                          alt={v.title}
                          loading="lazy"
                          onError={(e) => {
                            const el = e.currentTarget;
                            if (el.src.includes('maxresdefault')) el.src = el.src.replace('maxresdefault', 'hqdefault');
                            else if (el.src.includes('hqdefault')) el.src = el.src.replace('hqdefault', 'sddefault');
                            else if (el.src.includes('sddefault')) el.src = el.src.replace('sddefault', 'mqdefault');
                          }}
                        />
                        <div className="pf-overlay">
                          <div className="pf-overlay-meta">
                            <div><svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>{v.likes.toLocaleString('en-US')}</div>
                            <div><svg viewBox="0 0 24 24"><path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z"/></svg>{v.comments}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="pf-grid">
              {posts.map((v) => (
                <div key={v.id} className="pf-post" onClick={() => setActive(v)}>
                  <img
                    src={thumb(v)}
                    alt={v.title}
                    loading="lazy"
                    onError={(e) => {
                      const el = e.currentTarget;
                      if (el.src.includes('maxresdefault')) el.src = el.src.replace('maxresdefault', 'hqdefault');
                      else if (el.src.includes('hqdefault')) el.src = el.src.replace('hqdefault', 'sddefault');
                      else if (el.src.includes('sddefault')) el.src = el.src.replace('sddefault', 'mqdefault');
                    }}
                  />
                  <div className="pf-overlay">
                    <div className="pf-overlay-meta">
                      <div><svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>{v.likes.toLocaleString('en-US')}</div>
                      <div><svg viewBox="0 0 24 24"><path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z"/></svg>{v.comments}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FILTROS TIPO + CLIENTE */}
        <div className="pf-filters">
          <div className="pf-filter-group">
            <span className="pf-filter-label">Formato</span>
            <div className="pf-chips">
              {FORMATS.map((t) => (
                <div key={t.key} className={`pf-chip${fmt === t.key ? ' active' : ''}`} onClick={() => setFmt(t.key)}>{t.label}</div>
              ))}
            </div>
          </div>
          <div className="pf-filter-group">
            <span className="pf-filter-label">Cliente</span>
            <div className="pf-chips">
              {clients.map((c) => (
                <div key={c} className={`pf-chip${client === c ? ' active' : ''}`} onClick={() => setClient(c)}>{c === 'all' ? 'Todos' : c}</div>
              ))}
            </div>
          </div>
          <div className="pf-count">
            {posts.length} {posts.length === 1 ? 'vídeo' : 'vídeos'}
            {client !== 'all' && fmt !== 'all' ? ' · filtrado' : ''}
          </div>
        </div>

        {/* FOOTER / CONTACT */}
        <footer className="pf-footer">
          <h2>Vamos criar algo <span>extraordinário.</span></h2>
          <div className="pf-cta-row">
            <a className="pf-cta" href="https://wa.me/351915136439" target="_blank" rel="noreferrer">WhatsApp</a>
            <a className="pf-cta ghost" href="mailto:gontijolucca@gmail.com">gontijolucca@gmail.com</a>
          </div>
          <div className="pf-copy">
            © {new Date().getFullYear()} Lucca Gontijo · <a href="https://pontofinal.site" target="_blank" rel="noreferrer">Pontofinal.site</a>
          </div>
        </footer>
      </div>

      {/* MODAL */}
      {active && (
        <div className="pf-modal" onClick={() => setActive(null)}>
          <div className="pf-modal-inner" onClick={(e) => e.stopPropagation()}>
            <div className="pf-modal-head">
              <div className="pf-mav"><img src="/lucca-portfolio/lucca.png" alt="" /></div>
              <span className="pf-mu">lucca.gontijo</span>
              <button className="pf-modal-close" onClick={() => setActive(null)}>×</button>
            </div>
            <div className="pf-modal-frame">
              <iframe src={embed(active)} title={active.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
            </div>
            <div className="pf-modal-cap">
              <div className="pf-modal-icons">
                <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                <svg viewBox="0 0 24 24"><path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z"/></svg>
              </div>
              <div className="pf-modal-likes">{active.likes.toLocaleString('en-US')} likes</div>
              <p><span className="pf-u">lucca.gontijo</span>{active.title}</p>
              <div className="pf-mtags">
                {active.tags.map((t) => <span key={t} className="pf-tag">#{t.replace(/\s+/g, '')}</span>)}
                <span className="pf-tag">#{active.client.replace(/\s+/g, '')}</span>
              </div>
              <div className="pf-time">{active.format === 'short' ? 'Short / Reel' : 'Longform'} · {active.client}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}