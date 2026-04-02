import { Link, useNavigate, useLocation } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const handlePlanosClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        document.getElementById('pacotes')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      document.getElementById('pacotes')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="navbar border-top-thick" style={{ padding: '1.5rem 0', borderBottom: '4px solid #050505', background: '#FFF' }}>
        <div className="container nav-content">
            <Link to="/" className="logo" style={{ textDecoration: 'none' }}>Pontofinal.site_</Link>
            <button onClick={handlePlanosClick} className="btn btn-primary">Ver Planos</button>
        </div>
    </nav>
  );
}
