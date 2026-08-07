export type CargoUsuario = 
  | 'super_admin' 
  | 'admin' 
  | 'gerente' 
  | 'vendedor' 
  | 'caixa' 
  | 'estoquista' 
  | 'financeiro' 
  | 'comprador' 
  | 'entregador';

export interface Empresa {
  id: string;
  nome: string;
  slug: string;
  cnpj?: string | null;
  trial_fim?: string | null;
  plano?: string | null;
  status?: string | null;
  created_at?: string;
}

export interface Filial {
  id: string;
  empresa_id: string;
  nome: string;
  endereco?: string | null;
  telefone?: string | null;
  created_at?: string;
}

export interface Usuario {
  id: string;
  empresa_id: string;
  filial_id?: string | null;
  nome: string;
  email: string;
  cargo: CargoUsuario;
  remuneracao_tipo?: 'so_fixo' | 'so_comissao' | 'fixo_comissao' | null;
  salario_fixo?: number | null;
  comissao_percentual?: number | null;
  comissao_valor_fixo?: number | null;
  ativo?: boolean | null;
  created_at?: string;
}

export interface CodigoCortesiaResult {
  sucesso: boolean;
  mensagem?: string;
}

export interface KpiCardData {
  id: string;
  title: string;
  value: string;
  subtitle: string;
  icon: string;
}

export interface Cliente {
  id: string;
  empresa_id?: string;
  nome: string;
  cpf?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  bloqueado?: boolean;
  motivo_bloqueio?: string | null;
  limite_fiado?: number | null;
  created_at?: string;
}

export interface ClienteOcorrencia {
  id: string;
  cliente_id: string;
  categoria: 'financeira' | 'comportamental' | 'avaria_devolucao' | 'outro';
  descricao: string;
  created_at?: string;
}

export interface Produto {
  id: string;
  empresa_id?: string;
  codigo?: string | null;
  codigo_barras?: string | null;
  codigo_interno?: string | null;
  sku?: string | null;
  nome: string;
  unidade_medida?: string | null;
  preco_venda: number;
  descricao?: string | null;
  created_at?: string;
}

export interface ProdutoFilial {
  id: string;
  produto_id: string;
  filial_id: string;
  estoque_fisico: number;
  estoque_virtual?: number;
  localizacao_fisica?: string | null;
  preco_venda?: number | null;
  produto?: Produto;
}

export interface CartItem {
  produto_id: string;
  nome: string;
  codigo?: string | null;
  unidade_medida?: string | null;
  quantidade: number; // Decimal support
  preco_unitario: number;
  subtotal: number;
  estoque_disponivel: number;
  localizacao?: string | null;
}

export interface FiadoRecord {
  id: string;
  empresa_id?: string;
  cliente_id: string;
  venda_id?: string;
  valor_total: number;
  valor_pago?: number;
  status: 'em_aberto' | 'atrasado' | 'quitado';
  vencimento?: string | null;
  created_at?: string;
}

export interface Venda {
  id: string;
  empresa_id?: string;
  filial_id?: string;
  cliente_id?: string | null;
  vendedor_id?: string | null;
  valor_total: number;
  forma_pagamento: 'dinheiro' | 'cartao' | 'pix' | 'fiado' | 'misto';
  status: 'em_andamento' | 'finalizada' | 'cancelada';
  created_at?: string;
  cliente?: Cliente;
  vendedor?: Usuario;
}

export interface VendaItem {
  id: string;
  venda_id: string;
  produto_id: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  quantidade_devolvida: number;
  produto?: Produto;
}

export interface Devolucao {
  id: string;
  empresa_id?: string;
  venda_id: string;
  venda_item_id: string;
  quantidade: number;
  tipo_resolucao: 'troca' | 'estorno_cartao' | 'dinheiro' | 'credito_cliente' | 'voucher';
  valor_devolvido: number;
  voucher_codigo?: string | null;
  motivo?: string | null;
  created_at?: string;
}

export interface Veiculo {
  id: string;
  empresa_id?: string;
  placa: string;
  modelo: string;
  marca?: string | null;
  ano?: number | null;
  tipo: 'caminhao' | 'moto' | 'carro' | 'van';
  status: 'ativo' | 'manutencao' | 'inativo';
  created_at?: string;
}

