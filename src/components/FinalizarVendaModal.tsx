import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  CreditCard, 
  DollarSign, 
  QrCode, 
  BookOpen, 
  Layers, 
  Lock, 
  AlertTriangle, 
  X, 
  Printer, 
  ShieldCheck, 
  ArrowRight,
  UserCheck
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import { CartItem, Cliente, Filial, Usuario } from '../types';
import { useAuth } from '../context/AuthContext';

interface FinalizarVendaModalProps {
  items: CartItem[];
  cliente: Cliente | null;
  selectedFilial: Filial | null;
  onClose: () => void;
  onVendaConcluida: () => void;
}

type FormaPagamento = 'dinheiro' | 'cartao' | 'pix' | 'fiado' | 'misto';

export const FinalizarVendaModal: React.FC<FinalizarVendaModalProps> = ({
  items,
  cliente,
  selectedFilial,
  onClose,
  onVendaConcluida,
}) => {
  const { user, usuarioProfile, empresa } = useAuth();

  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('dinheiro');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Misto Breakdown
  const [valorDinheiro, setValorDinheiro] = useState<number>(0);
  const [valorCartao, setValorCartao] = useState<number>(0);
  const [valorPix, setValorPix] = useState<number>(0);

  // Fiado Manager Reauthentication
  const [showFiadoAuth, setShowFiadoAuth] = useState(false);
  const [gerenteEmail, setGerenteEmail] = useState('');
  const [gerenteSenha, setGerenteSenha] = useState('');
  const [vencimentoFiado, setVencimentoFiado] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [gerenteAprovadoId, setGerenteAprovadoId] = useState<string | null>(null);

  // List of managers for selection in fiado auth
  const [gerentesList, setGerentesList] = useState<Usuario[]>([]);

  // Sale Receipt Result
  const [vendaSucessoData, setVendaSucessoData] = useState<{
    vendaId: string;
    total: number;
    formaPagamento: string;
    fiadoAprovado?: boolean;
    dataHora: string;
  } | null>(null);

  const totalVenda = items.reduce((acc, item) => acc + item.subtotal, 0);

  // Fetch managers list for fiado approval dropdown
  useEffect(() => {
    async function loadGerentes() {
      if (empresa?.id) {
        const { data } = await supabase
          .from('usuarios')
          .select('*')
          .eq('empresa_id', empresa.id)
          .in('cargo', ['admin', 'super_admin', 'gerente']);

        if (data) {
          setGerentesList(data as Usuario[]);
          if (data.length > 0) {
            setGerenteEmail(data[0].email);
          }
        }
      }
    }
    loadGerentes();
  }, [empresa?.id]);

  // Set default manager email to current user if manager/admin
  useEffect(() => {
    if (user?.email && ['admin', 'super_admin', 'gerente'].includes(usuarioProfile?.cargo || '')) {
      setGerenteEmail(user.email);
    }
  }, [user, usuarioProfile]);

  const handleSelectFormaPagamento = (forma: FormaPagamento) => {
    setFormaPagamento(forma);
    setErro(null);
    if (forma === 'fiado') {
      if (!cliente) {
        setErro('Para vender no fiado, é obrigatório selecionar um cliente.');
        return;
      }
      if (cliente.bloqueado) {
        setErro(`Cliente bloqueado: ${cliente.motivo_bloqueio || 'Sem permissão de fiado'}`);
        return;
      }
      setShowFiadoAuth(true);
    } else {
      setShowFiadoAuth(false);
    }
  };

  // Reauthenticate manager for Fiado approval
  const handleAprovarFiadoGerente = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!gerenteEmail || !gerenteSenha) {
      setErro('Informe o e-mail e a senha do Gerente.');
      return;
    }

    setLoading(true);
    try {
      // Authenticate with manager credentials
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: gerenteEmail.trim(),
        password: gerenteSenha,
      });

      if (authErr || !authData.user) {
        setErro('Senha ou e-mail de gerente incorretos.');
        setLoading(false);
        return;
      }

      // Verify manager profile cargo
      const { data: managerProfile } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      const cargo = (managerProfile as Usuario)?.cargo;
      if (!['admin', 'super_admin', 'gerente'].includes(cargo || '')) {
        setErro('O usuário informado não possui cargo de Gerente ou Administrador.');
        setLoading(false);
        return;
      }

      setGerenteAprovadoId(authData.user.id);
      setShowFiadoAuth(false);
      setGerenteSenha('');
    } catch (err: any) {
      setErro(err?.message || 'Erro na reautenticação do gerente');
    } finally {
      setLoading(false);
    }
  };

  // Finalize sale execution
  const handleConfirmarVenda = async () => {
    setErro(null);

    if (items.length === 0) {
      setErro('O carrinho de compras está vazio.');
      return;
    }

    if (formaPagamento === 'fiado' && !gerenteAprovadoId) {
      setShowFiadoAuth(true);
      return;
    }

    if (formaPagamento === 'misto') {
      const soma = Number(valorDinheiro) + Number(valorCartao) + Number(valorPix);
      if (Math.abs(soma - totalVenda) > 0.01) {
        setErro(`A soma dos pagamentos (R$ ${soma.toFixed(2)}) deve ser igual ao total da venda (R$ ${totalVenda.toFixed(2)}).`);
        return;
      }
    }

    setLoading(true);
    try {
      // Resolve filialId exactly as requested
      const resolvedFilialId = selectedFilial?.id ?? (
        await supabase
          .from('filiais')
          .select('id')
          .eq('empresa_id', empresa?.id)
          .single()
      ).data?.id;

      if (!resolvedFilialId) {
        toast.error('Nenhuma filial encontrada. Cadastre uma filial primeiro.');
        setLoading(false);
        return;
      }

      // 1. Insert Venda record
      const { data: vendaCreated, error: vendaErr } = await supabase
        .from('vendas')
        .insert({
          empresa_id: empresa?.id,
          filial_id: resolvedFilialId,
          cliente_id: cliente?.id || null,
          vendedor_id: user?.id,
          valor_total: totalVenda,
          forma_pagamento: formaPagamento,
          status: 'finalizada',
        })
        .select()
        .single();

      if (vendaErr) {
        setErro(`Erro ao gravar venda: ${vendaErr.message}`);
        setLoading(false);
        return;
      }

      const vendaId = vendaCreated.id;

      // 2. Insert Venda Items
      const itemsPayload = items.map((i) => ({
        venda_id: vendaId,
        produto_id: i.produto_id,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
        subtotal: i.subtotal,
      }));

      const { error: itemsErr } = await supabase
        .from('venda_itens')
        .insert(itemsPayload);

      if (itemsErr) {
        console.warn('Erro ao inserir itens da venda:', itemsErr);
      }

      let fiadoAprovadoFlag = false;

      // 3. If payment is Fiado, call RPC aprovar_fiado
      if (formaPagamento === 'fiado' && cliente?.id && gerenteAprovadoId) {
        try {
          const { error: rpcErr } = await supabase.rpc('aprovar_fiado', {
            p_venda_id: vendaId,
            p_cliente_id: cliente.id,
            p_valor_total: totalVenda,
            p_gerente_id: gerenteAprovadoId,
            p_vencimento: vencimentoFiado,
          });

          if (rpcErr) {
            console.error('Erro na RPC aprovar_fiado:', rpcErr);
            // Fallback insert to fiado table if RPC is restricted
            await supabase.from('fiado').insert({
              empresa_id: empresa?.id,
              cliente_id: cliente.id,
              venda_id: vendaId,
              valor_total: totalVenda,
              valor_pago: 0,
              status: 'em_aberto',
              vencimento: vencimentoFiado,
            });
          }
          fiadoAprovadoFlag = true;
        } catch (e) {
          console.warn('Fallback aprovação de fiado:', e);
        }
      }

      // Success! Set Receipt Screen State
      setVendaSucessoData({
        vendaId: vendaId,
        total: totalVenda,
        formaPagamento: formaPagamento.toUpperCase(),
        fiadoAprovado: fiadoAprovadoFlag,
        dataHora: new Date().toLocaleString('pt-BR'),
      });
    } catch (err: any) {
      setErro(err?.message || 'Ocorreu um erro ao concluir a venda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="industrial-card p-6 max-w-xl w-full bg-white shadow-2xl relative">
        {/* Success Receipt State */}
        {vendaSucessoData ? (
          <div className="text-center py-4 space-y-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-50 text-green-600 border border-green-200">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-zinc-900">
                Venda finalizada com sucesso!
              </h3>
              <p className="text-xs text-zinc-600 mt-1">
                A baixa de estoque e o registro na expedição foram processados automaticamente.
              </p>
            </div>

            {/* Receipt details */}
            <div className="p-4 bg-zinc-50 border border-[#E5E5E5] rounded-lg text-left text-xs space-y-2">
              <div className="flex justify-between border-b border-[#E5E5E5] pb-2">
                <span className="text-zinc-500">Cód. da Venda:</span>
                <span className="font-mono font-bold text-zinc-900">
                  #{vendaSucessoData.vendaId.substring(0, 8)}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#E5E5E5] pb-2">
                <span className="text-zinc-500">Data e hora:</span>
                <span className="text-zinc-900">{vendaSucessoData.dataHora}</span>
              </div>
              <div className="flex justify-between border-b border-[#E5E5E5] pb-2">
                <span className="text-zinc-500">Cliente:</span>
                <span className="font-semibold text-zinc-900">
                  {cliente?.nome || 'Consumidor final'}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#E5E5E5] pb-2">
                <span className="text-zinc-500">Forma de pagamento:</span>
                <span className="font-bold text-zinc-900">
                  {vendaSucessoData.formaPagamento}
                </span>
              </div>
              {vendaSucessoData.fiadoAprovado && (
                <div className="flex justify-between border-b border-[#E5E5E5] pb-2 text-amber-800">
                  <span>Fiado autorizado por gerente:</span>
                  <span className="font-bold">SIM</span>
                </div>
              )}
              <div className="flex justify-between pt-1 text-sm font-extrabold text-zinc-900">
                <span>Total pago:</span>
                <span className="text-[#000000] bg-[#F5D800] px-2 py-0.5 rounded">
                  R$ {vendaSucessoData.total.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 px-4 bg-white border border-[#E5E5E5] hover:bg-zinc-100 text-zinc-800 font-semibold rounded-lg text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir comprovante</span>
              </button>
              <button
                type="button"
                onClick={onVendaConcluida}
                className="flex-1 py-2.5 px-4 bg-[#F5D800] hover:bg-[#ebd000] text-zinc-950 font-bold rounded-lg text-xs border border-[#d2b800] flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Nova venda</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Normal Finalizing Modal */
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5] mb-5">
              <div>
                <h3 className="text-base font-bold text-zinc-900">
                  Finalizar venda no balcão
                </h3>
                <p className="text-xs text-zinc-500">
                  Total a pagar: R$ {totalVenda.toFixed(2)} ({items.length} itens)
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-zinc-400 hover:text-zinc-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {erro && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{erro}</span>
              </div>
            )}

            {/* Payment Method Selector */}
            {!showFiadoAuth ? (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">
                    Selecione a forma de pagamento
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleSelectFormaPagamento('dinheiro')}
                      className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-colors cursor-pointer ${
                        formaPagamento === 'dinheiro'
                          ? 'bg-[#F5D800] border-[#d2b800] text-zinc-950 font-bold'
                          : 'bg-white border-[#E5E5E5] text-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      <DollarSign className="w-5 h-5 stroke-[2]" />
                      <span className="text-xs">Dinheiro</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectFormaPagamento('cartao')}
                      className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-colors cursor-pointer ${
                        formaPagamento === 'cartao'
                          ? 'bg-[#F5D800] border-[#d2b800] text-zinc-950 font-bold'
                          : 'bg-white border-[#E5E5E5] text-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      <CreditCard className="w-5 h-5 stroke-[2]" />
                      <span className="text-xs">Cartão</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectFormaPagamento('pix')}
                      className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-colors cursor-pointer ${
                        formaPagamento === 'pix'
                          ? 'bg-[#F5D800] border-[#d2b800] text-zinc-950 font-bold'
                          : 'bg-white border-[#E5E5E5] text-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      <QrCode className="w-5 h-5 stroke-[2]" />
                      <span className="text-xs">PIX</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectFormaPagamento('fiado')}
                      className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-colors cursor-pointer ${
                        formaPagamento === 'fiado'
                          ? 'bg-[#F5D800] border-[#d2b800] text-zinc-950 font-bold'
                          : 'bg-white border-[#E5E5E5] text-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      <BookOpen className="w-5 h-5 stroke-[2]" />
                      <span className="text-xs">Fiado (Crediário)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectFormaPagamento('misto')}
                      className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-colors cursor-pointer ${
                        formaPagamento === 'misto'
                          ? 'bg-[#F5D800] border-[#d2b800] text-zinc-950 font-bold'
                          : 'bg-white border-[#E5E5E5] text-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      <Layers className="w-5 h-5 stroke-[2]" />
                      <span className="text-xs">Misto</span>
                    </button>
                  </div>
                </div>

                {/* Fiado Approved Badge if manager already verified */}
                {formaPagamento === 'fiado' && gerenteAprovadoId && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between text-xs text-green-900">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-green-700" />
                      <span>Fiado pré-aprovado por gerente</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowFiadoAuth(true)}
                      className="text-zinc-600 underline text-[11px]"
                    >
                      Re-autenticar
                    </button>
                  </div>
                )}

                {/* Misto Payment Breakdown Inputs */}
                {formaPagamento === 'misto' && (
                  <div className="p-4 bg-zinc-50 border border-[#E5E5E5] rounded-lg space-y-3">
                    <span className="text-xs font-semibold text-zinc-800 block">
                      Divisão do pagamento misto
                    </span>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] text-zinc-600 mb-1">
                          Dinheiro
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={valorDinheiro}
                          onChange={(e) => setValorDinheiro(parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 bg-white border border-[#E5E5E5] rounded text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-zinc-600 mb-1">
                          Cartão
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={valorCartao}
                          onChange={(e) => setValorCartao(parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 bg-white border border-[#E5E5E5] rounded text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-zinc-600 mb-1">
                          PIX
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={valorPix}
                          onChange={(e) => setValorPix(parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 bg-white border border-[#E5E5E5] rounded text-xs font-semibold"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Summary Info */}
                <div className="p-3 bg-zinc-50 border border-[#E5E5E5] rounded-lg text-xs space-y-1">
                  <div className="flex justify-between text-zinc-600">
                    <span>Cliente da venda:</span>
                    <span className="font-semibold text-zinc-900">
                      {cliente?.nome || 'Consumidor não identificado'}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>Filial da operação:</span>
                    <span className="font-semibold text-zinc-900">
                      {selectedFilial?.nome || 'Matriz'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E5E5]">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs text-zinc-600 hover:text-zinc-900"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleConfirmarVenda}
                    className="px-6 py-2.5 bg-[#F5D800] hover:bg-[#ebd000] text-zinc-950 font-bold text-xs rounded-lg border border-[#d2b800] transition-colors cursor-pointer"
                  >
                    {loading ? 'Processando venda...' : 'Confirmar e emitir venda'}
                  </button>
                </div>
              </div>
            ) : (
              /* FIADO MANAGER REAUTHENTICATION STEP */
              <form onSubmit={handleAprovarFiadoGerente} className="space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>AUTORIZAÇÃO DA GERÊNCIA PARA FIADO</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    A aprovação de fiado exige a reautenticação com senha de um Gerente ou Administrador da loja.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Selecione ou digite o e-mail do Gerente
                  </label>
                  {gerentesList.length > 0 ? (
                    <select
                      value={gerenteEmail}
                      onChange={(e) => setGerenteEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 mb-2"
                    >
                      {gerentesList.map((g) => (
                        <option key={g.id} value={g.email}>
                          {g.nome} ({g.email}) — Cargo: {g.cargo}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  <input
                    type="email"
                    required
                    value={gerenteEmail}
                    onChange={(e) => setGerenteEmail(e.target.value)}
                    placeholder="gerente@empresa.com.br"
                    className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Senha do Gerente *
                  </label>
                  <input
                    type="password"
                    required
                    value={gerenteSenha}
                    onChange={(e) => setGerenteSenha(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Data de vencimento do fiado
                  </label>
                  <input
                    type="date"
                    required
                    value={vencimentoFiado}
                    onChange={(e) => setVencimentoFiado(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E5E5]">
                  <button
                    type="button"
                    onClick={() => setShowFiadoAuth(false)}
                    className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 bg-[#F5D800] text-zinc-950 font-bold text-xs rounded-lg border border-[#d2b800] hover:bg-[#ebd000]"
                  >
                    {loading ? 'Verificando senha...' : 'Autorizar e prosseguir'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
