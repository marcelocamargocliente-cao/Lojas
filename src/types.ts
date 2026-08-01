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
  nome: string;
  email: string;
  cargo: CargoUsuario;
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
  nome: string;
  unidade?: string | null;
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
  unidade?: string | null;
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
  preco_unitario: number;
  subtotal: number;
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
