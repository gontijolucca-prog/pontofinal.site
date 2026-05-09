import { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import VideoTooltip from '../components/VideoTooltip';
import { downloadPropostaPdf, downloadCustomPropostaPdf } from '../utils/generatePropostaPdf';

export default function Home() {
  const [formStatus, setFormStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [contactMethod, setContactMethod] = useState<'telefone' | 'email'>('telefone');
  
  // Custom Plan State
  const [customQuantities, setCustomQuantities] = useState({
    static: 0,
    carousel: 0,
    video: 0
  });
  const [customPlan, setCustomPlan] = useState<{total: number, static: number, carousel: number, video: number} | null>(null);

  const handleQuantityChange = (type: string, value: string) => {
    setCustomQuantities(prev => ({ ...prev, [type]: Math.max(0, parseInt(value) || 0) }));
  };

  const generateCustomPlan = () => {
    const total = (customQuantities.static * 5) + (customQuantities.carousel * 10) + (customQuantities.video * 20);
    if (total > 0) {
      setCustomPlan({ ...customQuantities, total });
    }
  };

  return (
    <main>
      {/* HERO */}
      <header className="hero section">
          <div className="container hero-content">
              <h1 className="hero-title">
                  O Seu Novo <span className="highlight">Website.</span> E as suas<br/>
                  <span className="highlight">Redes Sociais.</span><br/>
                  Num só lugar.
              </h1>
              <p className="hero-subtitle">Agência digital focada em resultados. Websites de alta performance e gestão de conteúdos para redes sociais. Cresça a sua marca sem dores de cabeça.</p>
              <div className="hero-cta">
                  <button onClick={() => document.getElementById('forms-section')?.scrollIntoView({ behavior: 'smooth' })} className="btn btn-primary btn-large">Começar Agora</button>
                  <button onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })} className="btn btn-secondary btn-large">Como Funciona ↓</button>
              </div>
              
              <div className="hero-stats">
                  <div className="stat-box">
                      <span className="stat-value">2<small>Dias</small></span>
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
              <h2 className="section-title text-white">Esqueça as Agências Tradicionais.<br/>Isto é Eficiência.</h2>
              <div className="grid-3">
                  <div className="brutal-card card-dark">
                      <div className="card-icon">01</div>
                      <h3 className="card-title">Tudo num Só Lugar</h3>
                      <p>Desde a criação do seu website até à publicação nas suas redes sociais. Centralize a sua presença digital com uma única equipa dedicada a fazê-lo crescer.</p>
                  </div>
                  <div className="brutal-card card-dark">
                      <div className="card-icon">02</div>
                      <h3 className="card-title">Presença que Gera Negócio</h3>
                      <p>O seu site nasce otimizado para o Google e as suas redes sociais focadas em construir comunidade. Não fazemos apenas design, criamos autoridade real.</p>
                  </div>
                  <div className="brutal-card card-dark">
                      <div className="card-icon">03</div>
                      <h3 className="card-title">Transparência Total</h3>
                      <p>Planos mensais claros sem orçamentos surpresa. Entregas ultra-rápidas, reuniões eficientes e foco naquilo que realmente importa: resultados.</p>
                  </div>
              </div>
          </div>
      </section>

      {/* PRICING */}
      <section id="pacotes" className="pricing section">
          <div className="container">
              <h2 className="section-title text-center">Planos Mensais.<br/>Transparência Total.</h2>
              <p className="section-subtitle text-center" style={{marginBottom: '4rem'}}>Sem propostas fechadas. O que vê é exatamente o que paga.</p>
              
               <h3 id="planos-conteudo" className="text-center" style={{fontSize: '2.5rem', marginTop: '2rem'}}>Planos de Produção de Conteúdo</h3>
               
                {/* Calculadora de Plano Customizado */}
                <div className="brutal-card" style={{ maxWidth: '1000px', margin: '0.5rem auto 2rem', padding: '0.5rem 1rem', border: '2px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label style={{ fontWeight: 700, fontSize: '0.8rem' }}>Estáticas</label>
                        <input 
                            type="number" 
                            style={{ 
                                width: '40px', 
                                fontSize: '1.2rem', 
                                fontWeight: 900, 
                                background: 'none', 
                                border: 'none', 
                                outline: 'none', 
                                textAlign: 'center', 
                                padding: 0,
                                appearance: 'textfield'
                            }} 
                            value={customQuantities.static} 
                            onChange={(e) => handleQuantityChange('static', e.target.value)}
                            min="0"
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label style={{ fontWeight: 700, fontSize: '0.8rem' }}>Carrosséis</label>
                        <input 
                            type="number" 
                            style={{ 
                                width: '40px', 
                                fontSize: '1.2rem', 
                                fontWeight: 900, 
                                background: 'none', 
                                border: 'none', 
                                outline: 'none', 
                                textAlign: 'center', 
                                padding: 0,
                                appearance: 'textfield'
                            }} 
                            value={customQuantities.carousel} 
                            onChange={(e) => handleQuantityChange('carousel', e.target.value)}
                            min="0"
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label style={{ fontWeight: 700, fontSize: '0.8rem' }}>Vídeos</label>
                        <input 
                            type="number" 
                            style={{ 
                                width: '40px', 
                                fontSize: '1.2rem', 
                                fontWeight: 900, 
                                background: 'none', 
                                border: 'none', 
                                outline: 'none', 
                                textAlign: 'center', 
                                padding: 0,
                                appearance: 'textfield'
                            }} 
                            value={customQuantities.video} 
                            onChange={(e) => handleQuantityChange('video', e.target.value)}
                            min="0"
                        />
                    </div>

                    <button onClick={generateCustomPlan} className="btn btn-primary" style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Gerar Plano Customizado</button>
                </div>

                <div className="pricing-grid" style={{marginBottom: '6rem'}}>
                    {customPlan && (
                        <div className="brutal-card pricing-card featured-pricing" style={{ position: 'relative', gridColumn: '2' }}>
                            <button 
                                onClick={() => setCustomPlan(null)} 
                                style={{ 
                                    position: 'absolute', 
                                    top: '10px', 
                                    left: '10px', 
                                    width: '21px', 
                                    height: '21px', 
                                    border: '2px solid black', 
                                    backgroundColor: 'white', 
                                    fontWeight: 900, 
                                    cursor: 'pointer', 
                                    zIndex: 10,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.7rem'
                                }}
                            >✕</button>
                            <div className="featured-badge">Plano Customizado</div>
                            <div className="pricing-header">
                                <h3>Personalizado</h3>
                                <div className="price anchored-price">
                                    <div className="new-price">
                                        <span>{customPlan.total}€/mês</span>
                                    </div>
                                </div>
                            </div>
                            <p className="pricing-desc"><strong>{customPlan.static + customPlan.carousel + customPlan.video} posts/mês</strong> configurados por si.</p>
                            <ul className="pricing-features">
                                {customPlan.static > 0 && <li>{customPlan.static} imagens estáticas por mês</li>}
                                {customPlan.carousel > 0 && <li>{customPlan.carousel} carrosséis por mês</li>}
                                {customPlan.video > 0 && <li>{customPlan.video} <VideoTooltip>vídeos</VideoTooltip> por mês</li>}
                                <li>Legendas incluídas</li>
                                <li>Planeamento básico de conteúdos</li>
                            </ul>
                            <button onClick={() => downloadCustomPropostaPdf({ static: customPlan.static, carousel: customPlan.carousel, video: customPlan.video }, customPlan.total)} className="btn btn-primary btn-full" style={{ marginBottom: '0.75rem' }}>💾 Guardar Proposta</button>
                            <button onClick={() => document.getElementById('forms-section')?.scrollIntoView({ behavior: 'smooth' })} className="btn btn-primary btn-full">Começar Agora</button>
                        </div>
                    )}

 
                    {!customPlan && (
                        <>
                           {/* Conteudo - Bronze */}
                           <div className="brutal-card pricing-card">
                               <div className="pricing-header">
                                   <h3>Bronze</h3>
                                   <div className="price anchored-price">
                                       <div className="new-price">
                                           <span>150€/mês</span>
                                       </div>
                                   </div>
                               </div>
                               <p className="pricing-desc"><strong>20 posts/mês</strong> ideal para manter uma presença ativa contínua.</p>
                               <ul className="pricing-features">
                                   <li>12 imagens estáticas por mês</li>
                                   <li>8 carrosséis por mês (até 5 slides cada)</li>
                                   <li>Legendas incluídas</li>
                               </ul>
                                <button onClick={() => downloadPropostaPdf('social-bronze')} className="btn btn-secondary btn-full" style={{ marginBottom: '0.75rem' }}>💾 Guardar Proposta</button>
                                <button onClick={() => document.getElementById('forms-section')?.scrollIntoView({ behavior: 'smooth' })} className="btn btn-secondary btn-full">Começar Agora</button>
                            </div>
                        
                            {/* Conteudo - Prata */}
                            <div className="brutal-card pricing-card featured-pricing">
                                <div className="featured-badge">Mais Escolhido</div>
                                <div className="pricing-header">
                                    <h3>Prata</h3>
                                    <div className="price anchored-price">
                                        <div className="new-price">
                                            <span>220€/mês</span>
                                        </div>
                                    </div>
                                </div>
                                <p className="pricing-desc"><strong>28 posts/mês</strong> para empresas que querem dominar o feed e o algoritmo.</p>
                                <ul className="pricing-features">
                                    <li>16 imagens estáticas por mês</li>
                                    <li>12 carrosséis por mês (até 8 slides cada)</li>
                                    <li>Legendas incluídas</li>
                                    <li>Planeamento mensal de conteúdos</li>
                                </ul>
                                <button onClick={() => downloadPropostaPdf('social-prata')} className="btn btn-primary btn-full" style={{ marginBottom: '0.75rem' }}>💾 Guardar Proposta</button>
                                <button onClick={() => document.getElementById('forms-section')?.scrollIntoView({ behavior: 'smooth' })} className="btn btn-primary btn-full">Começar Agora</button>
                            </div>
                        
                            {/* Conteudo - Ouro */}
                            <div className="brutal-card pricing-card bg-stripe">
                                <div className="pricing-header">
                                    <h3>Ouro</h3>
                                    <div className="price anchored-price">
                                        <div className="new-price">
                                            <span>350€/mês</span>
                                        </div>
                                    </div>
                                </div>
                                <p className="pricing-desc"><strong>40 posts/mês</strong> A estratégia máxima de conteúdo, com <VideoTooltip>vídeo</VideoTooltip> e análise.</p>
                                <ul className="pricing-features">
                                    <li>20 imagens estáticas por mês</li>
                                    <li>16 carrosséis por mês (até 10 slides cada)</li>
                                    <li>4 <VideoTooltip>vídeos</VideoTooltip> por mês</li>
                                    <li>Legendas incluídas</li>
                                    <li>Planeamento com estratégia de temas</li>
                                    <li>Análise de métricas do mês anterior</li>
                                    <li>1 Reunião de alinhamento criativo (30m)</li>
                                </ul>
                                <button onClick={() => downloadPropostaPdf('social-ouro')} className="btn btn-secondary btn-full" style={{ marginBottom: '0.75rem' }}>💾 Guardar Proposta</button>
                                <button onClick={() => document.getElementById('forms-section')?.scrollIntoView({ behavior: 'smooth' })} className="btn btn-secondary btn-full">Começar Agora</button>
                            </div>
                        </>
                    )}
                </div>




              <h3 id="planos-websites" className="text-center" style={{fontSize: '2.5rem', marginTop: '2rem'}}>Planos de Websites</h3>
              <div className="price-disclaimer">
                  <strong>Nota:</strong> Todos os planos de website requerem uma Taxa de Arranque única para configuração inicial e design. As manutenções incluem alojamento e segurança.
              </div>
              
              <div className="pricing-grid">
                  {/* Website - Bronze */}
                  <div className="brutal-card pricing-card">
                      <div className="pricing-header">
                          <h3>Bronze</h3>
                          <div className="price anchored-price">
                              <div className="new-price" style={{fontSize: '2rem'}}>
                                  <span>200€ (Arranque)</span>
                                  <span>+ 30€/mês (Manutenção)</span>
                              </div>
                          </div>
                      </div>
                      <div className="price-subtext special-offer smooth-bounce" style={{marginBottom: '1.5rem'}}>
                        <strong>OFERTA ESPECIAL:</strong> 1º Mês de Manutenção Grátis. A partir do 2º mês: 30€/mês.
                      </div>
                      <ul className="pricing-features">
                          <li>Website de 1 página</li>
                          <li>Design responsivo (telemóvel e PC)</li>
                          <li>Alojamento e segurança incluídos</li>
                       <li>1 atualização por mês</li>
                       </ul>
                       <button onClick={() => downloadPropostaPdf('web-bronze')} className="btn btn-secondary btn-full" style={{ marginBottom: '0.75rem' }}>💾 Guardar Proposta</button>
                       <button onClick={() => document.getElementById('forms-section')?.scrollIntoView({ behavior: 'smooth' })} className="btn btn-secondary btn-full">Começar Agora</button>
                   </div>

                   {/* Website - Prata */}
                   <div className="brutal-card pricing-card featured-pricing">
                       <div className="pricing-header">
                           <h3>Prata</h3>
                           <div className="price anchored-price">
                               <div className="new-price" style={{fontSize: '2rem'}}>
                                   <span>400€ (Arranque)</span>
                                   <span>+ 50€/mês (Manutenção)</span>
                               </div>
                           </div>
                       </div>
                       <div className="price-subtext special-offer smooth-bounce" style={{marginBottom: '1.5rem'}}>
                         <strong>OFERTA ESPECIAL:</strong> 1º Mês de Manutenção Grátis. A partir do 2º mês: 50€/mês.
                       </div>
                       <ul className="pricing-features">
                           <li>Website até 5 páginas</li>
                           <li>Design responsivo</li>
                           <li>Botão WhatsApp</li>
                           <li>Alojamento e segurança incluídos</li>
                           <li>2 atualizações por mês</li>
                       </ul>
                       <button onClick={() => downloadPropostaPdf('web-prata')} className="btn btn-primary btn-full" style={{ marginBottom: '0.75rem' }}>💾 Guardar Proposta</button>
                       <button onClick={() => document.getElementById('forms-section')?.scrollIntoView({ behavior: 'smooth' })} className="btn btn-primary btn-full">Começar Agora</button>
                   </div>

                   {/* Website - Ouro */}
                   <div className="brutal-card pricing-card bg-stripe">
                       <div className="pricing-header">
                           <h3>Ouro</h3>
                           <div className="price anchored-price">
                               <div className="new-price" style={{fontSize: '2rem'}}>
                                   <span>700€ (Arranque)</span>
                                   <span>+ 80€/mês (Manutenção)</span>
                               </div>
                           </div>
                       </div>
                       <div className="price-subtext special-offer smooth-bounce" style={{marginBottom: '1.5rem'}}>
                         <strong>OFERTA ESPECIAL:</strong> 1º Mês de Manutenção Grátis. A partir do 2º mês: 80€/mês.
                       </div>
                       <ul className="pricing-features">
                           <li>Tudo o que o Prata inclui</li>
                           <li>Criação de ferramentas web / internas</li>
                           <li>Estatísticas de visitas</li>
                           <li>Suporte prioritário</li>
                           <li>Alojamento e segurança incluídos</li>
                           <li>4 atualizações por mês</li>
                       </ul>
                       <button onClick={() => downloadPropostaPdf('web-ouro')} className="btn btn-secondary btn-full" style={{ marginBottom: '0.75rem' }}>💾 Guardar Proposta</button>
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
                      <p>O seu tempo é dinheiro. O nosso modelo ágil permite que lance o seu website premium ou inicie a gestão das suas redes sociais de forma rápida e eficiente.</p>
                  </div>
                  <div className="process-steps">
                      <div className="step-card brutal-card">
                          <div className="step-number">1. Os Planos</div>
                          <p>Escolhe o plano de Website e/o de Redes Sociais (<button onClick={() => document.getElementById('forms-section')?.scrollIntoView({ behavior: 'smooth' })} style={{ textDecoration: 'underline', background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0 }}>abaixo</button>) adequados ao seu projeto local.</p>
                      </div>
                      <div className="step-card brutal-card">
                          <div className="step-number">2. O Formulário de Briefing</div>
                          <p>Preenche o formulário detalhado na secção abaixo. O nosso arranque é baseado num briefing direto para obter logo a sua essência.</p>
                      </div>
                      <div className="step-card brutal-card">
                          <div className="step-number">3. Arranque Imediato</div>
                          <p>Recebe o link seguro para efetuar o pagamento. Iniciamos o planeamento das redes ou a construção do site imediatamente após validação.</p>
                      </div>
                      <div className="step-card brutal-card">
                          <div className="step-number bg-red text-white">4. Em Poucos Dias a Funcionar</div>
                          <p>A nossa equipa opera cirurgicamente para que tenha o website e a máquina de conteúdo no ar num espaço de dias.</p>
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
                                  <label htmlFor="call-plano">Que serviços lhe interessam?</label>
                                  <select id="call-plano" name="plano_interesse" className="brutal-input" required defaultValue="">
                                      <option value="" disabled>Escolher uma opção...</option>
                                      <option value="web-bronze">Websites: Plano Bronze</option>
                                      <option value="web-prata">Websites: Plano Prata</option>
                                      <option value="web-ouro">Websites: Plano Ouro</option>
                                      <option value="social-bronze">Conteúdos: Plano Bronze</option>
                                      <option value="social-prata">Conteúdos: Plano Prata</option>
                                      <option value="social-ouro">Conteúdos: Plano Ouro</option>
                                      <option value="ambos">Ambos (Website e Conteúdos)</option>
                                      <option value="indeciso">Ainda não sei, quero falar convosco</option>
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
                                  <label htmlFor="call-descricao">Breve descrição do seu projeto</label>
                                  <textarea
                                      id="call-descricao"
                                      name="descricao"
                                      className="brutal-input textarea"
                                      placeholder="Ex: Preciso de um website para o meu negócio local e gestão de redes sociais..."
                                      rows={2}
                                      style={{ minHeight: '3.5rem', resize: 'vertical' }}
                                  />
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
