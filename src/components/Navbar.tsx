import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogoClick = (e: React.MouseEvent) => {
    if (location.pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToSection = (id: string) => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
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
    setMobileMenuOpen(false);
    scrollToSection('forms-section');
  };

  const planOptions = [
    { label: 'Planos de Conteúdo', id: 'planos-conteudo' },
    { label: 'Planos de Websites', id: 'planos-websites' },
  ];

  return (
    <nav className="navbar border-top-thick" style={{ padding: '1.5rem 0', borderBottom: '4px solid #050505', background: '#FFF' }}>
      <div className="container nav-content">
        <Link to="/" className="logo" style={{ textDecoration: 'none' }} onClick={handleLogoClick}>Pontofinal.site_</Link>

        {/* Desktop Nav */}
        <div className="nav-desktop">
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
              <div className="nav-dropdown">
                {planOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => scrollToSection(opt.id)}
                    className="nav-dropdown-item"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Hamburger Button */}
        <button
          className="nav-hamburger"
          onClick={() => setMobileMenuOpen((o) => !o)}
          aria-label="Abrir menu"
        >
          <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`} />
          <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`} />
          <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`} />
        </button>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="nav-mobile-menu" ref={mobileMenuRef}>
            <button onClick={handleOrcamento} className="btn btn-secondary nav-mobile-btn">
              Pedir um Orçamento
            </button>
            {planOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => scrollToSection(opt.id)}
                className="btn btn-primary nav-mobile-btn"
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}