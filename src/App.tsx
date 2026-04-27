import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Terms from './pages/Terms';
import Admin from './pages/Admin';
import Proposta from './pages/Proposta';

function Layout() {
  const location = useLocation();
  const isProposta = location.pathname === '/proposta';

  return (
    <div className="min-h-screen flex flex-col">
      {!isProposta && <Navbar />}
      <div className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/privacidade" element={<PrivacyPolicy />} />
          <Route path="/termos" element={<Terms />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/proposta" element={<Proposta />} />
        </Routes>
      </div>
      {!isProposta && <Footer />}
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
