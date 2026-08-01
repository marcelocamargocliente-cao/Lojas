import React, { useState, useEffect } from 'react';
import { 
  Users, 
  DollarSign, 
  Plus, 
  Search, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  TrendingDown, 
  Info,
  Clock,
  UserCheck,
  FileText
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { PagamentoFuncionario, Usuario } from '../types';
import { useAuth } from '../context/AuthContext';

export const PagamentosFuncionarioPage: React.FC = () => {
  const { usuarioProfile, empresa } = useAuth();

  const [funcionarios, setFuncionarios] = useState<Usuario[]>([]);
  const [pagamentos, setPagamentos] = useState<PagamentoFuncionario[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedFuncionarioId, setSelectedFuncionarioId] = useState<string>('todos');
  const [tipoFilter, setTipoFilter] = useState<'todos' | 'salario' | 'adiantamento' | 'ferias'>('todos');
  const [mesFilter, setMesFilter] = useState<number>(new Date().getMonth() + 1);
  const [anoFilter, setAnoFilter] = useState<number>(new Date().getFullYear());

  // Form State
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [funcionarioId, setFuncionarioId] = useState('');
  const [tipo, setTipo] = useState<'salario' | 'adiantamento' | 'ferias'>('salario');
  const [valor, setValor] = useState('');
  const [competenciaMes, setCompetenciaMes] = useState<number>(new Date().getMonth() + 1);
  const [competenciaAno, setCompetenciaAno] = useState<number>(new Date().getFullYear());
  const [dataPagamento, setDataPagamento] = useState<string>(new Date().toISOString().split('T')[0]);
  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    fetchFuncionarios();
    fetchPagamentos();
  }, []);

  const fetchFuncionarios = async () => {
    try {
      const { data } = await supabase
        .from('usuarios')
        .select('*')
        .order('nome');
      if (data) setFuncionarios(data);
    } catch (err) {
      console.warn('Erro ao carregar colaboradores:', err);
    }
  };

  const fetchPagamentos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pagamentos_funcionario')
        .select('*, funcionario:usuarios(*)')
        .order('data_pagamento', { ascending: false });

      if (error) {
        console.warn('Erro ao carregar pagamentos de funcionarios:', error.message);
        setPagamentos([]);
      } else if (data) {
        setPagamentos(data);
      }
    } catch (err) {
      console.error('Erro ao buscar pagamentos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePagamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!funcionarioId || !valor || !dataPagamento) {
      alert('Selecione o funcionário, valor e data de pagamento.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('pagamentos_funcionario').insert([
        {
          empresa_id: empresa?.id || null,
          funcionario_id: funcionarioId,
          tipo,
          valor: parseFloat(valor),
          competencia_mes: competenciaMes,
          competencia_ano: competenciaAno,
          data_pagamento: dataPagamento,
          observacao: observacao.trim() || null,
        },
      ]);

      if (error) {
        alert('Erro ao registrar pagamento: ' + error.message);
      } else {
        setModalOpen(false);
        resetForm();
        fetchPagamentos();
      }
    } catch (err) {
      console.error('Erro ao salvar pagamento:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFuncionarioId('');
    setTipo('salario');
    setValor('');
    setObservacao('');
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

  const getNomeMes = (mesNum: number) => {
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return meses[mesNum - 1] || `${mesNum}`;
  };

  // Helper for next month calculation for advance deduction warning
  const getProximaCompetencia = (m: number, a: number) => {
    let proxM = m + 1;
    let proxA = a;
    if (proxM > 12) {
      proxM = 1;
      proxA = a + 1;
    }
    return `${getNomeMes(proxM)}/${proxA}`;
  };

  // Filtered Pagamentos
  const filteredPagamentos = pagamentos.filter((p) => {
    if (selectedFuncionarioId !== 'todos' && p.funcionario_id !== selectedFuncionarioId) return false;
    if (tipoFilter !== 'todos' && p.tipo !== tipoFilter) return false;
    if (mesFilter !== 0 && p.competencia_mes !== mesFilter) return false;
    if (anoFilter !== 0 && p.competencia_ano !== anoFilter) return false;
    return true;
  });

  const selectedFunc = funcionarios.find((f) => f.id === funcionarioId);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E5E5E5]">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            Pagamentos de Funcionários
          </h2>
          <p className="text-xs text-zinc-500">
            Controle de folha de pagamento, adiantamentos e vales para colaboradores
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-[#F5D800] hover:bg-[#e2c700] text-zinc-950 font-semibold text-xs rounded-lg transition-colors border border-[#d2b800] flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Lançar Pagamento / Vale</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E5E5E5] grid grid-cols-1 sm:grid-cols-4 gap-3">
        {/* Funcionario Filter */}
        <div>
          <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Funcionário</label>
          <select
            value={selectedFuncionarioId}
            onChange={(e) => setSelectedFuncionarioId(e.target.value)}
            className="w-full p-2 bg-zinc-50 border border-[#E5E5E5] rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-zinc-900"
          >
            <option value="todos">Todos os colaboradores</option>
            {funcionarios.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome} ({f.cargo || 'Funcionário'})
              </option>
            ))}
          </select>
        </div>

        {/* Tipo Filter */}
        <div>
          <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Tipo de Lançamento</label>
          <select
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value as any)}
            className="w-full p-2 bg-zinc-50 border border-[#E5E5E5] rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-zinc-900"
          >
            <option value="todos">Todos os tipos</option>
            <option value="salario">Salário Fixo / Comissão</option>
            <option value="adiantamento">Adiantamento (Vale)</option>
            <option value="ferias">Férias / Outros</option>
          </select>
        </div>

        {/* Competencia Mês */}
        <div>
          <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Mês de Competência</label>
          <select
            value={mesFilter}
            onChange={(e) => setMesFilter(Number(e.target.value))}
            className="w-full p-2 bg-zinc-50 border border-[#E5E5E5] rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-zinc-900"
          >
            <option value={0}>Todos os meses</option>
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {getNomeMes(i + 1)}
              </option>
            ))}
          </select>
        </div>

        {/* Competencia Ano */}
        <div>
          <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Ano</label>
          <select
            value={anoFilter}
            onChange={(e) => setAnoFilter(Number(e.target.value))}
            className="w-full p-2 bg-zinc-50 border border-[#E5E5E5] rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-zinc-900"
          >
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
          </select>
        </div>
      </div>

      {/* Pagamentos List Table */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-2 border-zinc-300 border-t-[#F5D800] rounded-full animate-spin" />
            Carregando pagamentos...
          </div>
        ) : filteredPagamentos.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 space-y-2">
            <UserCheck className="w-10 h-10 text-zinc-300 mx-auto" />
            <p className="text-sm font-medium text-zinc-700">Nenhum pagamento registrado</p>
            <p className="text-xs text-zinc-400">
              Nenhum registro encontrado para os filtros selecionados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-[#E5E5E5] text-zinc-500 font-medium">
                <tr>
                  <th className="p-3.5">Funcionário</th>
                  <th className="p-3.5">Tipo</th>
                  <th className="p-3.5">Competência</th>
                  <th className="p-3.5">Data Pagamento</th>
                  <th className="p-3.5">Valor</th>
                  <th className="p-3.5">Vínculo de Desconto / Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {filteredPagamentos.map((p) => {
                  const isAdiantamento = p.tipo === 'adiantamento';
                  const proxCompStr = getProximaCompetencia(p.competencia_mes, p.competencia_ano);

                  return (
                    <tr key={p.id} className="hover:bg-zinc-50/80 transition-colors">
                      {/* Funcionário */}
                      <td className="p-3.5 font-semibold text-zinc-900">
                        {p.funcionario?.nome || 'Colaborador'}
                        <span className="block text-[10px] text-zinc-500 font-normal">
                          {p.funcionario?.cargo || 'Geral'}
                        </span>
                      </td>

                      {/* Tipo */}
                      <td className="p-3.5">
                        {p.tipo === 'salario' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Salário / Comissão
                          </span>
                        )}
                        {p.tipo === 'adiantamento' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            <TrendingDown className="w-3 h-3" /> Adiantamento
                          </span>
                        )}
                        {p.tipo === 'ferias' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                            Férias
                          </span>
                        )}
                      </td>

                      {/* Competência */}
                      <td className="p-3.5 font-medium text-zinc-700">
                        {getNomeMes(p.competencia_mes)} / {p.competencia_ano}
                      </td>

                      {/* Data Pagamento */}
                      <td className="p-3.5 text-zinc-700">
                        {formatDate(p.data_pagamento)}
                      </td>

                      {/* Valor */}
                      <td className="p-3.5 font-bold text-zinc-900 text-sm">
                        {formatMoney(p.valor)}
                      </td>

                      {/* Vínculo de Adiantamento Banner */}
                      <td className="p-3.5">
                        {isAdiantamento ? (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-900 flex items-center gap-1.5 font-medium">
                            <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>
                              Adiantamento de <strong>{formatMoney(p.valor)}</strong> será descontado do salário de <strong>{proxCompStr}</strong>
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-600 italic">
                            {p.observacao || 'Sem observações adicionais'}
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

      {/* Modal Lançar Pagamento */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-xl max-w-md w-full overflow-hidden animate-in fade-in">
            <div className="p-4 border-b border-[#E5E5E5] bg-zinc-50 flex items-center justify-between">
              <h3 className="font-bold text-sm text-zinc-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-500" />
                Lançar Pagamento / Vale de Funcionário
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePagamento} className="p-5 space-y-4 text-xs">
              {/* Employee */}
              <div>
                <label className="block font-medium text-zinc-700 mb-1">
                  Selecione o Funcionário <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={funcionarioId}
                  onChange={(e) => setFuncionarioId(e.target.value)}
                  className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                >
                  <option value="">-- Escolha o colaborador --</option>
                  {funcionarios.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome} ({f.cargo || 'Geral'}) - Salário Fixo: R${f.salario_fixo || 0}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo */}
              <div>
                <label className="block font-medium text-zinc-700 mb-1">Tipo de Pagamento</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTipo('salario')}
                    className={`p-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                      tipo === 'salario'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                        : 'bg-white border-[#E5E5E5] text-zinc-700'
                    }`}
                  >
                    Salário
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipo('adiantamento')}
                    className={`p-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                      tipo === 'adiantamento'
                        ? 'bg-amber-50 border-amber-500 text-amber-900'
                        : 'bg-white border-[#E5E5E5] text-zinc-700'
                    }`}
                  >
                    Adiantamento
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipo('ferias')}
                    className={`p-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                      tipo === 'ferias'
                        ? 'bg-blue-50 border-blue-500 text-blue-900'
                        : 'bg-white border-[#E5E5E5] text-zinc-700'
                    }`}
                  >
                    Férias
                  </button>
                </div>
              </div>

              {/* Visual warning if Adiantamento selected */}
              {tipo === 'adiantamento' && selectedFunc && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Info className="w-4 h-4 text-amber-600" />
                    Aviso de Vínculo de Adiantamento
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Adiantamento de <strong>{formatMoney(parseFloat(valor) || 0)}</strong> será registrado para{' '}
                    <strong>{selectedFunc.nome}</strong> e vinculado para abatimento automático no próximo salário de{' '}
                    <strong>{getProximaCompetencia(competenciaMes, competenciaAno)}</strong>.
                  </p>
                </div>
              )}

              {/* Valor & Data Pagamento */}
              <div className="grid grid-cols-2 gap-3">
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
                    className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Data Pagamento</label>
                  <input
                    type="date"
                    required
                    value={dataPagamento}
                    onChange={(e) => setDataPagamento(e.target.value)}
                    className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                </div>
              </div>

              {/* Competência Mês / Ano */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Mês Competência</label>
                  <select
                    value={competenciaMes}
                    onChange={(e) => setCompetenciaMes(Number(e.target.value))}
                    className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  >
                    {Array.from({ length: 12 }).map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {getNomeMes(i + 1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Ano Competência</label>
                  <select
                    value={competenciaAno}
                    onChange={(e) => setCompetenciaAno(Number(e.target.value))}
                    className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  >
                    <option value={2025}>2025</option>
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                  </select>
                </div>
              </div>

              {/* Observacao */}
              <div>
                <label className="block font-medium text-zinc-700 mb-1">Observações / Motivo</label>
                <input
                  type="text"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Ex: Adiantamento quinzenal em dinheiro"
                  className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-[#E5E5E5] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-[#E5E5E5] hover:bg-zinc-100 rounded-lg font-medium text-zinc-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#F5D800] hover:bg-[#e2c700] text-zinc-950 font-semibold rounded-lg border border-[#d2b800] cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Registrando...' : 'Confirmar Lançamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
