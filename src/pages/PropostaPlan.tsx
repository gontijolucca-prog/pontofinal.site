import { useParams, Navigate } from 'react-router-dom';

interface PlanData {
  name: string;
  subtitle: string;
  features: string[];
  objetivo: string;
  pricing: { label: string; value: string }[];
}

const plans: Record<string, PlanData> = {
  'web-bronze': {
    name: 'Web Bronze',
    subtitle: 'Website',
    features: [
      'Website de <strong>1 página</strong> profissional',
      'Design responsivo (mobile + desktop)',
      'Alojamento e segurança incluídos',
      '<strong>1 atualização</strong> de conteúdo por mês',
      'SEO básico configurado',
    ],
    objetivo:
      'Criar uma presença digital profissional com o essencial para um negócio em crescimento — rápido, seguro e sem preocupações técnicas.',
    pricing: [
      { label: 'Taxa de Arranque', value: '60€' },
      { label: 'Manutenção Mensal', value: '20€/mês' },
    ],
  },
  'web-prata': {
    name: 'Web Prata',
    subtitle: 'Website',
    features: [
      'Website com <strong>até 5 páginas</strong>',
      'Design responsivo (mobile + desktop)',
      'Botão WhatsApp integrado',
      'Alojamento e segurança incluídos',
      '<strong>2 atualizações</strong> de conteúdo por mês',
    ],
    objetivo:
      'Construir um website completo e funcional, com múltiplas páginas e ferramentas de contacto para converter visitantes em clientes.',
    pricing: [
      { label: 'Taxa de Arranque', value: '80€' },
      { label: 'Manutenção Mensal', value: '40€/mês' },
    ],
  },
  'web-ouro': {
    name: 'Web Ouro',
    subtitle: 'Website',
    features: [
      'Tudo do plano Prata incluído',
      'Ferramentas web e funcionalidades internas',
      'Estatísticas de visitas integradas',
      'Suporte prioritário',
      '<strong>4 atualizações</strong> de conteúdo por mês',
    ],
    objetivo:
      'Desenvolver uma plataforma web avançada com ferramentas internas e análise de dados para maximizar o crescimento digital do negócio.',
    pricing: [
      { label: 'Taxa de Arranque', value: '100€' },
      { label: 'Manutenção Mensal', value: '60€/mês' },
    ],
  },
  'social-bronze': {
    name: 'Social Bronze',
    subtitle: 'Gestão de Redes Sociais',
    features: [
      '<strong>20 publicações</strong> por mês',
      '3 posts regulares por semana',
      '<strong>2 carrosseis</strong>/semana (até 5 slides cada)',
      'Legendas persuasivas + pesquisa de hashtags',
      'Design de acordo com a identidade da marca',
    ],
    objetivo:
      'Estabelecer uma presença consistente nas redes sociais com conteúdo de qualidade e regularidade para construir audiência e autoridade.',
    pricing: [
      { label: 'Investimento Mensal', value: '80€/mês' },
    ],
  },
  'social-prata': {
    name: 'Social Prata',
    subtitle: 'Gestão de Redes Sociais',
    features: [
      '<strong>28 publicações</strong> por mês',
      '4 posts regulares por semana',
      '<strong>3 carrosseis</strong>/semana (até 8 slides cada)',
      'Legendas persuasivas + pesquisa de hashtags',
      'Planeamento de conteúdo mensal',
    ],
    objetivo:
      'Aumentar o alcance e engagement com uma estratégia de conteúdo diversificada, combinando posts regulares, carrosseis de valor e planeamento mensal.',
    pricing: [
      { label: 'Investimento Mensal', value: '150€/mês' },
    ],
  },
  'social-ouro': {
    name: 'Social Ouro',
    subtitle: 'Gestão de Redes Sociais',
    features: [
      '<strong>36 publicações</strong> por mês',
      '5 posts regulares por semana',
      '<strong>4 carrosseis</strong>/semana (até 10 slides cada)',
      '<strong>1 vídeo</strong>/semana (Reels/TikTok/Shorts)',
      'Planeamento mensal com estratégia de temas',
      'Análise de métricas do mês anterior',
      '1 reunião de alinhamento criativo (30 min)',
    ],
    objetivo:
      'Criar conteúdo focado em autoridade e engagement, combinando vídeo dinâmico para alcance e carrosseis educativos para fidelização, com análise de métricas mensal.',
    pricing: [
      { label: 'Investimento Mensal', value: '300€/mês' },
    ],
  },
};

