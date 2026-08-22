import { useEffect, useState } from 'react';
import './portfolio-lucca.css';

type Video = {
  id: string;
  title: string;
  group: 'shorts' | 'motion' | 'talking' | 'vlogs' | 'publicidades';
  client: string;
  tags: string[];
  likes: number;
  comments: number;
};

// Grupos = categorias das pastas do SSD (ordem: Shorts primeiro, depois longform)
const POSTS: Video[] = [
  // ---- SHORTS / REELS ----
  { id: 'NtqHUwRE7Ps', title: 'DO NOT BUY These 3 UK Honey Brands', group: 'shorts', client: 'Shorts/Reels', tags: ['Short'], likes: 2290, comments: 187 },
  { id: 'HI3MTX5_MR8', title: 'The Best Soap in the UK Is NOT Dove', group: 'shorts', client: 'Shorts/Reels', tags: ['Short'], likes: 1930, comments: 154 },

  // ---- MOTION GRAPHICS ----
  { id: 'SnfH-RkmmK0', title: 'Amor de Ganga — Lyric Video', group: 'motion', client: 'Amor de Ganga', tags: ['Music', 'Lyric'], likes: 1520, comments: 132 },
  { id: 'rE67F31FEo0', title: 'Bomba Relógio — Lyric Video', group: 'motion', client: 'Bomba Relógio', tags: ['Music', 'Lyric'], likes: 1103, comments: 89 },
  { id: 'Y23cUleAtwM', title: 'Motion Graphics Logo', group: 'motion', client: 'Showreel', tags: ['Motion', 'Branding'], likes: 665, comments: 39 },
  { id: 'rBlwKlP0uW8', title: 'Portfolio Piece', group: 'motion', client: 'Showreel', tags: ['Showreel'], likes: 880, comments: 62 },
  { id: '1BcWIdoQXcg', title: 'Portfolio Piece', group: 'motion', client: 'Showreel', tags: ['Edit'], likes: 740, comments: 41 },

  // ---- TALKING HEADS ----
  { id: 'GAeqBhtehec', title: 'O Passo a Passo para Realizar um Anúncio de TV', group: 'talking', client: 'IMOVENDO', tags: ['Commercial', 'Anúncio TV'], likes: 1284, comments: 96 },
  { id: 'moC6hMej78s', title: 'DaVinci Resolve 20 — 11 Novidades', group: 'talking', client: 'Canal Lucca', tags: ['Editing', 'Tutorial'], likes: 842, comments: 57 },
  { id: 'qtpCxm-X_AA', title: 'Blackmagic PYXIS 6K vs RED Komodo-X', group: 'talking', client: 'Canal Lucca', tags: ['Camera', 'Review'], likes: 961, comments: 71 },
  { id: 'k_grFO7zqiw', title: 'Como Usar a Nova App Edits', group: 'talking', client: 'Canal Lucca', tags: ['Editing', 'Tutorial'], likes: 614, comments: 38 },
  { id: 'mFBKipOUv_I', title: 'Como Criar um Estúdio para YouTube', group: 'talking', client: 'Canal Lucca', tags: ['Production', 'Setup'], likes: 733, comments: 44 },
  { id: 'r0ARluISKWU', title: 'Melhores Apps Storyboards & Shot Lists', group: 'talking', client: 'Canal Lucca', tags: ['Pre-production'], likes: 588, comments: 31 },

  // ---- VLOGS ----
  { id: 'v5Yh2Tc-IBM', title: 'Client Testimonial — TST PEDRo', group: 'vlogs', client: 'TST PEDRo', tags: ['Testimonial'], likes: 512, comments: 28 },
  { id: '1wNXf0f29gkf_4NrTxjzOvm4jj5iu9YpB', title: 'Marrocos 1', group: 'vlogs', client: 'Marrocos', tags: ['Travel', 'Film'], likes: 986, comments: 73 },
  { id: '1bAj4tPyTZT6vGzkn-U2I_Y1VMdkXHhI0', title: 'Marrocos 2', group: 'vlogs', client: 'Marrocos', tags: ['Travel', 'Film'], likes: 1042, comments: 81 },
  { id: '1BDR9ecJzgfMi1DcRPs1-oBGFaZ6_Cbql', title: 'Marrocos 3', group: 'vlogs', client: 'Marrocos', tags: ['Travel', 'Film'], likes: 899, comments: 64 },

  // ---- PUBLICIDADES (Remax) — 5 longform + 4 reels ----
  { id: 'remax-long-1', title: 'Remax — Longform 1', group: 'publicidades', client: 'Remax', tags: ['Publicidade', 'Longform'], likes: 1567, comments: 112 },
  { id: 'remax-long-2', title: 'Remax — Longform 2', group: 'publicidades', client: 'Remax', tags: ['Publicidade', 'Longform'], likes: 1420, comments: 98 },
  { id: 'remax-long-3', title: 'Remax — Longform 3', group: 'publicidades', client: 'Remax', tags: ['Publicidade', 'Longform'], likes: 1498, comments: 104 },
  { id: 'remax-long-4', title: 'Remax — Longform 4', group: 'publicidades', client: 'Remax', tags: ['Publicidade', 'Longform'], likes: 1332, comments: 91 },
  { id: 'remax-long-5', title: 'Remax — Longform 5', group: 'publicidades', client: 'Remax', tags: ['Publicidade', 'Longform'], likes: 1511, comments: 107 },
  { id: 'remax-reel-1', title: 'Remax — Reel 1', group: 'publicidades', client: 'Remax', tags: ['Publicidade', 'Reel'], likes: 2380, comments: 201 },
  { id: 'remax-reel-2', title: 'Remax — Reel 2', group: 'publicidades', client: 'Remax', tags: ['Publicidade', 'Reel'], likes: 2140, comments: 176 },
  { id: 'remax-reel-3', title: 'Remax — Reel 3', group: 'publicidades', client: 'Remax', tags: ['Publicidade', 'Reel'], likes: 2260, comments: 188 },
  { id: 'remax-reel-4', title: 'Remax — Reel 4', group: 'publicidades', client: 'Remax', tags: ['Publicidade', 'Reel'], likes: 2050, comments: 169 },
];