export type StatusEntrega = 'atribuida' | 'a_caminho' | 'entregue' | 'nao_entregue' | 'entregue_com_avaria';

export interface Entrega {
  id: string;
  empresa_id?: string;
  venda_id: string;
  veiculo_id?: string | null;
  status: StatusEntrega;
  atribuido_por?: string | null;
  confirmado_por?: string | null;
  created_at?: string;
  updated_at?: string;
  venda?: Venda;
  veiculo?: Veiculo;
  entrega_entregadores?: { id: string; entregador_id: string; entregador?: Usuario }[];
  entrega_fotos?: EntregaFoto[];
  entrega_nao_entrega?: EntregaNaoEntrega[];
  entrega_avaria?: EntregaAvaria[];
}

export interface EntregaEntregador {
  id: string;
  entrega_id: string;
  entregador_id: string;
  entregador?: Usuario;
}

export interface EntregaFoto {
  id: string;
  entrega_id: string;
  tipo: 'comprovante_entrega' | 'nao_entrega' | 'avaria';
  foto_url: string;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string;
}

export type MotivoNaoEntrega =
  | 'ausente'
  | 'cliente_recusou'
  | 'endereco_nao_localizado'
  | 'sem_acesso_local'
  | 'avaria_transporte'
  | 'reagendamento';

export interface EntregaNaoEntrega {
  id: string;
  entrega_id: string;
  motivo: MotivoNaoEntrega;
  observacao?: string | null;
  created_at?: string;
}

export interface EntregaAvaria {
  id: string;
  entrega_id: string;
  decisao_cliente: 'aceitou' | 'recusou';
  status_resolucao: 'pendente' | 'resolvido';
  decisao_final?: string | null;
  observacao?: string | null;
  created_at?: string;
}

export interface ComissaoEntrega {
  id: string;
  empresa_id?: string;
  entrega_id: string;
  entregador_id: string;
  valor: number;
  status?: string;
  created_at?: string;
  entrega?: Entrega;
}

export interface ConfigComissaoEntrega {
  id: string;
  empresa_id?: string;
  ativo: boolean;
  tipo: 'percentual' | 'fixo';
  valor: number;
  dividir_entregadores: boolean;
  created_at?: string;
}

export interface NotificacaoRealtime {
  id: string;
  empresa_id?: string;
  mensagem: string;
  lida?: boolean;
  created_at?: string;
}

// Financeiro Interfaces
export interface Fornecedor {
  id: string;
  empresa_id?: string;
  nome: string;
  cnpj_cpf?: string | null;
  email?: string | null;
  telefone?: string | null;
  created_at?: string;
}

export interface ContaPagar {
  id: string;
  empresa_id?: string;
  filial_id?: string | null;
  fornecedor_id?: string | null;
  fornecedor_nome?: string | null;
  descricao: string;
  categoria?: string | null;
  valor: number;
  vencimento: string; // ISO YYYY-MM-DD
  forma_pagamento?: string | null;
  comprovante_url?: string | null;
  status: 'pendente' | 'pago' | 'vencido';
  pago_em?: string | null;
  pago_por?: string | null;
  pago_por_nome?: string | null;
  created_at?: string;
  fornecedor?: Fornecedor;
}

export interface PagamentoFuncionario {
  id: string;
  empresa_id?: string;
  funcionario_id: string;
  tipo: 'salario' | 'adiantamento' | 'ferias';
  valor: number;
  competencia_mes: number;
  competencia_ano: number;
  data_pagamento: string;
  observacao?: string | null;
  created_at?: string;
  funcionario?: Usuario;
}

export interface NotaFiscalEntrada {
  id: string;
  empresa_id?: string;
  filial_id?: string | null;
  numero_nota: string;
  chave_acesso?: string | null;
  fornecedor_nome: string;
  fornecedor_cnpj: string;
  valor_bruto: number;
  valor_impostos: number;
  valor_liquido: number;
  data_emissao?: string | null;
  vencimento?: string | null;
  status?: 'pendente' | 'processado' | 'cancelado';
  created_at?: string;
  itens?: NotaFiscalItem[];
}

