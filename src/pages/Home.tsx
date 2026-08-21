import { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

export default function Home() {
  const [formStatus, setFormStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [contactMethod, setContactMethod] = useState<'telefone' | 'email'>('telefone');
  
  return (
    <main>
      {/* HERO */}
      <header className="hero section blueprint-grid">
          <div className="container hero-content">
              <span className="hero-badge"><span className="badge-num">//</span> PONTOFINAL · FERRAMENTAS DE IA</span>
              <h1 className="hero-title">
                  Automatiza o trabalho repetitivo<br/>do teu negócio. <span className="highlight">Com IA.</span>
              </h1>
              <p className="hero-subtitle">Construímos ferramentas de inteligência artificial <strong>feitas à medida</strong> do teu negócio — agentes, automações e ferramentas internas que trabalham por ti, 24/7, sem dores de cabeça.</p>
              <div className="hero-cta">
                  <button onClick={() => document.getElementById('forms-section')?.scrollIntoView({ behavior: 'smooth' })} className="btn btn-primary btn-large">Pedir Diagnóstico Gratuito →</button>
                  <button onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })} className="btn btn-secondary btn-large">Como Funciona ↓</button>
              </div>
              
              <div className="hero-stats">
                  <div className="stat-box">
                      <span className="stat-value">-50<span className="stat-suffix">%</span></span>
                      <span className="stat-label">Tarefas Manuais Eliminadas</span>
                  </div>
                  <div className="stat-box">
                      <span className="stat-value">24<small>/7</small></span>
                      <span className="stat-label">A Trabalhar por Ti</span>
                  </div>
                  <div className="stat-box">
                      <span className="stat-value">100<small>%</small></span>
                      <span className="stat-label">Feito à Medida</span>
                  </div>
              </div>
          </div>
      </header>

      {/* SPEC BAND */}
      <section className="section" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
          <div className="container">
              <div className="spec-band">
                  <div className="spec-item"><span className="spec-key">Projeto</span><span className="spec-val">À medida, não em caixa</span></div>
                  <div className="spec-item"><span className="spec-key">Integração</span><span className="spec-val">Com as tuas ferramentas</span></div>
                  <div className="spec-item"><span className="spec-key">Operação</span><span className="spec-val">24/7 · autónomo</span></div>
                  <div className="spec-item"><span className="spec-key">Suporte</span><span className="spec-val">Manutenção incluída</span></div>
              </div>
          </div>
      </section>

      {/* SERVICES */}
      <section id="servicos" className="why-us section bg-dark">
          <div className="container">
              <span className="hero-badge" style={{ marginBottom: '1.5rem' }}><span className="badge-num">01</span> O QUE CONSTRUÍMOS</span>
              <h2 className="section-title text-white">Ferramentas de IA que eliminam trabalho manual do teu dia-a-dia.</h2>
              <div className="grid-3">
                  <div className="brutal-card card-dark corner-notch">
                      <div className="card-icon">01 // AGENTES</div>
                      <h3 className="card-title">Agentes de IA</h3>
                      <p className="card-desc">Assistentes virtuais que respondem, qualificam e agendam clientes no teu site e WhatsApp, 24/7, sem precisar de ti.</p>
                  </div>
                  <div className="brutal-card card-dark corner-notch">
                      <div className="card-icon">02 // AUTOMAÇÃO</div>
                      <h3 className="card-title">Automação de Processos</h3>
                      <p className="card-desc">Fluxos que ligam as tuas ferramentas e fazem sozinhos as tarefas repetitivas: relatórios, follow-ups, triagem de pedidos, integrações.</p>
                  </div>
                  <div className="brutal-card card-dark corner-notch">
                      <div className="card-icon">03 // SOB MEDIDA</div>
                      <h3 className="card-title">Ferramentas Internas</h3>
                      <p className="card-desc">Painéis, CRMs e geradores construídos à medida do teu caso — resolvem o teu problema específico, não uma solução genérica.</p>
                  </div>
              </div>
          </div>
      </section>

      {/* PRICING — por consulta */}
      <section id="orcamento" className="pricing section bg-dark">
          <div className="container">
              <span className="hero-badge" style={{ marginBottom: '1.5rem' }}><span className="badge-num">02</span> MODELO</span>
              <h2 className="section-title text-white">Preços por consulta.<br/>Cada projeto é único.</h2>
              <p className="section-subtitle" style={{ marginBottom: '3rem' }}>Não temos pacotes fechados. Cada ferramenta de IA é orçamentada à medida do teu caso, depois de um diagnóstico gratuito. Pagas só pelo que precisas.</p>

              <div className="grid-3">
                   <div className="brutal-card card-dark corner-notch">
                       <div className="card-icon">01 // DIAGNÓSTICO</div>
                       <h3 className="card-title">Gratuito</h3>
                       <p className="card-desc">Analisamos o teu negócio e vemos o que pode ser automatizado — sem qualquer custo ou compromisso.</p>
                   </div>
                   <div className="brutal-card card-dark corner-notch">
                       <div className="card-icon">02 // ORÇAMENTO</div>
                       <h3 className="card-title">À Medida</h3>
                       <p className="card-desc">Cada projeto é cotado pelo seu âmbito real. Sem pacotes fechados, sem pagares pelo que não precisas.</p>
                   </div>
                   <div className="brutal-card card-dark corner-notch">
                       <div className="card-icon">03 // CONTRATO</div>
                       <h3 className="card-title">Sem Surpresas</h3>
                       <p className="card-desc">O que acordamos no orçamento é exatamente o que pagas. Transparência do início ao fim.</p>
                   </div>
              </div>

              <div className="final-cta-buttons" style={{ marginTop: '3.5rem', justifyContent: 'flex-start' }}>
                  <button onClick={() => document.getElementById('forms-section')?.scrollIntoView({ behavior: 'smooth' })} className="btn btn-primary btn-large">Pedir Orçamento Gratuito →</button>
              </div>
          </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="como-funciona" className="process section bg-light border-top-thick">
          <div className="container">
              <div className="process-wrapper">
                  <div className="process-text">
                      <span className="hero-badge" style={{ marginBottom: '1.5rem' }}><span className="badge-num">03</span> PROCESSO</span>
                      <h2 className="section-title">Da ideia à ferramenta a funcionar. Sem fricção.</h2>
                      <p>Processo ágil e transparente. Diagnóstico, desenho e construção em poucas semanas — para a tua ferramenta trabalhar o quanto antes.</p>
                  </div>
                  <div className="process-steps">
                      <div className="step-card brutal-card">
                          <div className="step-number"><span className="step-idx">1.</span> Diagnóstico</div>
                          <p>Falamos do teu negócio e identificamos o que pode ser automatizado e quanto tempo poupa.</p>
                      </div>
                      <div className="step-card brutal-card">
                          <div className="step-number"><span className="step-idx">2.</span> Desenho da Ferramenta</div>
                          <p>Definimos a solução exata: o âmbito, as integrações e o modelo de preço à medida.</p>
                      </div>
                      <div className="step-card brutal-card">
                          <div className="step-number"><span className="step-idx">3.</span> Construção & Integração</div>
                          <p>Construímos e ligamos a tua ferramenta às tuas ferramentas atuais. Testamos contigo.</p>
                      </div>
                      <div className="step-card brutal-card bg-cobalt">
                          <div className="step-number"><span className="step-idx">4.</span> Lançamento & Manutenção</div>
                          <p>Põe-se a trabalhar 24/7. Fazemos a manutenção, atualizações e suporte.</p>
                      </div>
                  </div>
              </div>
          </div>
      </section>

      {/* FORMS SECTION */}
      <section id="forms-section" className="forms-section section">
          <div className="container">
              <span className="hero-badge" style={{ marginBottom: '1.5rem' }}><span className="badge-num">04</span> CONTACTO</span>
              <h2 className="section-title text-center">Vamos automatizar o teu negócio?<br/><span className="highlight red">Pede um diagnóstico gratuito.</span></h2>
              
              <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                  
                  {/* Formulário: Agendar Chamada */}
                  <div className="brutal-card form-card">
                      <div className="form-header">
                          <h3>Diagnóstico gratuito</h3>
                          <p>Conta-nos o teu caso e identificamos o que a IA pode automatizar no teu negócio.</p>
                      </div>
                      
                      {formStatus?.type === 'success' ? (
                          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
                              <h3 style={{ fontSize: '1.5rem', marginBottom: '2rem', lineHeight: '1.4' }}>
                                  Recebemos o teu pedido. Vamos entrar em contacto o mais breve possível.<br/>Obrigado!
                              </h3>
                              <button 
                                  type="button" 
                                  onClick={() => {
                                      setFormStatus(null);
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }} 
                                  className="btn btn-secondary"
                              >
                                  Voltar ao início
                              </button>
                          </div>
                      ) : (
                          <form onSubmit={async (e) => {
                              e.preventDefault();
                              setFormStatus(null);
                              const formData = new FormData(e.currentTarget);
                              const data = Object.fromEntries(formData.entries());
                              
                              try {
                                  const payload = { ...data, date: new Date().toISOString() };
                                  await addDoc(collection(db, 'submissions'), payload);
                                  // Notificação por email (best-effort): não bloqueia nem falha o formulário.
                                  fetch('/api/notify', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify(payload)
                                  }).catch(() => {});
                                  setFormStatus({ type: 'success', message: 'Sucesso' });
                              } catch (err) {
                                  console.error(err);
                                  setFormStatus({ type: 'error', message: 'Erro ao enviar o formulário. Tente novamente.' });
                              }
                          }} className="brutal-form">
                              
                              {formStatus?.type === 'error' && (
                                  <div style={{
                                      padding: '1rem',
                                      backgroundColor: '#f8d7da',
                                      color: '#721c24',
                                      border: '2px solid #f5c6cb',
                                      marginBottom: '1rem',
                                      fontWeight: 'bold'
                                  }}>
                                      {formStatus.message}
                                  </div>
                              )}

                              <div className="form-group">
                                  <label htmlFor="call-plano">Que solução de IA lhe interessa?</label>
                                  <select id="call-plano" name="plano_interesse" className="brutal-input" required defaultValue="">
                                      <option value="" disabled>Escolher uma opção...</option>
                                      <option value="ai-assistente">Assistente (agente de IA)</option>
                                      <option value="ai-automacao">Automação de processos</option>
                                      <option value="ai-sobmedida">Ferramenta sob medida</option>
                                      <option value="indeciso">Ainda não sei, quero um diagnóstico</option>
                                  </select>
                              </div>

                              <div className="form-group">
                                  <label htmlFor="call-nome">Nome e Empresa</label>
                                  <input type="text" id="call-nome" name="nome_empresa" className="brutal-input" placeholder="Ex: João Silva - Oficina Auto João" required />
                              </div>
                              
                              {/* Método de contacto */}
                              <div className="form-group">
                                  <label>Prefere ser contactado por:</label>
                                  <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.3rem' }}>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
                                          <input
                                              type="radio"
                                              name="contacto_metodo"
                                              value="telefone"
                                              checked={contactMethod === 'telefone'}
                                              onChange={() => setContactMethod('telefone')}
                                              style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
                                          />
                                          📞 Telefone
                                      </label>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
                                          <input
                                              type="radio"
                                              name="contacto_metodo"
                                              value="email"
                                              checked={contactMethod === 'email'}
                                              onChange={() => setContactMethod('email')}
                                              style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
                                          />
                                          ✉️ E-mail
                                      </label>
                                  </div>
                              </div>

                              <div className="form-group">
                                  {contactMethod === 'telefone' ? (
                                      <>
                                          <label htmlFor="call-telefone">Telefone/WhatsApp</label>
                                          <input type="tel" id="call-telefone" name="contacto_valor" className="brutal-input" placeholder="Ex: +351 912 345 678" required />
                                      </>
                                  ) : (
                                      <>
                                          <label htmlFor="call-email">E-mail</label>
                                          <input type="email" id="call-email" name="contacto_valor" className="brutal-input" placeholder="Ex: joao@exemplo.pt" required />
                                      </>
                                  )}
                              </div>

                              {/* Breve descrição */}
                              <div className="form-group">
                                  <label htmlFor="call-descricao">Breve descrição do seu negócio</label>
                                  <textarea
                                      id="call-descricao"
                                      name="descricao"
                                      className="brutal-input textarea"
                                      placeholder="Ex: Somos uma oficina e perdemos tempo a responder a pedidos de orçamento..."
                                      rows={2}
                                      style={{ minHeight: '3.5rem', resize: 'vertical' }}
                                  />
                              </div>
                              
                              {/* Anti-spam hidden field */}
                              <input type="checkbox" name="botcheck" className="hidden" style={{ display: 'none' }} />
                              
                              <button type="submit" className="btn btn-primary btn-full form-submit">Pedir Diagnóstico Gratuito</button>
                          </form>
                      )}
                  </div>

              </div>
          </div>
      </section>
    </main>
  );
}
