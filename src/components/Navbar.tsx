import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
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

  const planOptions = [
    { label: 'Serviços', id: 'servicos' },
    { label: 'Processo', id: 'como-funciona' },
    { label: 'Orçamento', id: 'orcamento' },
  ];

  return (
    <nav className="navbar border-top-thick" style={{ padding: '1.5rem 0', borderBottom: '4px solid #050505', background: '#FFF' }}>
      <div className="container nav-content">
        <Link to="/" className="logo" style={{ textDecoration: 'none' }} onClick={handleLogoClick}>Ponto<span className="logo-accent">final</span>.site_</Link>

        {/* Desktop Nav */}
        <div className="nav-desktop">
          {planOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => scrollToSection(opt.id)}
              className="btn btn-primary"
            >
              {opt.label}
            </button>
          ))}
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