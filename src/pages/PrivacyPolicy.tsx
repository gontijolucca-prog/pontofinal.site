import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <main className="section bg-light">
        <div className="container" style={{ maxWidth: '800px', margin: '0 auto', background: '#fff', padding: '3rem 2rem', border: '4px solid #050505', borderRadius: '8px', boxShadow: '4px 4px 0 #050505' }}>
            <h1 className="hero-title" style={{ fontSize: '2.5rem', marginBottom: '2rem', textAlign: 'center' }}>Política de Privacidade</h1>
            <div className="legal-content" style={{ lineHeight: 1.6 }}>
                <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>1. Recolha de Informação</h3>
                <p style={{ marginBottom: '1.5rem' }}>A sua privacidade é importante para nós. A Pontofinal.site recolhe informações pessoais apenas quando estritamente necessário para lhe fornecer um serviço, de forma justa e legal, com o seu conhecimento e consentimento. Explicamos sempre o motivo da recolha e como será utilizada a sua informação (ex: através de formulários de contacto e briefing).</p>

                <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>2. Uso de Dados Pessoais</h3>
                <p style={{ marginBottom: '1.5rem' }}>Os dados recolhidos (como nome, email, telefone e informação da empresa) são utilizados exclusivamente para fins de comunicação, faturação e execução do serviço de criação de websites. Não partilhamos as suas informações de identificação pessoal de forma pública ou com terceiros, exceto quando exigido por lei ou quando entidades parceiras processam serviços diretos (ex: Stripe para pagamentos seguros).</p>

                <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>3. Proteção e Retenção de Dados</h3>
                <p style={{ marginBottom: '1.5rem' }}>Apenas retemos as informações recolhidas pelo tempo necessário para prestar o serviço solicitado. Os dados armazenados são protegidos com medidas comercialmente aceitáveis para evitar perdas, roubos, acesso não autorizado, divulgação, cópia, uso ou modificação, mantendo as mais altas práticas de segurança digital.</p>

                <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>4. Política de Cookies</h3>
                <p style={{ marginBottom: '1.5rem' }}>O nosso site utiliza cookies estritamente necessários para compreender a forma como os utilizadores interagem com o nosso website e melhorar a experiência de navegação e desempenho. Pode configurar o seu browser para recusar todos os cookies, no entanto, isso poderá afetar o funcionamento de certas áreas da plataforma.</p>

                <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>5. Direitos do Utilizador</h3>
                <p style={{ marginBottom: '1.5rem' }}>É livre de recusar a nossa solicitação de informações pessoais, ciente de que tal poderá inviabilizar a prestação de determinados serviços. Tem ainda o direito completo e transparente de aceder, corrigir ou solicitar a eliminação dos seus dados a qualquer momento, bastando para isso contactar a nossa equipa.</p>

                <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>6. Contacto</h3>
                <p style={{ marginBottom: '1.5rem' }}>Se tiver alguma dúvida sobre como lidamos com os dados e informações pessoais do utilizador, por favor, entre em contacto connosco através do email geral@pontofinal.site.</p>
            </div>
            <div style={{ textAlign: 'center', marginTop: '3rem' }}>
                <Link to="/" className="btn btn-primary">Voltar ao Início</Link>
            </div>
        </div>
    </main>
  );
}
