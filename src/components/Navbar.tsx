import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const scrollToSection = (id: string) => {
    setDropdownOpen(false);
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOrcamento = (e: React.MouseEvent) => {
    e.preventDefault();
    scrollToSection('forms-section');
  };

  const planOptions = [
    { label: 'Planos de Conteúdo', id: 'planos-conteudo' },
    { label: 'Planos de Websites', id: 'planos-websites' },
  ];

  return (
    <nav className="navbar border-top-thick" style={{ padding: '1.5rem 0', borderBottom: '4px solid #050505', background: '#FFF' }}>
      <div className="container nav-content">
        <Link to="/" className="logo" style={{ textDecoration: 'none' }}>Pontofinal.site_</Link>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button onClick={handleOrcamento} className="btn btn-secondary">
            Pedir um Orçamento
          </button>
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              Ver Planos <span style={{ fontSize: '0.7rem' }}>▾</span>
            </button>
            {dropdownOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                background: '#fff',
                border: '4px solid #050505',
                boxShadow: '8px 8px 0px 0px #050505',
                minWidth: '200px',
                zIndex: 100,
              }}>
                {planOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => scrollToSection(opt.id)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.75rem 1rem',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '2px solid #050505',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      color: '#050505',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#FFE600')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
