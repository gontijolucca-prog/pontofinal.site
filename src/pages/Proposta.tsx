import React from 'react';

export default function Proposta() {
  return (
    <div className="a4-container">
      <div className="a4-page brutal-card-static">
        <header className="proposta-header shrink-0">
          <h1 className="proposta-title">PROPOSTA DE SERVIÇOS</h1>
          <p className="proposta-subtitle">Gestão de Redes Sociais</p>
        </header>

        <section className="proposta-section flex-grow flex flex-col pt-6 pb-4 min-h-0">
          <h2 className="section-title text-2xl font-bold border-b-4 border-black pb-2 mb-4 shrink-0">Plano: Customizado</h2>
          
          <div className="flex flex-col gap-4 flex-grow justify-center min-h-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center shrink-0">
              <div className="proposta-details">
                <h3 className="font-bold text-xl mb-3">O que está incluído:</h3>
                <ul className="pricing-features mb-0" style={{ fontSize: '0.90rem' }}>
                  <li><strong>2 Vídeos</strong> (Reels/TikTok/Shorts) com edição dinâmica</li>
                  <li><strong>4 Carrosséis</strong> (até 10 slides cada) de alto valor</li>
                  <li>Legendas persuasivas e pesquisa de hashtags</li>
                  <li>Planeamento de conteúdo mensal</li>
                  <li>Design de acordo com a identidade da marca</li>
                </ul>
              </div>

              <div className="proposta-pricing flex flex-col justify-center shrink-0">
                <div className="brutal-card-static text-center p-5 bg-yellow-400 border-4 border-black" style={{ boxShadow: '4px 4px 0px 0px #000' }}>
                  <h3 className="font-bold text-lg mb-2">Investimento Mensal</h3>
                  <div className="price anchored-price justify-center my-3">
                    <div className="new-price text-4xl items-center" style={{ animation: 'none' }}>
                      <span>60€</span>
                    </div>
                  </div>
                  <p className="text-xs font-semibold">Sem fidelização forçada. Pagamento mensal.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch shrink-0">
              <div className="brutal-card-static card-dark p-4 flex flex-col justify-center">
                <h3 className="font-bold text-base mb-1 text-white">Objetivo</h3>
                <p className="text-gray-300 text-xs">
                  Criar conteúdo focado em autoridade e engagement, combinando o formato dinâmico do vídeo para alcance e o formato educativo/narrativo do carrossel para fidelização da audiência.
                </p>
              </div>

              <div className="brutal-card-static p-4 bg-white flex flex-col justify-center" style={{ borderColor: 'var(--color-primary)', boxShadow: '4px 4px 0px 0px var(--color-primary)' }}>
                <h4 className="font-bold text-lg mb-1.5">Próximos Passos:</h4>
                <ol className="list-decimal list-inside space-y-1.5 font-medium text-sm">
                  <li>Aprovação da proposta</li>
                  <li>Reunião de alinhamento / Briefing</li>
                  <li>Início do planeamento de conteúdos</li>
                </ol>
              </div>
            </div>
          </div>
        </section>

        <footer className="proposta-footer mt-auto pt-8 text-center font-bold shrink-0">
          <p className="text-xl leading-none text-black font-sans mb-2">pontofinal.site / Lucca Gontijo.</p>
          <div className="w-full border-t-4 border-black"></div>
          <p className="text-xs leading-none opacity-80 text-black font-sans mt-2">A SUA AGÊNCIA DIGITAL FOCADA EM RESULTADOS.</p>
        </footer>
      </div>
    </div>
  );
}
