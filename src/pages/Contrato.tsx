export default function Contrato() {
  return (
    <div className="a4-container" style={{ flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>

      {/* ── PÁGINA 1: CONTRATO PRINCIPAL ── */}
      <div className="a4-page brutal-card-static" style={{ boxShadow: 'none' }}>
        <header className="proposta-header shrink-0">
          <h1 className="proposta-title" style={{ fontSize: '1.6rem' }}>CONTRATO DE PRESTAÇÃO DE SERVIÇOS DIGITAIS</h1>
          <p className="proposta-subtitle">pontofinal.site</p>
        </header>

        <section style={{ marginTop: '1.5rem', fontSize: '0.82rem', lineHeight: '1.6' }}>

          {/* PARTES */}
          <div style={{ marginBottom: '1.2rem' }}>
            <p style={{ fontSize: '0.82rem', marginBottom: '0.6rem' }}>
              <strong>Entre:</strong> Lucca Rodrigues Gontijo, contribuinte fiscal n.º 255035284, com domicílio profissional em Rua dos Filarmónicos, n.º 23, 2415-500 Leiria, doravante designado por <strong>PRESTADOR</strong>.
            </p>
            <p style={{ fontSize: '0.82rem', marginBottom: '0.8rem' }}><strong>E:</strong></p>

            <div style={{ border: '2px solid #050505', padding: '0.8rem', marginBottom: '0.8rem' }}>
              <p style={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '0.75rem', marginBottom: '0.5rem' }}>CLIENTE:</p>
              <div style={{ display: 'flex', gap: '2rem', marginBottom: '0.4rem', fontSize: '0.82rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700 }}>
                  <input type="checkbox" /> Pessoa Singular
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700 }}>
                  <input type="checkbox" /> Pessoa Coletiva
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1rem' }}>
                {[
                  'Nome',
                  'NIF',
                  'Documento de Identificação',
                  '(Se Pessoa Coletiva) Certidão Permanente n.º',
                  'Sede / Morada',
                  'Representada por',
                  'Com poderes para o ato',
                ].map((label) => (
                  <div key={label} style={{ gridColumn: label === 'Sede / Morada' || label === 'Representada por' || label === 'Com poderes para o ato' ? 'span 2' : 'auto' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.75rem' }}>{label}: </span>
                    <span style={{ display: 'inline-block', borderBottom: '1.5px solid #050505', minWidth: '150px', width: '60%' }}>&nbsp;</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', marginBottom: 0 }}>doravante designado(a) por <strong>CLIENTE</strong>.</p>
            </div>

            <p style={{ fontSize: '0.82rem', marginBottom: '0.8rem' }}>
              É celebrado o presente contrato, que se rege pelas cláusulas seguintes:
            </p>
          </div>

          {/* CLÁUSULAS */}
          {[
            {
              num: '1ª', title: 'Objeto',
              text: 'O PRESTADOR obriga-se a prestar serviços digitais ao CLIENTE, que poderão incluir desenvolvimento, alojamento e manutenção de websites no modelo "Website as a Service" (WaaS) e/ou produção de conteúdos para redes sociais, conforme o(s) plano(s) escolhido(s) e detalhados no Anexo A, que faz parte integrante deste contrato.',
            },
            {
              num: '2ª', title: 'Propriedade Intelectual e Licenciamento',
              items: [
                'Conteúdos do CLIENTE: O domínio, logótipos, marcas, textos e imagens fornecidos pelo CLIENTE são e permanecem sua propriedade exclusiva.',
                'Conteúdos produzidos pelo PRESTADOR: Posts, carrosseis, vídeos e legendas criados tornam-se propriedade do CLIENTE após o pagamento integral da mensalidade. O PRESTADOR pode usá-los no seu portfólio.',
                'Website: O código-fonte, arquitetura e design são propriedade exclusiva do PRESTADOR. É concedida ao CLIENTE uma licença de utilização não exclusiva, válida durante a vigência do contrato e condicionada ao pagamento pontual.',
                'Em caso de resolução sem incumprimentos pelo CLIENTE, o PRESTADOR cede uma cópia completa dos ficheiros do website sem custo adicional.',
                'Em caso de incumprimento (atraso > 60 dias), a licença é revogada e o site pode ser suspenso.',
              ],
            },
            {
              num: '3ª', title: 'Duração, Fidelização e Cancelamento',
              items: [
                'Planos Mensais: Contrato por prazo indeterminado. Resolução mediante comunicação escrita com 30 dias de antecedência, sem penalidade.',
                'Planos Anuais: O valor pago antecipadamente corresponde à totalidade dos 12 meses. Cancelamento antecipado pelo CLIENTE não dá direito a reembolso.',
              ],
            },
            {
              num: '4ª', title: 'Preço, Pagamentos e Suspensão',
              items: [
                'Os valores devidos (Taxa de Arranque e Subscrição) constam do Anexo A.',
                'Pagamento até ao dia 5 de cada mês (planos mensais) via Transferência bancária, MBWay ou Débito direto.',
                'Atraso > 30 dias: o PRESTADOR pode suspender todos os serviços com aviso de 5 dias úteis. A suspensão não extingue os valores em dívida.',
              ],
            },
            {
              num: '5ª', title: 'Acessos e Responsabilidade',
              items: [
                'Website: O CLIENTE recebe credenciais de Administrador. O PRESTADOR mantém acesso de superutilizador para manutenção.',
                'Redes Sociais: O CLIENTE pode fornecer credenciais das suas contas para publicação. O CLIENTE é responsável pela atualização dessas credenciais.',
                'O CLIENTE assume responsabilidade total por edições ou publicações que efetue diretamente.',
              ],
            },
            {
              num: '6ª', title: 'Proteção de Dados Pessoais (RGPD)',
              text: 'O CLIENTE atua como Responsável pelo Tratamento e o PRESTADOR como Subcontratante. O PRESTADOR obriga-se a tratar dados apenas mediante instruções do CLIENTE, garantir confidencialidade, implementar medidas de segurança adequadas, notificar violações de dados e eliminar/devolver dados no final do contrato.',
            },
            {
              num: '7ª', title: 'Limitação de Responsabilidade',
              items: [
                'Websites: disponibilidade ≥ 99% mensal, excluindo manutenção programada e falhas de terceiros.',
                'O PRESTADOR não é responsável por perdas indiretas ou lucros cessantes.',
                'A responsabilidade total fica limitada ao valor das mensalidades dos 3 meses anteriores ao evento.',
              ],
            },
            {
              num: '8ª', title: 'Força Maior',
              text: 'Nenhuma parte é responsável por atrasos resultantes de circunstâncias fora do seu controlo razoável (atos de autoridade, greves, pandemias, catástrofes naturais, falhas de redes).',
            },
            {
              num: '9ª', title: 'Cessão da Posição Contratual',
              text: 'O CLIENTE autoriza que o PRESTADOR ceda a sua posição a uma sociedade comercial que venha a constituir, desde que comunicado com 30 dias de antecedência, sem alteração das condições contratuais para o CLIENTE.',
            },
            {
              num: '10ª', title: 'Disposições Finais',
              items: [
                'Quaisquer alterações carecem de forma escrita e assinatura de ambas as partes.',
                'Este contrato substitui quaisquer acordos anteriores sobre o seu objeto.',
                'Em caso de litígio, é eleito o foro da comarca de Leiria.',
              ],
            },
          ].map((clause) => (
            <div key={clause.num} style={{ marginBottom: '0.7rem' }}>
              <p style={{ fontWeight: 900, fontSize: '0.82rem', marginBottom: '0.2rem', textTransform: 'uppercase' }}>
                Cláusula {clause.num} ({clause.title})
              </p>
              {clause.text && (
                <p style={{ fontSize: '0.78rem', marginBottom: 0 }}>{clause.text}</p>
              )}
              {clause.items && (
                <ol style={{ paddingLeft: '1.2rem', fontSize: '0.78rem', margin: 0 }}>
                  {clause.items.map((item, i) => (
                    <li key={i} style={{ marginBottom: '0.15rem' }}>{item}</li>
                  ))}
                </ol>
              )}
            </div>
          ))}

          {/* ASSINATURAS */}
          <div style={{ marginTop: '1.2rem', borderTop: '2px solid #050505', paddingTop: '0.8rem' }}>
            <p style={{ fontSize: '0.78rem', marginBottom: '0.8rem' }}>
              Feito em duplicado em Leiria, aos ____ de __________________ de ______.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div>
                <p style={{ fontWeight: 900, fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.3rem' }}>PRESTADOR</p>
                <div style={{ borderBottom: '1.5px solid #050505', marginBottom: '0.3rem', minHeight: '2rem' }}></div>
                <p style={{ fontSize: '0.72rem', marginBottom: 0 }}>(Lucca Rodrigues Gontijo)</p>
              </div>
              <div>
                <p style={{ fontWeight: 900, fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.3rem' }}>CLIENTE</p>
                <div style={{ borderBottom: '1.5px solid #050505', marginBottom: '0.3rem', minHeight: '2rem' }}></div>
                <p style={{ fontSize: '0.72rem', marginBottom: 0 }}>(__________________________________________________)</p>
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* ── PÁGINA 2: ANEXO A ── */}
      <div className="a4-page brutal-card-static" style={{ boxShadow: 'none', pageBreakBefore: 'always', breakBefore: 'page' }}>
        <header className="proposta-header shrink-0">
          <h1 className="proposta-title" style={{ fontSize: '1.6rem' }}>ANEXO A</h1>
          <p className="proposta-subtitle">Dados do Cliente e Planos Contratados</p>
        </header>

        <section style={{ marginTop: '1rem', fontSize: '0.82rem', lineHeight: '1.6' }}>

          {/* DADOS DO CLIENTE */}
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '0.78rem', marginBottom: '0.4rem' }}>Dados do Cliente</p>
            <div style={{ display: 'flex', gap: '2rem', marginBottom: '0.3rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700, fontSize: '0.78rem' }}>
                <input type="checkbox" /> Pessoa Singular
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700, fontSize: '0.78rem' }}>
                <input type="checkbox" /> Pessoa Coletiva
              </label>
            </div>
            {['Nome / Empresa', 'NIF', 'Documento de Identificação', 'Certidão Permanente n.º (se Pessoa Coletiva)'].map((label) => (
              <div key={label} style={{ marginBottom: '0.3rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.75rem' }}>{label}: </span>
                <span style={{ display: 'inline-block', borderBottom: '1.5px solid #050505', minWidth: '200px', width: '55%' }}>&nbsp;</span>
              </div>
            ))}
          </div>

          {/* PARTE 1 — WEBSITE */}
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '0.78rem', borderTop: '2px solid #050505', paddingTop: '0.5rem', marginBottom: '0.4rem' }}>
              Parte 1 — Serviço de Website (WaaS)
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', marginBottom: '0.6rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #050505' }}>
                  <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem', fontWeight: 900 }}>Plano</th>
                  <th style={{ textAlign: 'center', padding: '0.3rem 0.5rem', fontWeight: 900, width: '80px' }}>Seleção</th>
                </tr>
              </thead>
              <tbody>
                {[
                  '🥉 Bronze — 1 página',
                  '🥈 Prata — Até 5 páginas',
                  '🥇 Ouro — Website avançado',
                ].map((label) => (
                  <tr key={label} style={{ borderBottom: '1px solid #ccc' }}>
                    <td style={{ padding: '0.3rem 0.5rem' }}>{label}</td>
                    <td style={{ padding: '0.3rem 0.5rem', textAlign: 'center' }}><input type="checkbox" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginBottom: '0.4rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.75rem' }}>Modalidade: </span>
              <label style={{ marginRight: '1rem', fontSize: '0.75rem', fontWeight: 600 }}><input type="checkbox" /> Mensal</label>
              <label style={{ fontSize: '0.75rem', fontWeight: 600 }}><input type="checkbox" /> Anual (oferta arranque + 2 meses)</label>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', border: '1px solid #050505' }}>
              <thead>
                <tr style={{ background: '#050505', color: '#fff' }}>
                  <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left' }}>Fase</th>
                  <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left' }}>Prazo</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Fornecimento de conteúdos pelo CLIENTE', 'Até 10 dias úteis após assinatura'],
                  ['Desenvolvimento e apresentação da 1ª versão', 'Até 20 dias úteis após receção'],
                  ['Período de revisões (3 rondas)', '15 dias úteis'],
                  ['Entrada em produção', 'Até 5 dias úteis após aprovação final'],
                ].map(([fase, prazo]) => (
                  <tr key={fase} style={{ borderBottom: '1px solid #ccc' }}>
                    <td style={{ padding: '0.3rem 0.5rem' }}>{fase}</td>
                    <td style={{ padding: '0.3rem 0.5rem' }}>{prazo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PARTE 2 — CONTEÚDO */}
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '0.78rem', borderTop: '2px solid #050505', paddingTop: '0.5rem', marginBottom: '0.4rem' }}>
              Parte 2 — Serviço de Produção de Conteúdo
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', marginBottom: '0.6rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #050505' }}>
                  <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem', fontWeight: 900 }}>Plano</th>
                  <th style={{ textAlign: 'center', padding: '0.3rem 0.5rem', fontWeight: 900, width: '80px' }}>Seleção</th>
                </tr>
              </thead>
              <tbody>
                {[
                  '🥉 Bronze — 20 posts · 3/sem · 2 carrosseis/sem',
                  '🥈 Prata — 28 posts · 4/sem · 3 carrosseis/sem · planeamento',
                  '🥇 Ouro — 36 posts · 5/sem · 4 carrosseis · 1 vídeo/sem · métricas',
                ].map((label) => (
                  <tr key={label} style={{ borderBottom: '1px solid #ccc' }}>
                    <td style={{ padding: '0.3rem 0.5rem' }}>{label}</td>
                    <td style={{ padding: '0.3rem 0.5rem', textAlign: 'center' }}><input type="checkbox" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PARTE 3 — OBRIGAÇÕES */}
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '0.78rem', borderTop: '2px solid #050505', paddingTop: '0.5rem', marginBottom: '0.4rem' }}>
              Parte 3 — Obrigações do Cliente
            </p>
            <ul style={{ paddingLeft: '1.2rem', fontSize: '0.75rem', margin: 0 }}>
              {[
                'Fornecer textos, imagens e logótipos em formato digital dentro dos prazos acordados.',
                'Indicar por escrito preferências de design, funcionalidades e integrações.',
                'Designar um interlocutor com poderes de decisão para aprovações.',
                'Fornecer credenciais das redes sociais (quando aplicável) e mantê-las atualizadas.',
                'Proceder aos pagamentos nas datas e valores contratados.',
              ].map((item) => (
                <li key={item} style={{ marginBottom: '0.15rem' }}>{item}</li>
              ))}
            </ul>
          </div>

          {/* PARTE 4 — RESUMO FINANCEIRO */}
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '0.78rem', borderTop: '2px solid #050505', paddingTop: '0.5rem', marginBottom: '0.4rem' }}>
              Parte 4 — Resumo Financeiro
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', border: '1px solid #050505' }}>
              <thead>
                <tr style={{ background: '#050505', color: '#fff' }}>
                  <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left' }}>Serviço</th>
                  <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left' }}>Plano</th>
                  <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left' }}>Setup</th>
                  <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left' }}>Mensalidade</th>
                </tr>
              </thead>
              <tbody>
                {[['Website', '', '___€', '___€/mês'], ['Conteúdo', '', '—', '___€/mês']].map(([serv, plano, setup, mens]) => (
                  <tr key={serv} style={{ borderBottom: '1px solid #ccc' }}>
                    <td style={{ padding: '0.3rem 0.5rem' }}>{serv}</td>
                    <td style={{ padding: '0.3rem 0.5rem' }}>{plano}</td>
                    <td style={{ padding: '0.3rem 0.5rem' }}>{setup}</td>
                    <td style={{ padding: '0.3rem 0.5rem' }}>{mens}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid #050505', fontWeight: 900 }}>
                  <td colSpan={3} style={{ padding: '0.3rem 0.5rem', textAlign: 'right' }}>Total mensal:</td>
                  <td style={{ padding: '0.3rem 0.5rem' }}>___€/mês</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* PARTE 5 — PROPOSTA CUSTOMIZADA */}
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '0.78rem', borderTop: '2px solid #050505', paddingTop: '0.5rem', marginBottom: '0.4rem' }}>
              Parte 5 — Proposta Customizada
            </p>
            <p style={{ fontSize: '0.72rem', marginBottom: '0.5rem', fontStyle: 'italic' }}>
              Preencher apenas se os planos standard não se aplicarem.
            </p>
            <div style={{ marginBottom: '0.4rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.75rem' }}>Descrição do serviço: </span>
              <span style={{ display: 'block', borderBottom: '1.5px solid #050505', marginTop: '0.3rem', marginBottom: '0.3rem', minHeight: '1.2rem' }}></span>
              <span style={{ display: 'block', borderBottom: '1.5px solid #050505', marginBottom: '0.3rem', minHeight: '1.2rem' }}></span>
            </div>
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: '0.75rem' }}>Valor acordado: </span>
                <span style={{ display: 'inline-block', borderBottom: '1.5px solid #050505', minWidth: '80px' }}>&nbsp;</span>
                <span style={{ fontSize: '0.75rem' }}> €</span>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.75rem' }}>Modalidade: </span>
                {['Mensal', 'Pagamento Único', 'Anual'].map((m) => (
                  <label key={m} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600 }}>
                    <input type="checkbox" /> {m}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <span style={{ fontWeight: 700, fontSize: '0.75rem' }}>Observações: </span>
              <span style={{ display: 'block', borderBottom: '1.5px solid #050505', marginTop: '0.3rem', marginBottom: '0.3rem', minHeight: '1.2rem' }}></span>
              <span style={{ display: 'block', borderBottom: '1.5px solid #050505', minHeight: '1.2rem' }}></span>
            </div>
          </div>

          {/* ASSINATURAS ANEXO */}
          <div style={{ borderTop: '2px solid #050505', paddingTop: '0.8rem' }}>
            <p style={{ fontSize: '0.75rem', marginBottom: '0.6rem' }}>O CLIENTE declara ter lido e aceite o presente Anexo.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div>
                <p style={{ fontWeight: 900, fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.3rem' }}>PRESTADOR</p>
                <div style={{ borderBottom: '1.5px solid #050505', marginBottom: '0.3rem', minHeight: '2rem' }}></div>
                <p style={{ fontSize: '0.72rem', marginBottom: '0.2rem' }}>(Lucca Rodrigues Gontijo)</p>
                <p style={{ fontSize: '0.72rem', marginBottom: 0 }}>Data: ____ / ____ / ______</p>
              </div>
              <div>
                <p style={{ fontWeight: 900, fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.3rem' }}>CLIENTE</p>
                <div style={{ borderBottom: '1.5px solid #050505', marginBottom: '0.3rem', minHeight: '2rem' }}></div>
                <p style={{ fontSize: '0.72rem', marginBottom: '0.2rem' }}>(__________________________________________________)</p>
                <p style={{ fontSize: '0.72rem', marginBottom: 0 }}>Data: ____ / ____ / ______</p>
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* ── PÁGINA 3: CHECKLIST DOCUMENTOS ── */}
      <div className="a4-page brutal-card-static" style={{ boxShadow: 'none', pageBreakBefore: 'always', breakBefore: 'page', minHeight: 'auto' }}>
        <header className="proposta-header shrink-0">
          <h1 className="proposta-title" style={{ fontSize: '1.6rem' }}>CHECKLIST DE DOCUMENTOS</h1>
          <p className="proposta-subtitle">Uso Interno — pontofinal.site</p>
        </header>

        <section style={{ marginTop: '1.5rem', fontSize: '0.82rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', border: '2px solid #050505' }}>
            <thead>
              <tr style={{ background: '#050505', color: '#fff' }}>
                <th style={{ padding: '0.6rem 1rem', textAlign: 'center', width: '50px' }}>#</th>
                <th style={{ padding: '0.6rem 1rem', textAlign: 'left' }}>Documento</th>
                <th style={{ padding: '0.6rem 1rem', textAlign: 'center', width: '100px' }}>Entregue?</th>
              </tr>
            </thead>
            <tbody>
              {[
                'Contrato assinado (duplicado)',
                'Anexo A preenchido e assinado',
                'Cópia do Documento de Identificação',
                'Certidão Permanente (se Pessoa Coletiva)',
              ].map((doc, i) => (
                <tr key={doc} style={{ borderBottom: '1px solid #ccc' }}>
                  <td style={{ padding: '0.8rem 1rem', textAlign: 'center', fontWeight: 900 }}>{i + 1}</td>
                  <td style={{ padding: '0.8rem 1rem' }}>{doc}</td>
                  <td style={{ padding: '0.8rem 1rem', textAlign: 'center' }}><input type="checkbox" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

      </div>

    </div>
  );
}
