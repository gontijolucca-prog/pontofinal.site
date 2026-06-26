import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer border-top-thick" style={{ padding: '2rem 0', backgroundColor: '#FFF', textAlign: 'center' }}>
        <div className="container footer-content">
            <div className="footer-brand">
                <div className="logo">Pontofinal.site_</div>
                <p>Agência Digital para empresas reais.<br/>Websites.<br/>Leiria, Portugal.</p>
            </div>
            <div className="footer-links">
                <h3>Legal</h3>
                <ul>
                    <li><Link to="/termos">Termos e Condições</Link></li>
                    <li><Link to="/privacidade">Política de Privacidade</Link></li>
                </ul>
            </div>
            <div className="footer-links">
                <h3>Contacto</h3>
                <ul>
                    <li><a href="mailto:geral@pontofinal.site">geral@pontofinal.site</a></li>
                    <li><Link to="/admin" className="footer-admin-link" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Admin</Link></li>
                </ul>
            </div>
        </div>
        <div className="footer-bottom">
            <p>&copy; 2026 Pontofinal.site. Todos os direitos reservados. Suporte: <a href="mailto:geral@pontofinal.site">geral@pontofinal.site</a></p>
        </div>
    </footer>
  );
}