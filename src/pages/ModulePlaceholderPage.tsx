import React from 'react';
import { useLocation } from 'react-router-dom';
import { 
  ShoppingCart, 
  Package, 
  Users, 
  Truck, 
  DollarSign, 
  Boxes, 
  MessageSquare, 
  Settings,
  Construction
} from 'lucide-react';

interface ModuleConfig {
  title: string;
  description: string;
  icon: React.ElementType;
}

const MODULES_MAP: Record<string, ModuleConfig> = {
  pdv: {
    title: 'Ponto de venda (PDV)',
    description: 'Interface de caixa rápida para emissão de vendas no balcão da loja.',
    icon: ShoppingCart,
  },
  estoque: {
    title: 'Gestão de estoque',
    description: 'Controle de saldo por filial, movimentações de entrada e saída.',
    icon: Package,
  },
  clientes: {
    title: 'Cadastro de clientes',
    description: 'Gestão de limite de crédito, histórico de compras e contas de fiado.',
    icon: Users,
  },
  entregas: {
    title: 'Controle de entregas',
    description: 'Roteirização de frotas e acompanhamento de fretes de material pesado.',
    icon: Truck,
  },
  financeiro: {
    title: 'Gestão financeira',
    description: 'Fluxo de caixa, contas a pagar, contas a receber e conciliação.',
    icon: DollarSign,
  },
  inventario: {
    title: 'Inventário físico',
    description: 'Contagem cega de estoque e balanço periódico de materiais.',
    icon: Boxes,
  },
  chat: {
    title: 'Comunicação interna',
    description: 'Chat integrado entre caixa, vendedores, depósito e entregadores.',
    icon: MessageSquare,
  },
  configuracoes: {
    title: 'Configurações do sistema',
    description: 'Parâmetros da empresa, tabela de alíquotas e gestão de usuários.',
    icon: Settings,
  },
};

export const ModulePlaceholderPage: React.FC = () => {
  const location = useLocation();
  const pathSegment = location.pathname.split('/').pop() || '';
  const moduleInfo = MODULES_MAP[pathSegment] || {
    title: 'Módulo do sistema',
    description: 'Área funcional do sistema de gestão de material de construção.',
    icon: Construction,
  };

  const Icon = moduleInfo.icon;

  return (
    <div className="space-y-6">
      <div className="industrial-card p-8">
        <div className="flex items-start gap-4 pb-6 border-b border-[#E5E5E5] mb-6">
          <div className="w-12 h-12 rounded-lg bg-[#F5D800] text-black flex items-center justify-center border border-[#d2b800] shrink-0">
            <Icon className="w-6 h-6 stroke-[1.75]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900">
              {moduleInfo.title}
            </h1>
            <p className="text-xs text-zinc-600 mt-1">
              {moduleInfo.description}
            </p>
          </div>
        </div>

        <div className="p-6 bg-zinc-50 border border-[#E5E5E5] rounded-lg text-center space-y-3 max-w-lg mx-auto my-8">
          <div className="w-10 h-10 rounded-full bg-white border border-[#E5E5E5] flex items-center justify-center mx-auto text-zinc-500">
            <Construction className="w-5 h-5 text-zinc-700" />
          </div>
          <h2 className="text-sm font-semibold text-zinc-900">
            Módulo pronto para expansão
          </h2>
          <p className="text-xs text-zinc-600 leading-relaxed">
            A estrutura visual e de roteamento para o módulo <span className="font-semibold text-zinc-900">{moduleInfo.title}</span> está configurada e integrada com o filtro RLS por empresa do Supabase.
          </p>
        </div>
      </div>
    </div>
  );
};
