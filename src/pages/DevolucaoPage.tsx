import React, { useState, useEffect } from 'react';
import { 
  RotateCcw, 
  Search, 
  CheckCircle2, 
  Ticket, 
  AlertCircle, 
  Package, 
  DollarSign, 
  CreditCard, 
  UserCheck, 
  Printer, 
  ArrowLeft,
  FileText
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import { Venda, VendaItem, Devolucao } from '../types';
import { useAuth } from '../context/AuthContext';
import { InputMaiusculo, TextareaMaiusculo } from '../components/InputMaiusculo';

export const DevolucaoPage: React.FC = () => {
  const { empresa, selectedFilial } = useAuth();

  const [buscaVenda, setBuscaVenda] = useState('');
  const [vendasRecentes, setVendasRecentes] = useState<Venda[]>([]);
  const [vendasFiltradas, setVendasFiltradas] = useState<Venda[]>([]);
  const [vendaSelecionada, setVendaSelecionada] = useState<Venda | null>(null);
  const [itensVenda, setItensVenda] = useState<VendaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Devolution form state
  const [itemSelecionado, setItemSelecionado] = useState<VendaItem | null>(null);
  const [quantidadeDevolver, setQuantidadeDevolver] = useState<number>(1);
  const [tipoResolucao, setTipoResolucao] = useState<
    'troca' | 'estorno_cartao' | 'dinheiro' | 'credito_cliente' | 'voucher'
  >('voucher');
  const [motivo, setMotivo] = useState('');
  const [processingDevolucao, setProcessingDevolucao] = useState(false);

  // Voucher Result
  const [devolucaoConcluida, setDevolucaoConcluida] = useState<{
    id: string;
    voucherCodigo?: string | null;
    valorDevolvido: number;
    tipoResolucao: string;
  } | null>(null);

  // Fetch sales for selected branch with optional search
  useEffect(() => {
    async function fetchVendas() {
      setLoading(true);
      try {
        let query = supabase
          .from('vendas')
          .select('*, cliente:clientes(*), vendedor:usuarios(*)')
          .eq('status', 'finalizada')
          .order('created_at', { ascending: false });

        if (selectedFilial?.id) {
          query = query.eq('filial_id', selectedFilial.id);
        }

        if (buscaVenda.trim()) {
          const term = buscaVenda.trim();
          // Try searching by ID or joining with clients
          // Since Supabase JS has limited join filtering, we use this approach:
          if (term.length >= 3) {
            query = query.or(`id.ilike.%${term}%`); 
            // If we had cliente_nome denormalized, we'd use it here.
            // For now, we'll fetch more and filter locally if needed, 
            // or just rely on the ID search which is common for sales.
          }
        }

        const { data } = await query.limit(20);
        if (data) {
          setVendasRecentes(data as Venda[]);
          
          // Local secondary filter for client name if search term is active
          if (buscaVenda.trim()) {
            const term = buscaVenda.trim().toLowerCase();
            const filtered = data.filter(v => 
              v.id.toLowerCase().includes(term) || 
              (v.cliente?.nome || '').toLowerCase().includes(term)
            );
            setVendasFiltradas(filtered as Venda[]);
          } else {
            setVendasFiltradas(data as Venda[]);
          }
        }
      } catch (err) {
        console.error('Erro ao buscar vendas para devolução:', err);
      } finally {
        setLoading(false);
      }
    }
    
    const timeoutId = setTimeout(fetchVendas, 300);
    return () => clearTimeout(timeoutId);
  }, [selectedFilial?.id, buscaVenda]);

  // Select sale and fetch its items
  const handleSelectVenda = async (venda: Venda) => {
    setVendaSelecionada(venda);
    setItemSelecionado(null);
    setDevolucaoConcluida(null);
    setErro(null);

    setLoading(true);
    try {
      const { data: itens, error } = await supabase
        .from('venda_itens')
        .select(`
          *,
          produto:produtos(id, nome, unidade, codigo_barras)
        `)
        .eq('venda_id', venda.id);

      console.log('itens devolucao:', itens, error);

      if (itens) {
        setItensVenda(itens as VendaItem[]);
        if (itens.length > 0) {
          setItemSelecionado(itens[0] as VendaItem);
          setQuantidadeDevolver(itens[0].quantidade || 1);
        }
      } else {
        setItensVenda([]);
      }
    } catch (err) {
      console.error('Erro ao buscar itens da venda:', err);
    } finally {
      setLoading(false);
    }
  };

  // Generate unique voucher code
  const generateVoucherCode = () => {
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `VOUCHER-${randomHex}`;
  };

  // Process devolution
  const handleConfirmarDevolucao = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!vendaSelecionada || !itemSelecionado) {
      setErro('Selecione uma venda e um item para processar a devolução.');
      return;
    }

    if (quantidadeDevolver <= 0 || quantidadeDevolver > itemSelecionado.quantidade) {
      setErro(
        `A quantidade a devolver deve ser maior que 0 e menor ou igual à quantidade vendida (${itemSelecionado.quantidade}).`
      );
      return;
    }

    setProcessingDevolucao(true);
    try {
      const resolvedFilialId = selectedFilial?.id ?? (
        await supabase
          .from('filiais')
          .select('id')
          .eq('empresa_id', empresa?.id)
          .single()
      ).data?.id;

      if (!resolvedFilialId) {
        toast.error('Nenhuma filial encontrada. Cadastre uma filial primeiro.');
        setProcessingDevolucao(false);
        return;
      }

      const valorDevolvido = quantidadeDevolver * itemSelecionado.valor_unitario;
      const voucherCodigo = tipoResolucao === 'voucher' ? generateVoucherCode() : null;

      // 1. Record devolution in `devolucoes`
      const { data: devCreated, error: devErr } = await supabase
        .from('devolucoes')
        .insert({
          empresa_id: empresa?.id,
          filial_id: resolvedFilialId,
          venda_id: vendaSelecionada.id,
          venda_item_id: itemSelecionado.id,
          quantidade: quantidadeDevolver,
          tipo_resolucao: tipoResolucao,
          valor_devolvido: valorDevolvido,
          voucher_codigo: voucherCodigo,
          motivo: motivo.trim() || 'Devolução no balcão',
        })
        .select()
        .single();

      if (devErr) {
        setErro(`Erro ao registrar devolução: ${devErr.message}`);
        setProcessingDevolucao(false);
        return;
      }

      // 2. If voucher, save code in `vouchers` table if available
      if (voucherCodigo) {
        try {
          await supabase.from('vouchers').insert({
            empresa_id: empresa?.id,
            cliente_id: vendaSelecionada.cliente_id || null,
            codigo: voucherCodigo,
            valor: valorDevolvido,
            status: 'ativo',
          });
        } catch (e) {
          console.warn('Gravação complementar de voucher:', e);
        }
      }

      setDevolucaoConcluida({
        id: devCreated.id,
        voucherCodigo: voucherCodigo,
        valorDevolvido: valorDevolvido,
        tipoResolucao: tipoResolucao,
      });
    } catch (err: any) {
      setErro(err?.message || 'Falha ao processar devolução.');
    } finally {
      setProcessingDevolucao(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E5]">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-[#F5D800]" />
            Processamento de devoluções e trocas
          </h1>
          <p className="text-xs text-zinc-600 mt-0.5">
            Realize trocas parciais ou totais e emissão de vouchers de crédito para clientes.
          </p>
        </div>
      </div>

      {erro && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Success Devolution Result / Voucher Card */}
      {devolucaoConcluida ? (
        <div className="industrial-card p-8 text-center max-w-lg mx-auto space-y-6">
          <div className="w-14 h-14 rounded-full bg-green-50 border border-green-200 text-green-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-zinc-900">
              Devolução registrada com sucesso!
            </h2>
            <p className="text-xs text-zinc-600 mt-1">
              O estorno de estoque foi atualizado automaticamente no sistema.
            </p>
          </div>

          {devolucaoConcluida.voucherCodigo && (
            <div className="p-5 bg-amber-50 border-2 border-dashed border-[#F5D800] rounded-lg text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase tracking-wider">
                <Ticket className="w-4 h-4 text-amber-700" />
                Voucher de Crédito para o Cliente
              </div>
              <div className="text-2xl font-mono font-bold tracking-wider text-zinc-950 py-1">
                {devolucaoConcluida.voucherCodigo}
              </div>
              <div className="text-sm font-extrabold text-amber-950">
                Valor do crédito: R$ {devolucaoConcluida.valorDevolvido.toFixed(2)}
              </div>
              <p className="text-[11px] text-amber-800">
                Apresente este código no caixa em compras futuras.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 py-2.5 px-4 bg-white border border-[#E5E5E5] hover:bg-zinc-100 text-zinc-800 font-semibold rounded-lg text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir voucher / recibo</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setVendaSelecionada(null);
                setDevolucaoConcluida(null);
              }}
              className="flex-1 py-2.5 px-4 bg-[#F5D800] hover:bg-[#ebd000] text-zinc-950 font-bold rounded-lg text-xs border border-[#d2b800] cursor-pointer"
            >
              Nova devolução
            </button>
          </div>
        </div>
      ) : (
        /* Standard Devolution Grid */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1 & 2: Sales List & Items */}
          <div className="lg:col-span-2 space-y-4">
            {/* Search Venda */}
            <div className="industrial-card p-4">
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                1. Localizar venda realizada
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                  <Search className="w-4 h-4" />
                </div>
                <InputMaiusculo
                  type="text"
                  value={buscaVenda}
                  onChange={(e) => setBuscaVenda(e.target.value)}
                  placeholder="Filtrar por código da venda ou cliente..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>

              {/* Vendas table */}
              <div className="mt-3 overflow-x-auto max-h-56 overflow-y-auto border border-[#E5E5E5] rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 border-b border-[#E5E5E5] text-zinc-500 font-semibold text-[10px] uppercase">
                    <tr>
                      <th className="py-2 px-3">Cód Venda</th>
                      <th className="py-2 px-3">Cliente</th>
                      <th className="py-2 px-3">Valor Total</th>
                      <th className="py-2 px-3">Pagamento</th>
                      <th className="py-2 px-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E5]">
                    {vendasFiltradas.map((v) => (
                      <tr
                        key={v.id}
                        className={`hover:bg-amber-50/50 transition-colors ${
                          vendaSelecionada?.id === v.id ? 'bg-amber-50/80 font-semibold' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-zinc-900">
                          #{v.id.substring(0, 8)}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-800">
                          {v.cliente?.nome || 'Consumidor final'}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-zinc-900">
                          R$ {Number(v.valor_total || 0).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 uppercase text-[10px] font-semibold text-zinc-600">
                          {v.forma_pagamento}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleSelectVenda(v)}
                            className="px-2.5 py-1 bg-[#F5D800] text-zinc-950 font-bold text-[11px] rounded border border-[#d2b800] hover:bg-[#ebd000] cursor-pointer"
                          >
                            Selecionar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Selected Sale Items */}
            {vendaSelecionada && (
              <div className="industrial-card p-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#E5E5E5] mb-3">
                  <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                    2. Selecionar item para devolução (Venda #{vendaSelecionada.id.substring(0, 8)})
                  </label>
                  <span className="text-xs text-zinc-500">
                    Cliente: {vendaSelecionada.cliente?.nome || 'Consumidor'}
                  </span>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {itensVenda.length === 0 ? (
                    <div className="py-8 text-center bg-zinc-50 border border-dashed border-zinc-300 rounded-lg">
                      <p className="text-xs text-zinc-500 font-medium italic">
                        Esta venda não possui itens registrados ou todos já foram devolvidos.
                      </p>
                    </div>
                  ) : (
                    itensVenda.map((it) => (
                      <div
                        key={it.id}
                        onClick={() => {
                          setItemSelecionado(it);
                          setQuantidadeDevolver(it.quantidade);
                        }}
                        className={`p-3 border rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                          itemSelecionado?.id === it.id
                            ? 'border-zinc-900 bg-amber-50/50 shadow-2xs'
                            : 'border-[#E5E5E5] bg-white hover:bg-zinc-50'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-xs text-zinc-900">
                            {it.produto?.nome || 'Produto em catálogo'}
                          </div>
                          <div className="text-[11px] text-zinc-500 mt-0.5">
                            Qtd vendida: {it.quantidade} • Preço un: R${' '}
                            {Number(it.valor_unitario || 0).toFixed(2)}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-bold text-xs text-zinc-900 block">
                            R$ {Number(it.valor_total || 0).toFixed(2)}
                          </span>
                          {itemSelecionado?.id === it.id && (
                            <span className="text-[10px] font-bold bg-[#F5D800] text-zinc-950 px-1.5 py-0.5 rounded">
                              SELECIONADO
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Column 3: Devolution Resolution Form */}
          <div>
            <form onSubmit={handleConfirmarDevolucao} className="industrial-card p-5 space-y-4">
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider pb-2 border-b border-[#E5E5E5]">
                3. Resolução da devolução
              </h3>

              {itemSelecionado ? (
                <>
                  <div className="p-3 bg-zinc-50 border border-[#E5E5E5] rounded-lg">
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase block">
                      Item selecionado
                    </span>
                    <span className="font-bold text-xs text-zinc-900 block">
                      {itemSelecionado.produto?.nome}
                    </span>
                    <span className="text-xs text-zinc-600">
                      Máx devolvível: {itemSelecionado.quantidade}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Quantidade a devolver (aceita parcial)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={itemSelecionado.quantidade}
                      value={quantidadeDevolver}
                      onChange={(e) => setQuantidadeDevolver(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs font-semibold text-zinc-900 focus:outline-none focus:border-zinc-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Tipo de resolução
                    </label>
                    <select
                      value={tipoResolucao}
                      onChange={(e: any) => setTipoResolucao(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                    >
                      <option value="voucher">Voucher (Vale-compras)</option>
                      <option value="troca">Troca por outro produto</option>
                      <option value="estorno_cartao">Estorno no cartão</option>
                      <option value="dinheiro">Devolução em dinheiro</option>
                      <option value="credito_cliente">Crédito na conta do cliente</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Motivo da devolução / avaria
                    </label>
                    <TextareaMaiusculo
                      rows={2}
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Ex: Material sobrou na obra / Medida incorreta..."
                      className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                    />
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex justify-between font-bold">
                    <span>Valor a reembolsar:</span>
                    <span>
                      R$ {(quantidadeDevolver * (itemSelecionado.valor_unitario || 0)).toFixed(2)}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={processingDevolucao}
                    className="w-full py-2.5 px-4 bg-[#F5D800] hover:bg-[#ebd000] text-zinc-950 font-bold text-xs rounded-lg border border-[#d2b800] transition-colors cursor-pointer"
                  >
                    {processingDevolucao ? 'Processando...' : 'Confirmar devolução'}
                  </button>
                </>
              ) : (
                <div className="py-8 text-center text-xs text-zinc-400">
                  Selecione uma venda e um item na tabela ao lado para definir o reembolso.
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
