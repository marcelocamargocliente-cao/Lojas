import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  FileText, 
  Upload, 
  Building2, 
  X,
  Eye,
  Trash2,
  Paperclip
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { ContaPagar, Fornecedor } from '../types';
import { useAuth } from '../context/AuthContext';

export const ContasPagarPage: React.FC = () => {
  const { usuarioProfile, empresa, selectedFilial } = useAuth();
  
  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendente' | 'pago' | 'vencido'>('todos');
  const [periodoFilter, setPeriodoFilter] = useState<'todos' | 'hoje' | 'esta_semana' | 'este_mes' | 'atrasados'>('todos');

  // New account modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form fields
  const [fornecedorId, setFornecedorId] = useState('');
  const [novoFornecedorNome, setNovoFornecedorNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('Fornecedores');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('boleto');
  const [fileComprovante, setFileComprovante] = useState<File | null>(null);

  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    fetchContas();
    fetchFornecedores();
  }, [selectedFilial]);

  const fetchFornecedores = async () => {
    try {
      const { data } = await supabase
        .from('fornecedores')
        .select('*')
        .order('nome');
      if (data) setFornecedores(data);
    } catch (err) {
      console.warn('Erro ao carregar fornecedores:', err);
    }
  };

  const fetchContas = async () => {
    setLoading(true);
    try {
      let query = supabase.from('contas_pagar').select('*').order('vencimento', { ascending: true });

      if (selectedFilial?.id) {
        query = query.eq('filial_id', selectedFilial.id);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('Erro ao buscar contas a pagar:', error.message);
        setContas([]);
      } else if (data) {
        const hojeStr = new Date().toISOString().split('T')[0];
        const processadas: ContaPagar[] = data.map((item) => {
          let st = item.status || 'pendente';
          const venc = item.vencimento ? item.vencimento.split('T')[0] : '';
          if (st === 'pendente' && venc && venc < hojeStr) {
            st = 'vencido';
          }
          return {
            ...item,
            status: st as any,
          };
        });
        setContas(processadas);
      }
    } catch (err) {
      console.error('Erro ao conectar Supabase para contas_pagar:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim() || !valor || !vencimento) {
      alert('Por favor, preencha descrição, valor e vencimento.');
      return;
    }

    setSubmitting(true);
    try {
      let finalFornecedorNome = '';
      let finalFornecedorId = fornecedorId || null;

      if (fornecedorId) {
        const found = fornecedores.find((f) => f.id === fornecedorId);
        if (found) finalFornecedorNome = found.nome;
      } else if (novoFornecedorNome.trim()) {
        finalFornecedorNome = novoFornecedorNome.trim();
        // Insert new supplier
        const { data: newF, error: fErr } = await supabase
          .from('fornecedores')
          .insert([
            {
              empresa_id: empresa?.id || null,
              nome: finalFornecedorNome,
            },
          ])
          .select()
          .single();

        if (newF) {
          finalFornecedorId = newF.id;
          fetchFornecedores();
        }
      }

      let comprovanteUrl = null;

      // Handle File upload if provided
      if (fileComprovante) {
        try {
          const fileExt = fileComprovante.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `comprovantes/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('comprovantes')
            .upload(filePath, fileComprovante);

          if (!uploadError) {
            const { data: publicData } = supabase.storage
              .from('comprovantes')
              .getPublicUrl(filePath);
            comprovanteUrl = publicData?.publicUrl || null;
          }
        } catch (uploadErr) {
          console.warn('Bucket de armazenamento nao configurado, salvando referencia local:', uploadErr);
          comprovanteUrl = fileComprovante.name;
        }
      }

      const { error } = await supabase.from('contas_pagar').insert([
        {
          empresa_id: empresa?.id || null,
          filial_id: selectedFilial?.id || null,
          fornecedor_id: finalFornecedorId,
          fornecedor_nome: finalFornecedorNome || null,
          descricao: descricao.trim(),
          categoria,
          valor: parseFloat(valor),
          vencimento,
          forma_pagamento: formaPagamento,
          comprovante_url: comprovanteUrl,
          status: 'pendente',
        },
      ]);

      if (error) {
        alert('Erro ao cadastrar conta: ' + error.message);
      } else {
        setModalOpen(false);
        resetForm();
        fetchContas();
      }
    } catch (err) {
      console.error('Erro ao salvar conta a pagar:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDarBaixa = async (conta: ContaPagar) => {
    setPayingId(conta.id);
    try {
      const agora = new Date().toISOString();
      const usuarioNome = usuarioProfile?.nome || 'Usuário';

      const { error } = await supabase
        .from('contas_pagar')
        .update({
          status: 'pago',
          pago_em: agora,
          pago_por: usuarioProfile?.id || null,
          pago_por_nome: usuarioNome,
        })
        .eq('id', conta.id);

      if (error) {
        alert('Erro ao dar baixa na conta: ' + error.message);
      } else {
        fetchContas();
      }
    } catch (err) {
      console.error('Erro ao dar baixa:', err);
    } finally {
      setPayingId(null);
    }
  };

  const resetForm = () => {
    setFornecedorId('');
    setNovoFornecedorNome('');
    setDescricao('');
    setCategoria('Fornecedores');
    setValor('');
    setVencimento('');
    setFormaPagamento('boleto');
    setFileComprovante(null);
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

  // Filter calculations
  const hojeStr = new Date().toISOString().split('T')[0];

  const filteredContas = contas.filter((c) => {
    // Search filter
    const searchMatch =
      c.descricao.toLowerCase().includes(search.toLowerCase()) ||
      (c.fornecedor_nome && c.fornecedor_nome.toLowerCase().includes(search.toLowerCase())) ||
      (c.categoria && c.categoria.toLowerCase().includes(search.toLowerCase()));

    if (!searchMatch) return false;

    // Status filter
    if (statusFilter !== 'todos') {
      if (statusFilter === 'vencido' && c.status !== 'vencido') return false;
      if (statusFilter === 'pendente' && c.status !== 'pendente') return false;
      if (statusFilter === 'pago' && c.status !== 'pago') return false;
    }

    // Period filter
    const vencStr = c.vencimento ? c.vencimento.split('T')[0] : '';
    if (periodoFilter === 'hoje' && vencStr !== hojeStr) return false;
    if (periodoFilter === 'atrasados' && c.status !== 'vencido') return false;

    if (periodoFilter === 'este_mes') {
      const now = new Date();
      const cDate = new Date(vencStr + 'T00:00:00');
      if (cDate.getMonth() !== now.getMonth() || cDate.getFullYear() !== now.getFullYear()) {
        return false;
      }
    }

    return true;
  });

  // Header Summary KPI Metrics
  const totalPendente = contas
    .filter((c) => c.status === 'pendente')
    .reduce((acc, c) => acc + (c.valor || 0), 0);

  const totalVencido = contas
    .filter((c) => c.status === 'vencido')
    .reduce((acc, c) => acc + (c.valor || 0), 0);

  const totalPagoMes = contas
    .filter((c) => c.status === 'pago')
    .reduce((acc, c) => acc + (c.valor || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E5E5E5]">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-500" />
            Contas a Pagar
          </h2>
          <p className="text-xs text-zinc-500">
            Gerencie compromissos financeiros, boletos, despesas e pagamentos a fornecedores
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-[#F5D800] hover:bg-[#e2c700] text-zinc-950 font-semibold text-xs rounded-lg transition-colors border border-[#d2b800] flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nova conta a pagar</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div 
          onClick={() => setStatusFilter('pendente')}
          className={`card-interativo p-4 flex items-center justify-between ${statusFilter === 'pendente' ? 'card-selected' : ''}`}
        >
          <div>
            <p className="text-xs font-medium text-zinc-500">Pendentes no prazo</p>
            <p className="text-lg font-bold text-zinc-900 mt-1">{formatMoney(totalPendente)}</p>
            <span className="text-[10px] text-zinc-400 mt-0.5 block">
              {contas.filter((c) => c.status === 'pendente').length} conta(s)
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter('vencido')}
          className={`card-interativo p-4 border-red-200 bg-red-50/20 flex items-center justify-between ${statusFilter === 'vencido' ? 'card-selected' : ''}`}
        >
          <div>
            <p className="text-xs font-medium text-red-700">Contas Vencidas</p>
            <p className="text-lg font-bold text-red-900 mt-1">{formatMoney(totalVencido)}</p>
            <span className="text-[10px] text-red-600 mt-0.5 block">
              {contas.filter((c) => c.status === 'vencido').length} conta(s) em atraso
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-red-100 border border-red-200 text-red-700 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter('pago')}
          className={`card-interativo p-4 border-emerald-200 bg-emerald-50/20 flex items-center justify-between ${statusFilter === 'pago' ? 'card-selected' : ''}`}
        >
          <div>
            <p className="text-xs font-medium text-emerald-700">Pagas Registradas</p>
            <p className="text-lg font-bold text-emerald-900 mt-1">{formatMoney(totalPagoMes)}</p>
            <span className="text-[10px] text-emerald-600 mt-0.5 block">
              {contas.filter((c) => c.status === 'pago').length} quitada(s)
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E5E5E5] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por descrição, fornecedor ou categoria..."
            className="w-full pl-9 pr-3 py-1.5 bg-zinc-50 border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs text-zinc-500 font-medium mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Status:
          </span>

          {(['todos', 'pendente', 'vencido', 'pago'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer capitalize ${
                statusFilter === st
                  ? 'bg-zinc-900 text-white font-semibold'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {st === 'todos' ? 'Todos' : st === 'pendente' ? 'Pendente' : st === 'vencido' ? 'Vencidos' : 'Pago'}
            </button>
          ))}
        </div>

        {/* Period Filter */}
        <select
          value={periodoFilter}
          onChange={(e) => setPeriodoFilter(e.target.value as any)}
          className="px-3 py-1.5 bg-zinc-50 border border-[#E5E5E5] rounded-lg text-xs text-zinc-800 font-medium focus:outline-none focus:border-zinc-900 cursor-pointer"
        >
          <option value="todos">Período: Todos</option>
          <option value="hoje">Vencem Hoje</option>
          <option value="atrasados">Apenas Atrasados</option>
          <option value="este_mes">Este Mês</option>
        </select>
      </div>

      {/* Contas List Table */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-2 border-zinc-300 border-t-[#F5D800] rounded-full animate-spin" />
            Carregando contas a pagar...
          </div>
        ) : filteredContas.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 space-y-2">
            <FileText className="w-10 h-10 text-zinc-300 mx-auto" />
            <p className="text-sm font-medium text-zinc-700">Nenhuma conta encontrada</p>
            <p className="text-xs text-zinc-400">
              Ajuste os filtros de busca ou cadastre um novo compromisso financeiro.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-[#E5E5E5] text-zinc-500 font-medium">
                <tr>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Descrição</th>
                  <th className="p-3.5">Fornecedor / Categoria</th>
                  <th className="p-3.5">Vencimento</th>
                  <th className="p-3.5">Valor</th>
                  <th className="p-3.5">Forma / Anexo</th>
                  <th className="p-3.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {filteredContas.map((conta) => {
                  return (
                    <tr key={conta.id} className="hover:bg-zinc-50/80 transition-colors">
                      {/* Status Badge */}
                      <td className="p-3.5">
                        {conta.status === 'pago' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Pago
                          </span>
                        ) : conta.status === 'vencido' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                            <AlertTriangle className="w-3 h-3" /> Vencido
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3" /> Pendente
                          </span>
                        )}
                      </td>

                      {/* Descricao */}
                      <td className="p-3.5 font-semibold text-zinc-900">
                        {conta.descricao}
                      </td>

                      {/* Fornecedor / Categoria */}
                      <td className="p-3.5">
                        <div className="font-medium text-zinc-800">
                          {conta.fornecedor_nome || 'Não informado'}
                        </div>
                        {conta.categoria && (
                          <span className="text-[10px] text-zinc-500 bg-zinc-100 px-1.5 py-0.2 rounded inline-block mt-0.5">
                            {conta.categoria}
                          </span>
                        )}
                      </td>

                      {/* Vencimento */}
                      <td className="p-3.5 text-zinc-700 font-medium">
                        {formatDate(conta.vencimento)}
                        {conta.status === 'pago' && conta.pago_em && (
                          <span className="block text-[10px] text-emerald-700 mt-0.5 font-normal">
                            Pago em {formatDate(conta.pago_em)}
                          </span>
                        )}
                      </td>

                      {/* Valor */}
                      <td className="p-3.5 font-bold text-zinc-900 text-sm">
                        {formatMoney(conta.valor)}
                      </td>

                      {/* Forma de Pagamento & Anexo */}
                      <td className="p-3.5">
                        <span className="capitalize text-zinc-700 font-medium block">
                          {conta.forma_pagamento || 'Boleto'}
                        </span>
                        {conta.comprovante_url && (
                          <a
                            href={conta.comprovante_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline mt-0.5 font-medium"
                          >
                            <Paperclip className="w-3 h-3" /> Ver anexo
                          </a>
                        )}
                      </td>

                      {/* Action */}
                      <td className="p-3.5 text-right">
                        {conta.status !== 'pago' ? (
                          <button
                            type="button"
                            onClick={() => handleDarBaixa(conta)}
                            disabled={payingId === conta.id}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors flex items-center gap-1 ml-auto cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{payingId === conta.id ? 'Baixando...' : 'Marcar como pago'}</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-zinc-400 italic">
                            Quitado por {conta.pago_por_nome || 'Usuário'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Nova Conta a Pagar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in">
            <div className="p-4 border-b border-[#E5E5E5] bg-zinc-50 flex items-center justify-between">
              <h3 className="font-bold text-sm text-zinc-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-500" />
                Cadastrar Nova Conta a Pagar
              </h3>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  resetForm();
                }}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateConta} className="p-5 space-y-4 text-xs">
              {/* Fornecedor Selector / Input */}
              <div>
                <label className="block font-medium text-zinc-700 mb-1">Fornecedor</label>
                <select
                  value={fornecedorId}
                  onChange={(e) => setFornecedorId(e.target.value)}
                  className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                >
                  <option value="">-- Selecione ou digite novo fornecedor --</option>
                  {fornecedores.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome} {f.cnpj_cpf ? `(${f.cnpj_cpf})` : ''}
                    </option>
                  ))}
                </select>

                {!fornecedorId && (
                  <input
                    type="text"
                    value={novoFornecedorNome}
                    onChange={(e) => setNovoFornecedorNome(e.target.value)}
                    placeholder="Ou digite o nome do novo fornecedor..."
                    className="w-full mt-2 p-2 bg-zinc-50 border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900"
                  />
                )}
              </div>

              {/* Descricao */}
              <div>
                <label className="block font-medium text-zinc-700 mb-1">
                  Descrição da Conta <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Fatura de Energia Elétrica Matriz"
                  className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>

              {/* Categoria & Valor */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Categoria</label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  >
                    <option value="Fornecedores">Fornecedores</option>
                    <option value="Aluguel">Aluguel / Imóvel</option>
                    <option value="Energia/Água">Energia / Água / Telecom</option>
                    <option value="Salários/Encargos">Salários / Encargos</option>
                    <option value="Manutenção">Manutenção / Equipamentos</option>
                    <option value="Impostos/Taxas">Impostos / Taxas</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 mb-1">
                    Valor (R$) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 font-semibold focus:outline-none focus:border-zinc-900"
                  />
                </div>
              </div>

              {/* Vencimento e Forma de Pagamento */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">
                    Vencimento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={vencimento}
                    onChange={(e) => setVencimento(e.target.value)}
                    className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Forma de Pagamento</label>
                  <select
                    value={formaPagamento}
                    onChange={(e) => setFormaPagamento(e.target.value)}
                    className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  >
                    <option value="boleto">Boleto Bancário</option>
                    <option value="pix">PIX</option>
                    <option value="cartao">Cartão de Crédito/Débito</option>
                    <option value="transferencia">Transferência / TED</option>
                    <option value="dinheiro">Dinheiro</option>
                  </select>
                </div>
              </div>

              {/* Upload do comprovante/boleto */}
              <div>
                <label className="block font-medium text-zinc-700 mb-1">
                  Anexo Boleto / Nota Fiscal <span className="text-zinc-400 font-normal">(Opcional)</span>
                </label>
                <div className="border-2 border-dashed border-[#E5E5E5] hover:border-zinc-400 rounded-lg p-3 text-center transition-colors">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setFileComprovante(e.target.files[0]);
                      }
                    }}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-1">
                    <Upload className="w-5 h-5 text-zinc-400" />
                    <span className="text-xs font-medium text-zinc-700">
                      {fileComprovante ? fileComprovante.name : 'Clique para selecionar boleto ou NF (PDF/Imagem)'}
                    </span>
                  </label>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-[#E5E5E5] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-[#E5E5E5] hover:bg-zinc-100 rounded-lg font-medium text-zinc-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#F5D800] hover:bg-[#e2c700] text-zinc-950 font-semibold rounded-lg border border-[#d2b800] cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : 'Salvar conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