export interface NotaFiscalItem {
  id: string;
  nota_id: string;
  codigo_fornecedor: string;
  descricao_fornecedor: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  produto_id_mapeado?: string | null;
  produto_mapeado?: Produto;
}

export interface MapeamentoProdutoFornecedor {
  id: string;
  empresa_id?: string;
  fornecedor_cnpj: string;
  codigo_fornecedor: string;
  produto_id: string;
  created_at?: string;
}

export interface BalancoMensal {
  filial_id?: string;
  filial_nome?: string;
  mes: number;
  ano: number;
  total_vendas: number;
  quantidade_vendas: number;
  total_contas_pagas?: number;
  lucro_liquido_estimado?: number;
}

// Inventario Interfaces
export interface Inventario {
  id: string;
  empresa_id?: string;
  filial_id: string;
  tipo: 'completo' | 'ciclico';
  modo_contagem: 'cega' | 'aberta';
  status: 'em_andamento' | 'finalizado' | 'cancelado';
  categoria_filtro?: string | null;
  localizacao_filtro?: string | null;
  criado_por?: string | null;
  criado_em?: string;
  finalizado_em?: string | null;
  created_at?: string;
  filial?: Filial;
  itens_count?: number;
  divergencias_count?: number;
}

export interface InventarioItem {
  id: string;
  inventario_id: string;
  produto_id: string;
  quantidade_sistema: number;
  quantidade_contada?: number | null;
  divergencia?: number | null;
  recontagem_necessaria?: boolean;
  motivo_ajuste?: 'quebra' | 'extravio' | 'erro_recebimento' | 'outro' | null;
  travado?: boolean;
  contado_por?: string | null;
  contado_em?: string | null;
  produto?: Produto;
  localizacao_fisica?: string | null;
}

// Chat Interfaces
export interface ChatMensagem {
  id: string;
  empresa_id?: string;
  filial_id?: string | null;
  remetente_id: string;
  destinatario_id?: string | null;
  tipo: 'individual' | 'transmissao';
  escopo_transmissao?: 'filial' | 'empresa' | null;
  conteudo: string;
  deletado?: boolean;
  editado?: boolean;
  created_at?: string;
  updated_at?: string;
  remetente?: Usuario;
  destinatario?: Usuario;
  leituras_count?: number;
  leituras?: ChatLeitura[];
}

export interface ChatLeitura {
  id: string;
  mensagem_id: string;
  usuario_id: string;
  lido_em: string;
  usuario?: Usuario;
}

// Suporte Interfaces
export interface ChamadoSuporte {
  id: string;
  empresa_id?: string;
  usuario_id: string;
  categoria: 'Bug' | 'Dúvida' | 'Sugestão' | 'Outro' | string;
  titulo: string;
  descricao: string;
  status: 'aberto' | 'em_analise' | 'resolvido';
  prazo_estimado?: string | null;
  created_at?: string;
  updated_at?: string;
  usuario?: Usuario;
  mensagens_count?: number;
}

export interface ChamadoMensagem {
  id: string;
  chamado_id: string;
  remetente_id: string;
  mensagem: string;
  suporte_resposta?: boolean;
  created_at?: string;
  remetente?: Usuario;
}

// Importador Interfaces
export interface Importacao {
  id: string;
  empresa_id?: string;
  usuario_id?: string;
  tipo: 'produtos' | 'estoque' | 'clientes' | 'fornecedores';
  status: 'pendente' | 'preview' | 'importado' | 'revertido';
  nome_arquivo?: string | null;
  total_linhas?: number;
  linhas_sucesso?: number;
  linhas_erro?: number;
  mapeamento_colunas?: Record<string, string> | null;
  created_at?: string;
  usuario?: Usuario;
}

export interface ImportacaoRegistro {
  id: string;
  importacao_id: string;
  linha_numero: number;
  dados_originais: Record<string, any>;
  dados_mapeados: Record<string, any>;
  status: 'pendente' | 'ok' | 'erro';
  mensagem_erro?: string | null;
  entidade_criada_id?: string | null;
}


