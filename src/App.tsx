import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Terms from './pages/Terms';
import Admin from './pages/Admin';
import Proposta from './pages/Proposta';
import PropostaPlan from './pages/PropostaPlan';
import Contrato from './pages/Contrato';

function Layout() {
  const location = useLocation();
  const isFullPage = location.pathname === '/proposta'
    || location.pathname.startsWith('/proposta/')
    || location.pathname === '/contrato';

  return (
    <div className="min-h-screen flex flex-col">
      {!isFullPage && <Navbar />}
      <div className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/privacidade" element={<PrivacyPolicy />} />
          <Route path="/termos" element={<Terms />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/proposta" element={<Proposta />} />
          <Route path="/proposta/:planId" element={<PropostaPlan />} />
          <Route path="/contrato" element={<Contrato />} />
        </Routes>
      </div>
      {!isFullPage && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Layout />
    </HashRouter>
  );
}
