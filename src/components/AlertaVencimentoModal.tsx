import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  X, 
  Calendar, 
  DollarSign, 
  Building2, 
  ArrowRight,
  ChevronRight,
  FileText
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { ContaPagar } from '../types';
import { useAuth } from '../context/AuthContext';

interface AlertaVencimentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export const AlertaVencimentoModal: React.FC<AlertaVencimentoModalProps> = ({
  isOpen,
  onClose,
  onUpdated
}) => {
  const { usuarioProfile, selectedFilial } = useAuth();
  const [loading, setLoading] = useState(false);
  const [contasVencidas, setContasVencidas] = useState<ContaPagar[]>([]);
  const [contasAVencer, setContasAVencer] = useState<ContaPagar[]>([]);
  const [selectedConta, setSelectedConta] = useState<ContaPagar | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchAlertas();
    }
  }, [isOpen, selectedFilial]);

  const fetchAlertas = async () => {
    setLoading(true);
    try {
      const hojeStr = new Date().toISOString().split('T')[0];
      const daqui5Dias = new Date();
      daqui5Dias.setDate(daqui5Dias.getDate() + 5);
      const daqui5DiasStr = daqui5Dias.toISOString().split('T')[0];

      // Query pending bills
      let query = supabase
        .from('contas_pagar')
        .select('*')
        .eq('status', 'pendente');

      if (selectedFilial?.id) {
        query = query.eq('filial_id', selectedFilial.id);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('Erro ao buscar alertas de contas:', error.message);
        setContasVencidas([]);
        setContasAVencer([]);
      } else if (data) {
        const vencidas: ContaPagar[] = [];
        const aVencer: ContaPagar[] = [];

        data.forEach((c) => {
          const venc = c.vencimento ? c.vencimento.split('T')[0] : '';
          if (venc < hojeStr) {
            vencidas.push({ ...c, status: 'vencido' });
          } else if (venc >= hojeStr && venc <= daqui5DiasStr) {
            aVencer.push(c);
          }
        });

        // Vencidas sorted from oldest to newest (ascending vencimento)
        vencidas.sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));
        // A vencer sorted nearest first
        aVencer.sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));

        setContasVencidas(vencidas);
        setContasAVencer(aVencer);
      }
    } catch (err) {
      console.error('Erro de conexao ao carregar alertas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDarBaixa = async (conta: ContaPagar) => {
    setPayingId(conta.id);
    setSuccessMsg(null);
    try {
      const agora = new Date().toISOString();
      const usuarioNome = usuarioProfile?.nome || 'Usuário';

      const { error } = await supabase
        .from('contas_pagar')
        .update({
          status: 'pago',
          pago_em: agora,
          pago_por: usuarioProfile?.id || null,
          pago_por_nome: usuarioNome
        })
        .eq('id', conta.id);

      if (error) {
        alert('Não foi possível dar baixa: ' + error.message);
      } else {
        setSuccessMsg(`Conta "${conta.descricao}" marcada como PAGA com sucesso!`);
        setSelectedConta(null);
        fetchAlertas();
        if (onUpdated) onUpdated();
      }
    } catch (err) {
      console.error('Erro ao dar baixa:', err);
    } finally {
      setPayingId(null);
    }
  };

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  const getDiasAtraso = (vencimentoStr: string) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const venc = new Date(vencimentoStr + 'T00:00:00');
    const diffTime = hoje.getTime() - venc.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  if (!isOpen) return null;

  const totalVencidas = contasVencidas.reduce((acc, c) => acc + (c.valor || 0), 0);
  const totalAVencer = contasAVencer.reduce((acc, c) => acc + (c.valor || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-[#E5E5E5] bg-zinc-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-red-100 border border-red-200 text-red-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-zinc-900">
                Alertas de Vencimento de Contas
              </h3>
              <p className="text-xs text-zinc-500">
                Contas em atraso ou prestes a vencer nos próximos 5 dias
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert Banner */}
        {successMsg && (
          <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:underline text-[11px]">
              Fechar
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-12 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-zinc-300 border-t-[#F5D800] rounded-full animate-spin" />
              Verificando compromissos financeiros...
            </div>
          ) : contasVencidas.length === 0 && contasAVencer.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto stroke-[1.5]" />
              <p className="text-sm font-semibold text-zinc-800">Tudo em dia!</p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Não há contas pendentes vencidas ou a vencer nos próximos 5 dias.
              </p>
            </div>
          ) : (
            <>
              {/* Summary Badges */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium text-red-700 block">Contas Vencidas</span>
                    <span className="text-base font-bold text-red-900">{formatMoney(totalVencidas)}</span>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-200 text-red-900">
                    {contasVencidas.length}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium text-amber-800 block">Vencem em até 5 dias</span>
                    <span className="text-base font-bold text-amber-900">{formatMoney(totalAVencer)}</span>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                    {contasAVencer.length}
                  </span>
                </div>
              </div>

              {/* 1. Contas Vencidas Section */}
              {contasVencidas.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-red-700 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                      Contas Vencidas ({contasVencidas.length})
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      Ordenadas da mais antiga à mais recente
                    </span>
                  </div>

                  <div className="divide-y divide-[#E5E5E5] border border-red-200 rounded-lg overflow-hidden bg-white">
                    {contasVencidas.map((conta) => {
                      const diasAtraso = getDiasAtraso(conta.vencimento);
                      return (
                        <div
                          key={conta.id}
                          className="p-3 bg-red-50/40 hover:bg-red-50/80 transition-colors flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-zinc-900 truncate">
                                {conta.descricao}
                              </span>
                              {conta.categoria && (
                                <span className="text-[10px] bg-zinc-200 text-zinc-700 px-1.5 py-0.2 rounded font-medium">
                                  {conta.categoria}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-600">
                              <span className="flex items-center gap-1 font-medium text-zinc-800">
                                <Building2 className="w-3 h-3 text-zinc-400" />
                                {conta.fornecedor_nome || 'Fornecedor não informado'}
                              </span>
                              <span className="text-red-700 font-semibold flex items-center gap-1">
                                <Clock className="w-3 h-3 text-red-600" />
                                Venceu em {formatDate(conta.vencimento)} ({diasAtraso}d em atraso)
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-sm font-bold text-red-900">
                              {formatMoney(conta.valor)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDarBaixa(conta)}
                              disabled={payingId === conta.id}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg transition-colors shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{payingId === conta.id ? 'Baixando...' : 'Dar baixa'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. Contas a vencer nos proximos 5 dias */}
              {contasAVencer.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      A Vencer nos Próximos 5 Dias ({contasAVencer.length})
                    </span>
                  </div>

                  <div className="divide-y divide-[#E5E5E5] border border-[#E5E5E5] rounded-lg overflow-hidden bg-white">
                    {contasAVencer.map((conta) => (
                      <div
                        key={conta.id}
                        className="p-3 hover:bg-zinc-50 transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-zinc-900 truncate">
                              {conta.descricao}
                            </span>
                            {conta.categoria && (
                              <span className="text-[10px] bg-zinc-100 text-zinc-600 px-1.5 py-0.2 rounded font-medium">
                                {conta.categoria}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-600">
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-zinc-400" />
                              {conta.fornecedor_nome || 'Fornecedor'}
                            </span>
                            <span className="text-amber-800 font-medium flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-amber-600" />
                              Vence {formatDate(conta.vencimento)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-bold text-zinc-900">
                            {formatMoney(conta.valor)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDarBaixa(conta)}
                            disabled={payingId === conta.id}
                            className="px-3 py-1.5 border border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-medium text-xs rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{payingId === conta.id ? 'Baixando...' : 'Dar baixa'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-[#E5E5E5] bg-zinc-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#E5E5E5] bg-white hover:bg-zinc-100 text-xs font-semibold text-zinc-700 rounded-lg transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>

      </div>
    </div>
  );
};
