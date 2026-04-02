import { useState } from 'react';

import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

export default function Home() {
  const [formStatus, setFormStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  return (
    <main>
      {/* HERO */}
      <header className="hero section">
          <div className="container hero-content">
              <h1 className="hero-title">
                  O Seu Novo Website.<br/>
                  <span className="highlight">Sem Enrolações.</span><br/>
                  Sem Orçamentos Surpresa.
              </h1>
              <p className="hero-subtitle">Websites de alta performance para empresas locais. Pague pelo resultado, não pela dor de cabeça.</p>
              <div className="hero-cta">
                  <button onClick={() => document.getElementById('forms-section')?.scrollIntoView({ behavior: 'smooth' })} className="btn btn-primary btn-large">Começar Agora</button>
                  <button onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })} className="btn btn-secondary btn-large">Como Funciona ↓</button>
              </div>
              
              <div className="hero-stats">
                  <div className="stat-box">
                      <span className="stat-value">5<small>Dias</small></span>
                      <span className="stat-label">Tempo Médio Entrega</span>
                  </div>
                  <div className="stat-box">
                      <span className="stat-value">100<small>%</small></span>
                      <span className="stat-label">Design Responsivo</span>
                  </div>
                  <div className="stat-box">
                      <span className="stat-value">∞</span>
                      <span className="stat-label">Hosting & Suporte</span>
                  </div>
              </div>
          </div>
      </header>

      {/* WHY US */}
      <section id="why-us" className="why-us section bg-dark">
          <div className="container">
              <h2 className="section-title text-white">Esqueça o Mercado Tradicional.<br/>Isto é Eficiência.</h2>
              <div className="grid-3">
                  <div className="brutal-card card-dark">
                      <div className="card-icon">01</div>
                      <h3 className="card-title">Custo-Benefício Disruptivo</h3>
                      <p>Websites premium com modelo de subscrição mensal. Sem investimentos gigantescos iniciais. Nós otimizamos o seu digital, o seu negócio cresce.</p>
                  </div>
                  <div className="brutal-card card-dark">
                      <div className="card-icon">02</div>
                      <h3 className="card-title">SEO Premium Incluído</h3>
                      <p>O seu site não vai ser apenas bonito. Ele nasce otimizado para a pesquisa do Google de raiz. Visibilidade que gera negócio real.</p>
                  </div>
                  <div className="brutal-card card-dark">
                      <div className="card-icon">03</div>
                      <h3 className="card-title">Entrega Ultra-Rápida</h3>
                      <p>Processos padronizados significam zero atrasos. Entregamos plataformas robustas em apenas 5 dias úteis, não em meses.</p>
                  </div>
              </div>
          </div>
      </section>

      {/* PRICING */}
      <section id="pacotes" className="pricing section">
          <div className="container">
              <h2 className="section-title text-center">Planos Mensais. Transparência Total.</h2>
              <p className="section-subtitle text-center">Sem propostas fechadas. O que vê é exatamente o que paga.</p>
              
              <div className="price-disclaimer">
                  <strong>Nota:</strong> Todos os planos requerem uma Taxa de Ativação (Setup Fee) única de 50€ para configuração inicial e design.
              </div>
              
              <div className="pricing-grid">
                  {/* Pacote 1 */}
                  <div className="brutal-card pricing-card">
                      <div className="pricing-header">
                          <h3>Bronze</h3>
                          <div className="price anchored-price">
                              <div className="new-price">
                                  <span>50€ (Arranque) + 20€/mês</span>
                                  <small className="today-badge">Hoje</small>
                              </div>
                          </div>
                      </div>
                      <div className="price-subtext special-offer smooth-bounce">
                        <strong>OFERTA ESPECIAL:</strong> 1º Mês de Manutenção Grátis. A partir do 2º mês: 20€/mês.
                      </div>
                      <p className="pricing-desc">O arrranque perfeito para colocar o seu negócio online com profissionalismo e sem distrações.</p>
                      <ul className="pricing-features">
                          <li>Website de 1 Página (Direto ao assunto)</li>
                          <li>Preparação Básica para o Google</li>
                          <li>Funciona na perfeição em Telemóveis e PCs</li>
                          <li>Alojamento e Segurança incluídos</li>
                          <li>1 Atualização de textos/fotos a cada 3 meses (Trimestral)</li>
                      </ul>
                      <button onClick={() => document.getElementById('forms-section')?.scrollIntoView({ behavior: 'smooth' })} className="btn btn-secondary btn-full">Começar Agora</button>
                  </div>

                  {/* Pacote 2 */}
                  <div className="brutal-card pricing-card featured-pricing">
                      <div className="featured-badge">Mais Escolhido</div>
                      <div className="pricing-header">
                          <h3>Prata</h3>
                          <div className="price anchored-price">
                              <div className="new-price">
                                  <span>50€ (Arranque) + 40€/mês</span>
                                  <small className="today-badge">Hoje</small>
                              </div>
                          </div>
                      </div>
                      <div className="price-subtext special-offer smooth-bounce">
                        <strong>OFERTA ESPECIAL:</strong> 1º Mês de Manutenção Grátis. A partir do 2º mês: 40€/mês.
                      </div>
                      <p className="pricing-desc">A "Máquina de Clientes". Para empresas estabelecidas que precisam de autoridade digital severa.</p>
                      <ul className="pricing-features">
                          <li>Website Completo (Até 5 páginas)</li>
                          <li>Destaque nas Pesquisas da sua Cidade (SEO Local)</li>
                          <li>Botão de WhatsApp Direto para orçamentos</li>
                          <li>Alojamento e Segurança incluídos</li>
                          <li>1 Atualização de textos/fotos a cada 2 meses (Bimensal)</li>
                      </ul>
                      <button onClick={() => document.getElementById('forms-section')?.scrollIntoView({ behavior: 'smooth' })} className="btn btn-primary btn-full">Começar Agora</button>
                  </div>

                  {/* Pacote 3 */}
                  <div className="brutal-card pricing-card bg-stripe">
                      <div className="pricing-header">
                          <h3>Ouro</h3>
                          <div className="price anchored-price">
                              <div className="new-price">
                                  <span>50€ (Arranque) + 60€/mês</span>
                                  <small className="today-badge">Hoje</small>
                              </div>
                          </div>
                      </div>
                      <div className="price-subtext special-offer smooth-bounce">
                        <strong>OFERTA ESPECIAL:</strong> 1º Mês de Manutenção Grátis. A partir do 2º mês: 60€/mês.
                      </div>
                      <p className="pricing-desc">Dominância Local total. O pacote supremo para captar o seu mercado alvo local de raiz.</p>
                      <ul className="pricing-features">
                          <li>Tudo o que o plano Prata tem +</li>
                          <li>Integração de Estatísticas (Saiba quem visita o seu site)</li>
                          <li>Prioridade Máxima no nosso Suporte</li>
                          <li>Alojamento e Segurança incluídos</li>
                          <li>1 Atualização de textos/fotos todos os meses (Mensal)</li>
                      </ul>
                      <button onClick={() => document.getElementById('forms-section')?.scrollIntoView({ behavior: 'smooth' })} className="btn btn-secondary btn-full">Começar Agora</button>
                  </div>
              </div>
          </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="como-funciona" className="process section bg-light border-top-thick">
          <div className="container">
              <div className="process-wrapper">
                  <div className="process-text">
                      <h2 className="section-title">Sem Reuniões Intermináveis. Processo Fricção-Zero.</h2>
                      <p>O seu tempo é dinheiro. O nosso modelo assíncrono permite que tenha um website premium online sem desperdiçar horas a aprovar maquetes sem sentido.</p>
                  </div>
                  <div className="process-steps">
                      <div className="step-card brutal-card">
                          <div className="step-number">1. O Plano</div>
                          <p>Escolhe o plano (<button onClick={() => document.getElementById('forms-section')?.scrollIntoView({ behavior: 'smooth' })} style={{ textDecoration: 'underline', background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0 }}>abaixo</button>) que faz sentido para o atual momento do seu negócio local.</p>
                      </div>
                      <div className="step-card brutal-card">
                          <div className="step-number">2. O Formulário de Briefing</div>
                          <p>Preenche o formulário detalhado na secção abaixo. É através do briefing de arranque que obtemos todos os dados.</p>
                      </div>
                      <div className="step-card brutal-card">
                          <div className="step-number">3. Ativação Rápida</div>
                          <p>Recebe o link seguro para pagar a Taxa de Ativação (50€). Após o pagamento, o relógio dos 5 dias começa a contar.</p>
                      </div>
                      <div className="step-card brutal-card">
                          <div className="step-number bg-red text-white">4. Lançamento em 5 Dias</div>
                          <p>A nossa equipa opera cirurgicamente. Em 5 dias úteis, tem a máquina de clientes live no seu domínio.</p>
                      </div>
                  </div>
              </div>
          </div>
      </section>

      {/* FORMS SECTION */}
      <section id="forms-section" className="forms-section section">
          <div className="container">
              <h2 className="section-title text-center">Pronto para a Ação?<br/><span className="highlight">Escolha o seu Caminho.</span></h2>
              
              <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                  
                  {/* Formulário: Agendar Chamada */}
                  <div className="brutal-card form-card">
                      <div className="form-header">
                          <h3>Pronto para começar?</h3>
                          <p>Preencha os dados abaixo e entraremos em contacto para alinhar o seu projeto.</p>
                      </div>
                      
                      {formStatus?.type === 'success' ? (
                          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
                              <h3 style={{ fontSize: '1.5rem', marginBottom: '2rem', lineHeight: '1.4' }}>
                                  A nossa equipa vai entrar em contacto o mais breve possível.<br/>Obrigado!
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
                                  await addDoc(collection(db, 'submissions'), {
                                      ...data,
                                      date: new Date().toISOString()
                                  });
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
                                  <label htmlFor="call-plano">Qual plano lhe interessa?</label>
                                  <select id="call-plano" name="plano_interesse" className="brutal-input" required defaultValue="">
                                      <option value="" disabled>Escolher um plano...</option>
                                      <option value="bronze">Plano Bronze</option>
                                      <option value="prata">Plano Prata</option>
                                      <option value="ouro">Plano Ouro</option>
                                      <option value="indeciso">Ainda não sei</option>
                                  </select>
                              </div>

                              <div className="form-group">
                                  <label htmlFor="call-nome">Nome e Empresa</label>
                                  <input type="text" id="call-nome" name="nome_empresa" className="brutal-input" placeholder="Ex: João Silva - Oficina Auto João" required />
                              </div>
                              
                              <div className="form-group">
                                  <label htmlFor="call-telefone">Telefone/WhatsApp</label>
                                  <input type="tel" id="call-telefone" name="telefone" className="brutal-input" placeholder="Ex: +351 912 345 678" required />
                              </div>
                              
                              {/* Anti-spam hidden field */}
                              <input type="checkbox" name="botcheck" className="hidden" style={{ display: 'none' }} />
                              
                              <button type="submit" className="btn btn-primary btn-full form-submit">Pedir Contacto</button>
                          </form>
                      )}
                  </div>

              </div>
          </div>
      </section>
    </main>
  );
}
