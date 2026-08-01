import React, { useState, useEffect } from 'react';
import { DollarSign, Settings, Users, Save, CheckCircle2, AlertCircle, Percent, Coins } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { ConfigComissaoEntrega, Usuario } from '../types';
import { useAuth } from '../context/AuthContext';

export const ConfigComissaoPage: React.FC = () => {
  const { empresa } = useAuth();

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);
  const [erroMsg, setErroMsg] = useState<string | null>(null);

  // Global commission config
  const [config, setConfig] = useState<ConfigComissaoEntrega>({
    id: '',
    empresa_id: empresa?.id,
    ativo: true,
    tipo: 'fixo',
    valor: 15.0,
    dividir_entregadores: true,
  });

  // Deliverers compensation table
  const [entregadores, setEntregadores] = useState<Usuario[]>([]);

  const loadData = async () => {
    setLoading(true);
    setErroMsg(null);
    try {
      // 1. Load company commission config
      if (empresa?.id) {
        const { data: cfgData } = await supabase
          .from('config_comissao_entrega')
          .select('*')
          .eq('empresa_id', empresa.id)
          .maybeSingle();

        if (cfgData) {
          setConfig(cfgData as ConfigComissaoEntrega);
        }
      }

      // 2. Load deliverers
      const { data: entData } = await supabase
        .from('usuarios')
        .select('*')
        .eq('empresa_id', empresa?.id)
        .eq('cargo', 'entregador');

      if (entData) {
        setEntregadores(entData as Usuario[]);
      }
    } catch (err: any) {
      setErroMsg(err?.message || 'Erro ao carregar configurações de comissão.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [empresa?.id]);

  const handleSaveGlobalConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setSucessoMsg(null);
    setErroMsg(null);

    try {
      if (config.id) {
        const { error } = await supabase
          .from('config_comissao_entrega')
          .update({
            ativo: config.ativo,
            tipo: config.tipo,
            valor: Number(config.valor),
            dividir_entregadores: config.dividir_entregadores,
          })
          .eq('id', config.id);

        if (error) throw error;
      } else {
        const { data: newCfg, error } = await supabase
          .from('config_comissao_entrega')
          .insert({
            empresa_id: empresa?.id,
            ativo: config.ativo,
            tipo: config.tipo,
            valor: Number(config.valor),
            dividir_entregadores: config.dividir_entregadores,
          })
          .select()
          .single();

        if (error) throw error;
        if (newCfg) setConfig(newCfg as ConfigComissaoEntrega);
      }

      setSucessoMsg('Configuração global de comissões salva com sucesso!');
    } catch (err: any) {
      setErroMsg(err?.message || 'Falha ao salvar regras globais.');
    } finally {
      setSalvando(false);
    }
  };

  const handleUpdateEntregador = async (
    id: string,
    campos: Partial<Usuario>
  ) => {
    // Update local state immediately
    setEntregadores((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...campos } : e))
    );

    try {
      const { error } = await supabase
        .from('usuarios')
        .update(campos)
        .eq('id', id);

      if (error) {
        console.warn('Erro ao atualizar usuário entregador:', error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="pb-4 border-b border-[#E5E5E5]">
        <h1 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-[#F5D800]" />
          Regras de Comissionamento & Salário de Entregadores
        </h1>
        <p className="text-xs text-zinc-600 mt-0.5">
          Configure a taxa de frete repassada por entrega, regra de divisão entre equipe e modalidades salariais dos entregadores.
        </p>
      </div>

      {sucessoMsg && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-900 text-xs rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <span>{sucessoMsg}</span>
        </div>
      )}

      {erroMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{erroMsg}</span>
        </div>
      )}

      {/* Global Config Form */}
      <div className="industrial-card p-6">
        <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2 pb-3 border-b border-[#E5E5E5] mb-4">
          <Settings className="w-4 h-4 text-zinc-500" />
          Regra Geral da Empresa por Entrega Concluída
        </h2>

        <form onSubmit={handleSaveGlobalConfig} className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="ativo"
              checked={config.ativo}
              onChange={(e) => setConfig({ ...config, ativo: e.target.checked })}
              className="w-4 h-4 accent-zinc-900 rounded"
            />
            <label htmlFor="ativo" className="text-xs font-bold text-zinc-900 cursor-pointer">
              Ativar pagamento de comissões por entrega finalizada
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Tipo de Cálculo
              </label>
              <select
                value={config.tipo}
                onChange={(e: any) => setConfig({ ...config, tipo: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
              >
                <option value="fixo">Valor Fixo por Entrega (R$)</option>
                <option value="percentual">Percentual sobre a Venda (%)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                {config.tipo === 'fixo' ? 'Valor Fixo (R$)' : 'Percentual (%)'}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={config.valor}
                onChange={(e) => setConfig({ ...config, valor: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 font-mono font-bold"
              />
            </div>

            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-800">
                <input
                  type="checkbox"
                  checked={config.dividir_entregadores}
                  onChange={(e) =>
                    setConfig({ ...config, dividir_entregadores: e.target.checked })
                  }
                  className="w-4 h-4 accent-zinc-900 rounded"
                />
                <span className="font-semibold leading-tight">
                  Dividir comissão igualmente quando houver múltiplos entregadores na rota
                </span>
              </label>
            </div>
          </div>

          <div className="pt-3 border-t border-[#E5E5E5] flex justify-end">
            <button
              type="submit"
              disabled={salvando}
              className="py-2 px-4 bg-[#F5D800] hover:bg-[#ebd000] text-zinc-950 font-bold text-xs rounded-lg border border-[#d2b800] flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{salvando ? 'Salvando...' : 'Salvar Regra Global'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Deliverers Salary & Individual Config Table */}
      <div className="industrial-card overflow-hidden">
        <div className="p-4 bg-zinc-50 border-b border-[#E5E5E5] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-zinc-500" />
              Modalidades Salariais por Entregador
            </h2>
            <p className="text-[11px] text-zinc-500">
              Defina se cada colaborador possui salário fixo registrado, apenas comissão ou modelo misto.
            </p>
          </div>
        </div>

        {entregadores.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500">
            Nenhum entregador encontrado cadastrado no sistema.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-[#E5E5E5] text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Nome / E-mail</th>
                  <th className="py-2.5 px-3">Tipo Remuneração</th>
                  <th className="py-2.5 px-3">Salário Fixo Mensal (R$)</th>
                  <th className="py-2.5 px-3">Comissão Individual Fixo / %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {entregadores.map((ent) => (
                  <tr key={ent.id} className="hover:bg-zinc-50">
                    <td className="py-3 px-3">
                      <span className="font-bold text-zinc-900 block">{ent.nome}</span>
                      <span className="text-[11px] text-zinc-500">{ent.email}</span>
                    </td>

                    <td className="py-3 px-3">
                      <select
                        value={ent.remuneracao_tipo || 'so_comissao'}
                        onChange={(e: any) =>
                          handleUpdateEntregador(ent.id, { remuneracao_tipo: e.target.value })
                        }
                        className="px-2 py-1 bg-white border border-[#E5E5E5] rounded text-xs text-zinc-900"
                      >
                        <option value="so_fixo">Apenas Salário Fixo</option>
                        <option value="so_comissao">Apenas Comissão</option>
                        <option value="fixo_comissao">Fixo + Comissão</option>
                      </select>
                    </td>

                    <td className="py-3 px-3">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={ent.salario_fixo ?? ''}
                        onChange={(e) =>
                          handleUpdateEntregador(ent.id, {
                            salario_fixo: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-28 px-2 py-1 bg-white border border-[#E5E5E5] rounded font-mono text-xs text-zinc-900"
                      />
                    </td>

                    <td className="py-3 px-3 space-x-2">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Comissão Fictícia R$"
                        value={ent.comissao_valor_fixo ?? ''}
                        onChange={(e) =>
                          handleUpdateEntregador(ent.id, {
                            comissao_valor_fixo: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-28 px-2 py-1 bg-white border border-[#E5E5E5] rounded font-mono text-xs text-zinc-900"
                      />
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
