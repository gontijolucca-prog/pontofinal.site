import jsPDF from 'jspdf';

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
      'Website de 1 pagina profissional',
      'Design responsivo (mobile + desktop)',
      'Alojamento e seguranca incluidos',
      '1 atualizacao de conteudo por mes',
      'SEO basico configurado',
    ],
    objetivo:
      'Criar uma presenca digital profissional com o essencial para um negocio em crescimento - rapido, seguro e sem preocupacoes tecnicas.',
    pricing: [
      { label: 'Taxa de Arranque', value: '200 EUR' },
      { label: 'Manutencao Mensal', value: '30 EUR/mes' },
    ],
  },
  'web-prata': {
    name: 'Web Prata',
    subtitle: 'Website',
    features: [
      'Website com ate 5 paginas',
      'Design responsivo (mobile + desktop)',
      'Botao WhatsApp integrado',
      'Alojamento e seguranca incluidos',
      '2 atualizacoes de conteudo por mes',
    ],
    objetivo:
      'Construir um website completo e funcional, com multiplas paginas e ferramentas de contacto para converter visitantes em clientes.',
    pricing: [
      { label: 'Taxa de Arranque', value: '400 EUR' },
      { label: 'Manutencao Mensal', value: '50 EUR/mes' },
    ],
  },
  'web-ouro': {
    name: 'Web Ouro',
    subtitle: 'Website',
    features: [
      'Tudo do plano Prata incluido',
      'Ferramentas web e funcionalidades internas',
      'Estatisticas de visitas integradas',
      'Suporte prioritario',
      '4 atualizacoes de conteudo por mes',
    ],
    objetivo:
      'Desenvolver uma plataforma web avancada com ferramentas internas e analise de dados para maximizar o crescimento digital do negocio.',
    pricing: [
      { label: 'Taxa de Arranque', value: '700 EUR' },
      { label: 'Manutencao Mensal', value: '80 EUR/mes' },
    ],
  },
  'ai-assistente': {
    name: 'Assistente',
    subtitle: 'Agente de IA',
    features: [
      '1 agente de IA (site ou WhatsApp)',
      'Responde e qualifica leads 24/7',
      'Base de conhecimento do teu negocio',
      'Alojamento e seguranca incluidos',
      '1 atualizacao por mes',
    ],
    objetivo:
      'Criar um assistente de IA que responde, qualifica e aguenta contigo 24/7, sem depender de uma pessoa para atender cada pedido.',
    pricing: [
      { label: 'Arranque', value: '350 EUR' },
      { label: 'Manutencao Mensal', value: '39 EUR/mes' },
    ],
  },
  'ai-automacao': {
    name: 'Automacao',
    subtitle: 'Automacao de Processos',
    features: [
      '1 agente de IA + fluxos de automacao',
      'Integracoes com as tuas ferramentas',
      'Elimina tarefas repetitivas diarias',
      'Alojamento, seguranca e base de dados',
      '2 atualizacoes por mes',
    ],
    objetivo:
      'Automatizar os processos repetitivos do negocio: follow-ups, relatorios, triagem de pedidos e integracoes que funcionam sozinhas.',
    pricing: [
      { label: 'Arranque', value: '850 EUR' },
      { label: 'Manutencao Mensal', value: '89 EUR/mes' },
    ],
  },
  'ai-sobmedida': {
    name: 'Sob Medida',
    subtitle: 'Ferramenta Interna Personalizada',
    features: [
      'Ferramenta interna completa feita a medida',
      'Paineis, CRMs ou geradores personalizados',
      'Multiplos agentes e automacoes',
      'Suporte prioritario',
      '4 atualizacoes por mes',
    ],
    objetivo:
      'Desenvolver uma ferramenta de IA completa, construida especificamente para o teu caso, que resolve o problema exato do teu negocio.',
    pricing: [
      { label: 'Arranque', value: 'a partir de 1.500 EUR' },
      { label: 'Manutencao Mensal', value: '149 EUR/mes' },
    ],
  },
};

// Colors (Industrial Toolbox)
const COBALT = [27, 79, 216];
const SIGNAL = [200, 16, 46];
const BLACK = [16, 35, 61];
const GRAY = [233, 228, 214];
const RED = COBALT; // accents -> cobalt
const YELLOW = GRAY; // price box -> paper tint

