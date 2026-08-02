import React, { useState, useEffect } from 'react';
import { DollarSign, Calendar, TrendingUp, CheckCircle2, Award, RefreshCw, Wallet } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { ComissaoEntrega, Usuario } from '../types';
import { useAuth } from '../context/AuthContext';

export const MeusGanhosPage: React.FC = () => {
  const { user, empresa } = useAuth();

  const [comissoes, setComissoes] = useState<ComissaoEntrega[]>([]);
  const [perfil, setPerfil] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  const loadGanhos = async () => {
    setLoading(true);
    try {
      // 1. Fetch deliverer profile
      const { data: uData } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (uData) setPerfil(uData as Usuario);

      // 2. Fetch commissions
      const { data: cData } = await supabase
        .from('comissao_entrega')
        .select(`
          *,
          entrega:entregas(
            *,
            venda:vendas(
              *,
              cliente:clientes(*)
            )
          )
        `)
        .eq('entregador_id', user?.id)
        .order('created_at', { ascending: false });

      if (cData) {
        setComissoes(cData as ComissaoEntrega[]);
      }
    } catch (err) {
      console.error('Erro ao buscar ganhos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadGanhos();
    }
  }, [user?.id]);

  const totalComissoes = comissoes.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
  const salarioFixo = Number(perfil?.salario_fixo) || 0;
  const totalEstimadoMes = salarioFixo + totalComissoes;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E5]">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#F5D800]" />
            Extrato de Ganhos & Comissões
          </h1>
          <p className="text-xs text-zinc-600 mt-0.5">
            Acompanhe seu rendimento acumulado por entregas efetuadas no mês atual.
          </p>
        </div>

        <button
          type="button"
          onClick={loadGanhos}
          className="py-1.5 px-3 bg-white hover:bg-zinc-50 border border-[#E5E5E5] text-zinc-700 font-medium text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Atualizar</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-interativo p-4 space-y-1">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
            Salário Fixo Cadastrado
          </span>
          <span className="text-lg font-bold font-mono text-zinc-900 block">
            R$ {salarioFixo.toFixed(2)}
          </span>
          <span className="text-[10px] text-zinc-500">
            {perfil?.remuneracao_tipo === 'so_comissao'
              ? 'Modalidade 100% comissionado'
              : 'Base fixa mensal'}
          </span>
        </div>

        <div className="card-interativo p-4 space-y-1 bg-amber-50/50 border-[#F5D800]">
          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
            Comissões por Entregas
          </span>
          <span className="text-lg font-bold font-mono text-zinc-950 block">
            R$ {totalComissoes.toFixed(2)}
          </span>
          <span className="text-[10px] text-amber-900 font-medium">
            {comissoes.length} entregas remuneradas
          </span>
        </div>

        <div className="card-interativo p-4 space-y-1 bg-zinc-900 text-white border-l-[#F5D800]">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
            Rendimento Total Estimado
          </span>
          <span className="text-xl font-bold font-mono text-[#F5D800] block">
            R$ {totalEstimadoMes.toFixed(2)}
          </span>
          <span className="text-[10px] text-zinc-400">
            Fixo + Comissões do mês
          </span>
        </div>
      </div>

      {/* Table of commissions */}
      <div className="industrial-card overflow-hidden">
        <div className="p-3.5 bg-zinc-50 border-b border-[#E5E5E5] flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
            Histórico de Entregas Comissionadas ({comissoes.length})
          </span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-zinc-500 space-y-2">
            <div className="w-5 h-5 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin mx-auto" />
            <p>Carregando comissões...</p>
          </div>
        ) : comissoes.length === 0 ? (
          <div className="p-10 text-center text-xs text-zinc-500">
            Nenhuma comissão registrada para sua conta ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-[#E5E5E5] text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Data</th>
                  <th className="py-2.5 px-3">Venda / Cliente</th>
                  <th className="py-2.5 px-3 text-right">Valor da Comissão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {comissoes.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-50">
                    <td className="py-3 px-3 font-mono text-zinc-600">
                      {c.created_at
                        ? new Date(c.created_at).toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-zinc-900 block">
                        Venda #{c.entrega?.venda_id?.substring(0, 8)}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {c.entrega?.venda?.cliente?.nome || 'Consumidor'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-green-700">
                      + R$ {Number(c.valor || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
