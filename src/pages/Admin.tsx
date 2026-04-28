import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { Link, useNavigate } from 'react-router-dom';

interface Submission {
  id: string;
  date: string;
  plano_interesse: string;
  nome_empresa: string;
  telefone: string;
}

const dropdownGroups = [
  {
    label: 'WEB',
    items: [
      { label: 'Web Bronze', path: '/proposta/web-bronze' },
      { label: 'Web Prata', path: '/proposta/web-prata' },
      { label: 'Web Ouro', path: '/proposta/web-ouro' },
    ],
  },
  {
    label: 'REDES SOCIAIS',
    items: [
      { label: 'Social Bronze', path: '/proposta/social-bronze' },
      { label: 'Social Prata', path: '/proposta/social-prata' },
      { label: 'Social Ouro', path: '/proposta/social-ouro' },
    ],
  },
  {
    label: 'OUTRO',
    items: [
      { label: 'Proposta Customizada v2', path: '/proposta' },
      { label: 'Contrato', path: '/contrato' },
    ],
  },
];

export default function Admin() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
        
        // Listen to submissions
        const q = query(collection(db, 'submissions'), orderBy('date', 'desc'));
        const unsubscribeDb = onSnapshot(q, (snapshot) => {
          const subs: Submission[] = [];
          snapshot.forEach((doc) => {
            subs.push({ id: doc.id, ...doc.data() } as Submission);
          });
          setSubmissions(subs);
          setLoading(false);
        }, (err) => {
          console.error(err);
          setError('Sem permissão para ver os dados ou erro de conexão.');
          setLoading(false);
        });

        return () => unsubscribeDb();
      } else {
        setIsAuthenticated(false);
        setSubmissions([]);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      // Utilizamos um email fixo nos bastidores para permitir o login apenas com palavra-passe
      await signInWithEmailAndPassword(auth, 'admin@pontofinal.com', password);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Palavra-passe incorreta.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('O login por Email/Palavra-passe não está ativado no Firebase.');
      } else {
        setError('Erro ao iniciar sessão. Verifique a configuração.');
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setPassword('');
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'submissions', id));
    } catch (err) {
      console.error(err);
      setError('Erro ao apagar.');
    }
  };

  if (loading && !isAuthenticated) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>A carregar...</div>;
  }

  if (!isAuthenticated) {
    return (
      <main className="section bg-light" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="brutal-card" style={{ maxWidth: '400px', width: '100%' }}>
          <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Acesso Restrito</h2>
          <form onSubmit={handleLogin} className="brutal-form">
            <div className="form-group">
              <label htmlFor="password">Palavra-passe</label>
              <input 
                type="password" 
                id="password" 
                className="brutal-input" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Introduza a palavra-passe"
              />
            </div>
            {error && <p style={{ color: 'red', fontWeight: 'bold', marginBottom: '1rem' }}>{error}</p>}
            <button type="submit" className="btn btn-primary btn-full">Entrar</button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="section bg-light" style={{ minHeight: '80vh' }}>
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 className="hero-title" style={{ fontSize: '2.5rem', margin: 0 }}>Administração</h1>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                Ver Proposta <span style={{ fontSize: '0.75rem' }}>▾</span>
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
                  {dropdownGroups.map((group) => (
                    <div key={group.label}>
                      <div style={{
                        padding: '0.4rem 1rem',
                        fontSize: '0.65rem',
                        fontWeight: 900,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: '#FF2A2A',
                        borderBottom: '2px solid #050505',
                        background: '#F0F0F0',
                      }}>
                        {group.label}
                      </div>
                      {group.items.map((item) => (
                        <button
                          key={item.path}
                          onClick={() => { setDropdownOpen(false); navigate(item.path); }}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            padding: '0.6rem 1rem',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid #e0e0e0',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            color: '#050505',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#F0F0F0')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={handleLogout} className="btn btn-secondary">Sair</button>
          </div>
        </div>

        <div className="brutal-card" style={{ overflowX: 'auto' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Respostas do Formulário ({submissions.length})</h3>
          
          {error && <p style={{ color: 'red', fontWeight: 'bold', marginBottom: '1rem' }}>{error}</p>}

          {loading ? (
            <p>A carregar dados...</p>
          ) : submissions.length === 0 ? (
            <p>Nenhuma resposta encontrada.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '4px solid #050505' }}>
                  <th style={{ padding: '1rem', fontWeight: 900 }}>Data</th>
                  <th style={{ padding: '1rem', fontWeight: 900 }}>Nome / Empresa</th>
                  <th style={{ padding: '1rem', fontWeight: 900 }}>Telefone</th>
                  <th style={{ padding: '1rem', fontWeight: 900 }}>Plano</th>
                  <th style={{ padding: '1rem', fontWeight: 900 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => (
                  <tr key={sub.id} style={{ borderBottom: '2px solid #050505' }}>
                    <td style={{ padding: '1rem' }}>{new Date(sub.date).toLocaleString('pt-PT')}</td>
                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>{sub.nome_empresa}</td>
                    <td style={{ padding: '1rem' }}>{sub.telefone}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        background: '#FF2A2A', 
                        color: 'white', 
                        padding: '0.2rem 0.5rem', 
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        fontSize: '0.8rem'
                      }}>
                        {sub.plano_interesse}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <button 
                        onClick={() => handleDelete(sub.id)}
                        style={{
                          background: 'transparent',
                          border: '2px solid #050505',
                          padding: '0.5rem 1rem',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        Apagar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