function generate(plan: PlanData, filename: string) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);

  // --- HEADER ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.text('PROPOSTA DE SERVICOS', margin, 25);

  doc.setFontSize(14);
  doc.setTextColor(RED[0], RED[1], RED[2]);
  doc.text(plan.subtitle.toUpperCase(), margin, 32);

  // --- PLAN NAME ---
  doc.setDrawColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.setLineWidth(1.5);
  doc.line(margin, 40, margin + contentWidth, 40);

  doc.setFontSize(20);
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.text(`Plano: ${plan.name}`, margin, 50);

  doc.setLineWidth(1.5);
  doc.line(margin, 55, margin + contentWidth, 55);

  // --- MIDDLE SECTION (2 COLUMNS) ---
  const colWidth = (contentWidth - 10) / 2;
  let currentY = 70;

  // Left Column: Features
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('O que esta incluido:', margin, currentY);
  currentY += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  plan.features.forEach((feature) => {
    // Arrow
    doc.setTextColor(RED[0], RED[1], RED[2]);
    doc.text('->', margin, currentY);
    
    // Feature text
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    const wrappedText = doc.splitTextToSize(feature, colWidth - 8);
    doc.text(wrappedText, margin + 8, currentY);
    
    currentY += (wrappedText.length * 5) + 2;
    
    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(margin, currentY - 2, margin + colWidth, currentY - 2);
    currentY += 3;
  });

  const featuresBottomY = currentY;

  // Right Column: Pricing Box
  const priceBoxX = margin + colWidth + 10;
  const priceBoxY = 70;
  const priceBoxWidth = colWidth;
  const priceBoxHeight = 60;

  // Shadow
  doc.setFillColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.rect(priceBoxX + 2, priceBoxY + 2, priceBoxWidth, priceBoxHeight, 'F');
  
  // Box
  doc.setFillColor(YELLOW[0], YELLOW[1], YELLOW[2]);
  doc.setDrawColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.setLineWidth(1);
  doc.rect(priceBoxX, priceBoxY, priceBoxWidth, priceBoxHeight, 'FD');

  let py = priceBoxY + 12;
  plan.pricing.forEach((p, idx) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(p.label, priceBoxX + 5, py);
    
    doc.setFontSize(22);
    doc.text(p.value, priceBoxX + 5, py + 10);
    
    py += 22;
    if (idx < plan.pricing.length - 1) {
      doc.setLineWidth(0.5);
      doc.line(priceBoxX + 5, py - 5, priceBoxX + priceBoxWidth - 5, py - 5);
    }
  });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Sem fidelizacao forcada. Pagamento mensal.', priceBoxX + 5, priceBoxY + priceBoxHeight - 5);

  // --- BOTTOM SECTION (2 CARDS) ---
  currentY = Math.max(featuresBottomY, priceBoxY + priceBoxHeight) + 15;
  const cardWidth = colWidth;
  const cardHeight = 45;

  // Left Card: Objetivo
  // Shadow
  doc.setFillColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.rect(margin + 2, currentY + 2, cardWidth, cardHeight, 'F');
  // Box (Dark)
  doc.setFillColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.setDrawColor(RED[0], RED[1], RED[2]);
  doc.setLineWidth(0.5);
  doc.rect(margin, currentY, cardWidth, cardHeight, 'FD');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Objetivo', margin + 5, currentY + 8);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(220, 220, 220);
  const wrappedObjetivo = doc.splitTextToSize(plan.objetivo, cardWidth - 10);
  doc.text(wrappedObjetivo, margin + 5, currentY + 16);

  // Right Card: Proximos Passos
  const nextStepsX = margin + colWidth + 10;
  // Shadow
  doc.setFillColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.rect(nextStepsX + 2, currentY + 2, cardWidth, cardHeight, 'F');
  // Box (White/Red)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(RED[0], RED[1], RED[2]);
  doc.setLineWidth(1);
  doc.rect(nextStepsX, currentY, cardWidth, cardHeight, 'FD');

  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Proximos Passos:', nextStepsX + 5, currentY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('1. Aprovacao da proposta', nextStepsX + 5, currentY + 18);
  doc.text('2. Reuniao de alinhamento / Briefing', nextStepsX + 5, currentY + 25);
  doc.text('3. Inicio do planeamento', nextStepsX + 5, currentY + 32);

  // --- FOOTER ---
  const footerY = pageHeight - 30;
  doc.setDrawColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.setLineWidth(1);
  doc.line(margin, footerY, margin + contentWidth, footerY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('pontofinal.site / Lucca Gontijo.', pageWidth / 2, footerY + 8, { align: 'center' });

  doc.setLineWidth(0.5);
  doc.line(margin, footerY + 12, margin + contentWidth, footerY + 12);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('FERRAMENTAS DE IA FEITAS A MEDIDA PARA O SEU NEGOCIO.', pageWidth / 2, footerY + 18, { align: 'center' });

  // --- SAVE ---
  doc.save(filename);
}

export function downloadPropostaPdf(planId: string) {
  const plan = plans[planId];
  if (!plan) return;
  generate(plan, `proposta-${planId}.pdf`);
}
