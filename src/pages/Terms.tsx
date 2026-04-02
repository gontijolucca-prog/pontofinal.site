import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <main className="section bg-light">
        <div className="container" style={{ maxWidth: '800px', margin: '0 auto', background: '#fff', padding: '3rem 2rem', border: '4px solid #050505', borderRadius: '8px', boxShadow: '4px 4px 0 #050505' }}>
            <h1 className="hero-title" style={{ fontSize: '2.5rem', marginBottom: '2rem', textAlign: 'center' }}>Termos e Condições</h1>
            <div className="legal-content" style={{ lineHeight: 1.6 }}>
                <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>1. Aceitação dos Termos</h3>
                <p style={{ marginBottom: '1.5rem' }}>Ao aceder ao site da Pontofinal.site, o utilizador concorda em cumprir estes termos de serviço, todas as leis e regulamentos aplicáveis. Se não concordar com algum destes termos, está proibido de usar ou aceder a este site.</p>
                
                <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>2. Serviços de Subscrição (Website as a Service)</h3>
                <p style={{ marginBottom: '1.5rem' }}>A Pontofinal.site fornece serviços de criação, alojamento e manutenção de websites mediante um modelo de subscrição mensal, que requer o pagamento de uma taxa de setup inicial. A propriedade do código fonte, domínio (caso não fornecido pelo cliente) e design criado pela Pontofinal.site pertence à Pontofinal.site até que as condições contratuais de cedência (se aplicáveis) sejam cumpridas ou acordadas entre as partes.</p>

                <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>3. Pagamentos e Cancelamentos</h3>
                <p style={{ marginBottom: '1.5rem' }}>Os pagamentos mensais são devidos de acordo com o plano escolhido pelo cliente. O serviço pode ser cancelado a qualquer momento, sem penalização, desde que o aviso de cancelamento seja feito com pelo menos 15 dias de antecedência em relação ao próximo ciclo de faturação. O cancelamento implica a suspensão do website e dos serviços associados e a indisponibilidade do acesso ao mesmo na internet.</p>

                <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>4. Prazos e Entregas</h3>
                <p style={{ marginBottom: '1.5rem' }}>O prazo estimado de 5 dias úteis para a primeira entrega inicia-se apenas após o pagamento da Taxa de Ativação e a receção do Formulário de Briefing devidamente preenchido. Atrasos no fornecimento de informações ou feedback por parte do cliente eximem a Pontofinal.site do cumprimento do prazo inicial.</p>

                <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>5. Isenção de Responsabilidade</h3>
                <p style={{ marginBottom: '1.5rem' }}>A Pontofinal.site não garante resultados específicos e mensuráveis de tráfego, vendas ou ranking nos motores de busca (Google). Aplicamos as melhores práticas de SEO e Design, mas a performance de negócio depende de múltiplas variáveis fora do nosso controlo.</p>

                <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>6. Alterações aos Termos</h3>
                <p style={{ marginBottom: '1.5rem' }}>A Pontofinal.site poderá rever estes termos de serviço a qualquer momento, sem aviso prévio. Ao usar este site, o cliente concorda em ficar vinculado à versão atual destes termos de serviço.</p>
            </div>
            <div style={{ textAlign: 'center', marginTop: '3rem' }}>
                <Link to="/" className="btn btn-primary">Voltar ao Início</Link>
            </div>
        </div>
    </main>
  );
}
