import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';

const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const Terms = lazy(() => import('./pages/Terms'));
const Admin = lazy(() => import('./pages/Admin'));
const Proposta = lazy(() => import('./pages/Proposta'));
const PropostaPlan = lazy(() => import('./pages/PropostaPlan'));
const Contrato = lazy(() => import('./pages/Contrato'));
const MapaConteudos = lazy(() => import('./pages/MapaConteudos'));
const CRM = lazy(() => import('./pages/CRM'));
const PortfolioLucca = lazy(() => import('./pages/PortfolioLucca'));

function RouteFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-pulse text-sm text-neutral-500">A carregar…</div>
    </div>
  );
}

function Layout() {
  const location = useLocation();
  const isFullPage = location.pathname === '/proposta'
    || location.pathname.startsWith('/proposta/')
    || location.pathname === '/contrato'
    || location.pathname === '/mapa-conteudos'
    || location.pathname === '/crm'
    || location.pathname === '/portfolio/lucca';

  return (
    <div className="min-h-screen flex flex-col">
      {!isFullPage && <Navbar />}
      <div className="flex-grow">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/privacidade" element={<PrivacyPolicy />} />
            <Route path="/termos" element={<Terms />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/proposta" element={<Proposta />} />
            <Route path="/proposta/:planId" element={<PropostaPlan />} />
            <Route path="/contrato" element={<Contrato />} />
            <Route path="/mapa-conteudos" element={<MapaConteudos />} />
            <Route path="/crm" element={<CRM />} />
            <Route path="/portfolio/lucca" element={<PortfolioLucca />} />
          </Routes>
        </Suspense>
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
