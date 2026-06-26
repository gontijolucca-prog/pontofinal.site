import { useState } from 'react';

export default function Proposta() {
  const [editMode, setEditMode] = useState(false);

  const handleDownload = () => window.print();

  return (
    <div>
      {/* Toolbar */}
      <div className="no-print" style={{
        position: 'sticky',
        top: 0,
        zIndex: 200,
        background: '#050505',
        color: '#fff',
        display: 'flex',
        justifyContent: 'center',
        gap: '1rem',
        padding: '0.75rem 1rem',
        borderBottom: '4px solid #FF2A2A',
      }}>
        <button
          onClick={() => setEditMode((prev) => !prev)}
          className="btn"
          style={{
            background: editMode ? '#FF2A2A' : '#fff',
            color: editMode ? '#fff' : '#050505',
            border: '3px solid #fff',
            boxShadow: 'none',
            padding: '0.5rem 1.5rem',
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          {editMode ? '🔒 Modo Edição Ativo' : '✏️ Editar Documento'}
        </button>
        <button
          onClick={handleDownload}
          className="btn"
          style={{
            background: '#FF2A2A',
            color: '#fff',
            border: '3px solid #fff',
            boxShadow: 'none',
            padding: '0.5rem 1.5rem',
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          ⬇️ Download PDF
        </button>
      </div>

      <div id="proposta-container" className="a4-container">
        <div className="a4-page brutal-card-static">
          <header className="proposta-header shrink-0">
            <h1 className="proposta-title" contentEditable={editMode} suppressContentEditableWarning>PROPOSTA DE SERVIÇOS</h1>
            <p className="proposta-subtitle" contentEditable={editMode} suppressContentEditableWarning>Websites</p>
          </header>

          <section className="proposta-section flex flex-col pt-6 pb-4">
            <h2 className="section-title text-2xl font-bold border-b-4 border-black pb-2 mb-4 shrink-0" contentEditable={editMode} suppressContentEditableWarning>Plano: Customizado</h2>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center shrink-0">
                <div className="proposta-details">
                  <h3 className="font-bold text-xl mb-3" contentEditable={editMode} suppressContentEditableWarning>O que está incluído:</h3>
                  <ul className="pricing-features mb-0" style={{ fontSize: '0.90rem' }}>
                                <li contentEditable={editMode} suppressContentEditableWarning><strong>Website de 1 página</strong> profissional</li>
                    <li contentEditable={editMode} suppressContentEditableWarning>Design responsivo (mobile + desktop)</li>
                    <li contentEditable={editMode} suppressContentEditableWarning>Alojamento e segurança incluídos</li>
                    <li contentEditable={editMode} suppressContentEditableWarning>SEO básico configurado</li>
                  </ul>
                </div>

                <div className="proposta-pricing flex flex-col justify-center shrink-0">
                  <div className="brutal-card-static text-center p-5 bg-yellow-400 border-4 border-black" style={{ boxShadow: '4px 4px 0px 0px #000' }}>
                    <h3 className="font-bold text-lg mb-2" contentEditable={editMode} suppressContentEditableWarning>Investimento Mensal</h3>
                    <div className="price anchored-price justify-center my-3">
                      <div className="new-price text-4xl items-center" style={{ animation: 'none' }}>
                        <span contentEditable={editMode} suppressContentEditableWarning>60€</span>
                      </div>
                    </div>
                    <p className="text-xs font-semibold" contentEditable={editMode} suppressContentEditableWarning>Sem fidelização forçada. Pagamento mensal.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch shrink-0">
                <div className="brutal-card-static card-dark p-4 flex flex-col justify-center">
                  <h3 className="font-bold text-base mb-1 text-white" contentEditable={editMode} suppressContentEditableWarning>Objetivo</h3>
                   <p className="text-gray-300 text-xs" contentEditable={editMode} suppressContentEditableWarning>
                     Criar conteúdo focado em autoridade e engagement, combinando design moderno para alcance e conversão de audiência.
                   </p>

                </div>

                <div className="brutal-card-static p-4 bg-white flex flex-col justify-center" style={{ borderColor: 'var(--color-primary)', boxShadow: '4px 4px 0px 0px var(--color-primary)' }}>
                  <h4 className="font-bold text-lg mb-1.5" contentEditable={editMode} suppressContentEditableWarning>Próximos Passos:</h4>
                  <ol className="list-decimal list-inside space-y-1.5 font-medium text-sm">
                    <li contentEditable={editMode} suppressContentEditableWarning>Aprovação da proposta</li>
                    <li contentEditable={editMode} suppressContentEditableWarning>Reunião de alinhamento / Briefing</li>
                    <li contentEditable={editMode} suppressContentEditableWarning>Início do planeamento de conteúdos</li>
                  </ol>
                </div>
              </div>
            </div>
          </section>

          <footer className="proposta-footer text-center font-bold shrink-0" style={{ marginTop: 'auto', transform: 'scale(0.7)', transformOrigin: 'center bottom' }}>
            <p className="text-xl leading-none text-black font-sans" style={{ marginBottom: 0, paddingBottom: '12px' }}>
              <span contentEditable={editMode} suppressContentEditableWarning>pontofinal.site / Lucca Gontijo.</span>
            </p>
            <div className="w-full border-t-4 border-black"></div>
            <p className="proposta-tagline text-xs leading-none text-black font-sans" style={{ marginBottom: 0, paddingTop: '12px', opacity: 0.6 }}
              contentEditable={editMode} suppressContentEditableWarning>
              A SUA AGÊNCIA DIGITAL FOCADA EM RESULTADOS.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}