const GROUPS: { key: Video['group']; label: string; link?: string; linkLabel: string }[] = [
  { key: 'talking', label: 'Talking Heads', link: 'https://www.youtube.com/@nunocarvalhovlog/videos', linkLabel: 'Canal Nuno Carvalho' },
  { key: 'shorts', label: 'Shorts / Reels', link: 'https://www.youtube.com/@CrisisReportUk', linkLabel: 'Canal CrisisReportUk — editei a maioria dos vídeos do canal' },
  { key: 'publicidades', label: 'Publicidades', link: 'https://remax.pt/pt', linkLabel: 'Remax Portugal' },
  { key: 'motion', label: 'Motion Graphics', link: 'https://www.instagram.com/parfootgolf/', linkLabel: 'Instagram Parfootgolf' },
  { key: 'vlogs', label: 'Vlogs', link: 'https://www.youtube.com/@calibricrlh', linkLabel: 'Canal Calibri' },
];

export default function PortfolioLucca() {
  const [active, setActive] = useState<Video | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    // default dark; respeita escolha anterior do utilizador
    const saved = window.localStorage.getItem('pf-theme');
    if (saved === 'light' || saved === 'dark') setTheme(saved);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('pf-theme', theme);
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setActive(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Vídeo + thumb hosted na VPS
  const videoSrc = (v: Video) => `https://media.pontofinal.site/${v.id}.mp4`;
  const thumb = (v: Video) => `https://media.pontofinal.site/thumbs/${v.id}.jpg?v=2`;

  return (
    <div className={`pf${theme === 'light' ? ' pf-light' : ''}`}>
      {/* TOP BAR */}
      <header className="pf-topbar">
        <div className="pf-topbar-inner">
          <span className="pf-logo">Lucca<span>.</span></span>
          <button
            className="pf-theme-toggle"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Alternar tema"
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>
            ) : (
              <svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>
            )}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
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
                <div className="pf-verified" aria-label="Verificado">
                  <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                </div>
              </div>
            </div>
            <div>
              <div className="pf-identity">
                <span className="pf-username">lucca.gontijo</span>
                <div className="pf-actions">
                  <button
                    className="pf-btn blue"
                    onClick={() => window.scrollBy({ top: 420, behavior: 'smooth' })}
                  >Ver trabalho</button>
                  <a className="pf-btn" href="https://wa.me/351915136439" target="_blank" rel="noreferrer">Mensagem</a>
                </div>
              </div>
              <div className="pf-stats">
                <div className="pf-stat"><b>{POSTS.length}</b><span>projetos</span></div>
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

      {/* POST GRID — agrupado por categoria (Shortform primeiro) */}
      <div className="pf-main" style={{ paddingTop: 0 }}>
        <div id="pf-grid">
          {GROUPS.map((g) => {
            const group = POSTS.filter((p) => p.group === g.key);
            if (group.length === 0) return null;
            return (
              <div key={g.key} className="pf-pgroup">
                <div className="pf-psep">
                  <span>{g.label}</span>
                  <b>{group.length}</b>
                  {g.link && (
                    <a className="pf-catlink" href={g.link} target="_blank" rel="noreferrer">
                      {g.linkLabel} ↗
                    </a>
                  )}
                </div>
                <div className="pf-grid">
                  {group.map((v) => (
                    <div key={v.id} className="pf-post" onClick={() => setActive(v)}>
                      <img src={thumb(v)} alt={v.title} loading="lazy" />
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
          })}
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
              <video
                src={videoSrc(active)}
                poster={thumb(active)}
                controls
                autoPlay
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
              />
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
              <div className="pf-time">{
                GROUPS.find((g) => g.key === active.group)?.label
              } · {active.client}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}