export default function PropostaPlan() {
  const { planId } = useParams<{ planId: string }>();
  const plan = planId ? plans[planId] : null;

  if (!plan) {
    return <Navigate to="/proposta" replace />;
  }

  return (
    <div className="a4-container">
      <div className="a4-page brutal-card-static">
        <header className="proposta-header shrink-0">
          <h1 className="proposta-title">PROPOSTA DE SERVIÇOS</h1>
          <p className="proposta-subtitle">{plan.subtitle}</p>
        </header>

        <section className="proposta-section flex flex-col pt-6 pb-4">
          <h2 className="section-title text-2xl font-bold border-b-4 border-black pb-2 mb-4 shrink-0">
            Plano: {plan.name}
          </h2>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center shrink-0">
              <div className="proposta-details">
                <h3 className="font-bold text-xl mb-3">O que está incluído:</h3>
                <ul className="pricing-features mb-0" style={{ fontSize: '0.90rem' }}>
                  {plan.features.map((feature, i) => (
                    <li key={i} dangerouslySetInnerHTML={{ __html: feature }} />
                  ))}
                </ul>
              </div>

              <div className="proposta-pricing flex flex-col justify-center shrink-0">
                <div
                  className="brutal-card-static text-center p-5 border-4 border-black"
                  style={{ background: '#FFE600', boxShadow: '4px 4px 0px 0px #000' }}
                >
                  {plan.pricing.map((p, i) => (
                    <div key={i} className={i > 0 ? 'mt-3' : ''}>
                      <h3 className="font-bold text-lg mb-2">{p.label}</h3>
                      <div className="price anchored-price justify-center my-2">
                        <div className="new-price text-4xl items-center" style={{ animation: 'none' }}>
                          <span>{p.value}</span>
                        </div>
                      </div>
                      {i < plan.pricing.length - 1 && (
                        <div className="border-t-2 border-black mt-3" />
                      )}
                    </div>
                  ))}
                  <p className="text-xs font-semibold mt-2">Sem fidelização forçada. Pagamento mensal.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch shrink-0">
              <div className="brutal-card-static card-dark p-4 flex flex-col justify-center">
                <h3 className="font-bold text-base mb-1 text-white">Objetivo</h3>
                <p className="text-gray-300 text-xs">{plan.objetivo}</p>
              </div>

              <div
                className="brutal-card-static p-4 bg-white flex flex-col justify-center"
                style={{ borderColor: 'var(--color-primary)', boxShadow: '4px 4px 0px 0px var(--color-primary)' }}
              >
                <h4 className="font-bold text-lg mb-1.5">Próximos Passos:</h4>
                <ol className="list-decimal list-inside space-y-1.5 font-medium text-sm">
                  <li>Aprovação da proposta</li>
                  <li>Reunião de alinhamento / Briefing</li>
                  <li>Início do planeamento</li>
                </ol>
              </div>
            </div>
          </div>
        </section>

        <footer className="proposta-footer text-center font-bold shrink-0" style={{ marginTop: 'auto', transform: 'scale(0.7)', transformOrigin: 'center bottom' }}>
          <p className="text-xl leading-none text-black font-sans" style={{ marginBottom: 0, paddingBottom: '12px' }}>pontofinal.site / Lucca Gontijo.</p>
          <div className="w-full border-t-4 border-black"></div>
          <p className="proposta-tagline text-xs leading-none text-black font-sans" style={{ marginBottom: 0, paddingTop: '12px', opacity: 0.6 }}>A SUA AGÊNCIA DIGITAL FOCADA EM RESULTADOS.</p>
        </footer>
      </div>
    </div>
  );
}
