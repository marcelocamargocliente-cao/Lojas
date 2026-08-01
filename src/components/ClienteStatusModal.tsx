import React, { useEffect, useState } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, ShieldAlert, X, DollarSign, FileText } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Cliente, ClienteOcorrencia, FiadoRecord } from '../types';

interface ClienteStatusModalProps {
  cliente: Cliente;
  onClose: () => void;
  onConfirmProceed: () => void;
  onCancelSelection: () => void;
}

export const ClienteStatusModal: React.FC<ClienteStatusModalProps> = ({
  cliente,
  onClose,
  onConfirmProceed,
  onCancelSelection,
}) => {
  const [loading, setLoading] = useState(true);
  const [fiadoPendentes, setFiadoPendentes] = useState<FiadoRecord[]>([]);
  const [totalFiadoDevido, setTotalFiadoDevido] = useState<number>(0);
  const [ocorrencias, setOcorrencias] = useState<ClienteOcorrencia[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function loadCustomerStatus() {
      setLoading(true);
      try {
        // Fetch open or overdue fiado records
        const { data: fiadoData } = await supabase
          .from('fiado')
          .select('*')
          .eq('cliente_id', cliente.id)
          .in('status', ['em_aberto', 'atrasado']);

        // Fetch customer occurrences
        const { data: ocorrenciasData } = await supabase
          .from('cliente_ocorrencias')
          .select('*')
          .eq('cliente_id', cliente.id)
          .order('created_at', { ascending: false });

        if (isMounted) {
          if (fiadoData) {
            const list = fiadoData as FiadoRecord[];
            setFiadoPendentes(list);
            const total = list.reduce(
              (acc, f) => acc + (Number(f.valor_total || 0) - Number(f.valor_pago || 0)),
              0
            );
            setTotalFiadoDevido(total);
          }
          if (ocorrenciasData) {
            setOcorrencias(ocorrenciasData as ClienteOcorrencia[]);
          }
        }
      } catch (err) {
        console.error('Erro ao verificar status do cliente:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadCustomerStatus();
    return () => {
      isMounted = false;
    };
  }, [cliente.id]);

  const temPendencias = totalFiadoDevido > 0 || ocorrencias.length > 0;

  return (
    <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="industrial-card p-6 max-w-lg w-full bg-white shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E5] mb-5">
          <div className="flex items-center gap-2">
            {cliente.bloqueado ? (
              <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center">
                <AlertOctagon className="w-5 h-5" />
              </div>
            ) : temPendencias ? (
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-green-100 text-green-700 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-zinc-900">
                Análise do cliente (uso interno do vendedor)
              </h3>
              <p className="text-[11px] text-zinc-500">
                {cliente.nome} {cliente.cpf ? `• CPF: ${cliente.cpf}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancelSelection}
            className="text-zinc-400 hover:text-zinc-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center space-y-2">
            <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin mx-auto" />
            <p className="text-xs text-zinc-500">Consultando pendências e histórico...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Case 1: CLIENT BLOQUEADO */}
            {cliente.bloqueado ? (
              <div className="p-4 bg-red-50 border border-red-300 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-red-900 font-bold text-sm">
                  <ShieldAlert className="w-5 h-5 text-red-700 shrink-0" />
                  <span>CLIENTE BLOQUEADO PARA VENDA</span>
                </div>
                <p className="text-xs text-red-800 leading-relaxed">
                  <span className="font-semibold">Motivo do bloqueio:</span>{' '}
                  {cliente.motivo_bloqueio || 'Bloqueio administrativo registrado no cadastro.'}
                </p>
                <div className="pt-2 text-[11px] font-semibold text-red-900 uppercase tracking-wide">
                  ⚠️ O sistema impede a realização de novas vendas para este cliente até regularização com a gerência.
                </div>
              </div>
            ) : (
              <>
                {/* Case 2: PENDÊNCIA DE FIADO */}
                {totalFiadoDevido > 0 && (
                  <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                        <DollarSign className="w-4 h-4 text-amber-700" />
                        PENDÊNCIA DE FIADO EM ABERTO
                      </span>
                      <span className="text-sm font-extrabold text-amber-900">
                        R$ {totalFiadoDevido.toFixed(2)}
                      </span>
                    </div>

                    <div className="max-h-28 overflow-y-auto divide-y divide-amber-200/60 pt-2 text-xs">
                      {fiadoPendentes.map((f) => (
                        <div key={f.id} className="py-1.5 flex items-center justify-between text-amber-950">
                          <div>
                            <span className="font-medium">
                              {f.status === 'atrasado' ? '🔴 Em atraso' : '🟡 Em aberto'}
                            </span>
                            {f.vencimento && (
                              <span className="text-[10px] text-amber-800 ml-2">
                                Venc: {new Date(f.vencimento).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>
                          <span className="font-semibold">
                            R$ {(Number(f.valor_total || 0) - Number(f.valor_pago || 0)).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Case 3: OCORRÊNCIAS REGISTRADAS */}
                {ocorrencias.length > 0 && (
                  <div className="p-3.5 border border-[#E5E5E5] bg-zinc-50 rounded-lg space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900">
                      <FileText className="w-4 h-4 text-zinc-600" />
                      <span>Ocorrências registradas ({ocorrencias.length})</span>
                    </div>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto text-xs">
                      {ocorrencias.map((oc) => (
                        <div
                          key={oc.id}
                          className="p-2 bg-white border border-[#E5E5E5] rounded flex flex-col gap-0.5"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold uppercase text-zinc-700">
                              {oc.categoria}
                            </span>
                            {oc.created_at && (
                              <span className="text-zinc-400">
                                {new Date(oc.created_at).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>
                          <p className="text-zinc-600 text-xs">{oc.descricao}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Case 4: TUDO CERTO */}
                {!temPendencias && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-green-900">
                        Cliente sem pendências
                      </h4>
                      <p className="text-xs text-green-700 mt-0.5">
                        Cadastro regular. Limite de fiado disponível: R${' '}
                        {(cliente.limite_fiado || 0).toFixed(2)}.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-[#E5E5E5] flex items-center justify-end gap-2">
          {cliente.bloqueado ? (
            <button
              type="button"
              onClick={onCancelSelection}
              className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
            >
              Entendido (Desmarcar cliente)
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onCancelSelection}
                className="py-2 px-3 text-xs text-zinc-600 hover:text-zinc-900 font-medium"
              >
                Trocar cliente
              </button>
              <button
                type="button"
                onClick={onConfirmProceed}
                className="py-2 px-5 bg-[#F5D800] hover:bg-[#ebd000] text-zinc-950 font-bold text-xs rounded-lg border border-[#d2b800] shadow-2xs transition-colors cursor-pointer"
              >
                Continuar venda
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
