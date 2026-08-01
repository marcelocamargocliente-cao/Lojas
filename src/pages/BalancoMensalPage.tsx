import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Download, 
  Calendar, 
  Building2, 
  ShoppingBag,
  Clock,
  CheckCircle2,
  PieChart
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { BalancoMensal } from '../types';
import { useAuth } from '../context/AuthContext';

export const BalancoMensalPage: React.FC = () => {
  const { selectedFilial, filiais } = useAuth();

  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [filialIdFilter, setFilialIdFilter] = useState<string>('todas');
  const [loading, setLoading] = useState(true);

  const [dadosMes, setDadosMes] = useState<BalancoMensal | null>(null);
  const [dadosMesAnterior, setDadosMesAnterior] = useState<BalancoMensal | null>(null);

  useEffect(() => {
    fetchBalanco();
  }, [mes, ano, filialIdFilter, selectedFilial]);

  const fetchBalanco = async () => {
    setLoading(true);
    try {
      const filId = filialIdFilter !== 'todas' ? filialIdFilter : selectedFilial?.id;

      // 1. Try querying vw_balanco_mensal
      let queryCurrent = supabase
        .from('vw_balanco_mensal')
        .select('*')
        .eq('mes', mes)
        .eq('ano', ano);

      if (filId) queryCurrent = queryCurrent.eq('filial_id', filId);

      const { data: vwData } = await queryCurrent;

      // Compute previous month
      let mesAnt = mes - 1;
      let anoAnt = ano;
      if (mesAnt < 1) {
        mesAnt = 12;
        anoAnt = ano - 1;
      }

      let queryPrev = supabase
        .from('vw_balanco_mensal')
        .select('*')
        .eq('mes', mesAnt)
        .eq('ano', anoAnt);

      if (filId) queryPrev = queryPrev.eq('filial_id', filId);

      const { data: vwPrevData } = await queryPrev;

      if (vwData && vwData.length > 0) {
        setDadosMes(vwData[0]);
        setDadosMesAnterior(vwPrevData && vwPrevData.length > 0 ? vwPrevData[0] : null);
      } else {
        // Fallback: Compute directly from sales and paid accounts
        await computeDirectBalanco(mes, ano, mesAnt, anoAnt, filId);
      }
    } catch (err) {
      console.warn('Fallback balanco mensal calculo direto:', err);
      let mesAnt = mes - 1;
      let anoAnt = ano;
      if (mesAnt < 1) {
        mesAnt = 12;
        anoAnt = ano - 1;
      }
      await computeDirectBalanco(mes, ano, mesAnt, anoAnt, filialIdFilter !== 'todas' ? filialIdFilter : selectedFilial?.id);
    } finally {
      setLoading(false);
    }
  };

  const computeDirectBalanco = async (
    mCurr: number,
    aCurr: number,
    mPrev: number,
    aPrev: number,
    filId?: string | null
  ) => {
    // Current month start / end
    const startCurr = new Date(aCurr, mCurr - 1, 1).toISOString();
    const endCurr = new Date(aCurr, mCurr, 0, 23, 59, 59).toISOString();

    // Sales query
    let salesQuery = supabase
      .from('vendas')
      .select('valor_total')
      .eq('status', 'finalizada')
      .gte('created_at', startCurr)
      .lte('created_at', endCurr);

    if (filId) salesQuery = salesQuery.eq('filial_id', filId);

    const { data: salesData } = await salesQuery;

    const totalVendasCurr = salesData ? salesData.reduce((acc, v) => acc + (v.valor_total || 0), 0) : 0;
    const qtdVendasCurr = salesData ? salesData.length : 0;

    // Paid accounts query
    let billsQuery = supabase
      .from('contas_pagar')
      .select('valor')
      .eq('status', 'pago')
      .gte('pago_em', startCurr)
      .lte('pago_em', endCurr);

    if (filId) billsQuery = billsQuery.eq('filial_id', filId);

    const { data: billsData } = await billsQuery;
    const totalContasPagasCurr = billsData ? billsData.reduce((acc, b) => acc + (b.valor || 0), 0) : 0;

    // Previous month sales query
    const startPrev = new Date(aPrev, mPrev - 1, 1).toISOString();
    const endPrev = new Date(aPrev, mPrev, 0, 23, 59, 59).toISOString();

    let salesPrevQuery = supabase
      .from('vendas')
      .select('valor_total')
      .eq('status', 'finalizada')
      .gte('created_at', startPrev)
      .lte('created_at', endPrev);

    if (filId) salesPrevQuery = salesPrevQuery.eq('filial_id', filId);

    const { data: salesPrevData } = await salesPrevQuery;
    const totalVendasPrev = salesPrevData ? salesPrevData.reduce((acc, v) => acc + (v.valor_total || 0), 0) : 0;

    setDadosMes({
      mes: mCurr,
      ano: aCurr,
      total_vendas: totalVendasCurr,
      quantidade_vendas: qtdVendasCurr,
      total_contas_pagas: totalContasPagasCurr,
      lucro_liquido_estimado: totalVendasCurr - totalContasPagasCurr,
    });

    setDadosMesAnterior({
      mes: mPrev,
      ano: aPrev,
      total_vendas: totalVendasPrev,
      quantidade_vendas: salesPrevData ? salesPrevData.length : 0,
    });
  };

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const getNomeMes = (mesNum: number) => {
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return meses[mesNum - 1] || `${mesNum}`;
  };

  // MoM Variation %
  const calcVarMom = () => {
    if (!dadosMes || !dadosMesAnterior || dadosMesAnterior.total_vendas === 0) return 0;
    const diff = dadosMes.total_vendas - dadosMesAnterior.total_vendas;
    return (diff / dadosMesAnterior.total_vendas) * 100;
  };

  const exportCsv = () => {
    if (!dadosMes) return;

    const rows = [
      ['Relatório de Balanço Mensal'],
      ['Mês/Ano', `${getNomeMes(mes)}/${ano}`],
      ['Filial', filialIdFilter !== 'todas' ? filialIdFilter : 'Todas / Ativa'],
      [''],
      ['Métrica', 'Valor'],
      ['Total de Vendas (R$)', dadosMes.total_vendas.toFixed(2)],
      ['Quantidade de Vendas', dadosMes.quantidade_vendas],
      ['Total de Contas Pagas (R$)', (dadosMes.total_contas_pagas || 0).toFixed(2)],
      ['Resultado Líquido Aproximado (R$)', (dadosMes.lucro_liquido_estimado || 0).toFixed(2)],
      ['Variação MoM (%)', `${calcVarMom().toFixed(2)}%`],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Balanco_Mensal_${mes}_${ano}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const varMom = calcVarMom();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E5E5E5]">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-500" />
            Balanço Mensal da Loja
          </h2>
          <p className="text-xs text-zinc-500">
            Relatório gerencial com total de vendas, despesas pagas e comparativo mensal
          </p>
        </div>

        <button
          type="button"
          onClick={exportCsv}
          className="px-4 py-2 bg-white hover:bg-zinc-100 text-zinc-900 font-semibold text-xs rounded-lg transition-colors border border-[#E5E5E5] flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
        >
          <Download className="w-4 h-4 text-zinc-600" />
          <span>Exportar Relatório (CSV)</span>
        </button>
      </div>

      {/* Selectors */}
      <div className="bg-white p-4 rounded-xl border border-[#E5E5E5] flex flex-wrap items-center gap-4">
        {/* Month Selector */}
        <div>
          <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Mês de Referência</label>
          <select
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            className="p-2 bg-zinc-50 border border-[#E5E5E5] rounded-lg text-xs font-semibold text-zinc-900 focus:outline-none focus:border-zinc-900"
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {getNomeMes(i + 1)}
              </option>
            ))}
          </select>
        </div>

        {/* Year Selector */}
        <div>
          <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Ano</label>
          <select
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="p-2 bg-zinc-50 border border-[#E5E5E5] rounded-lg text-xs font-semibold text-zinc-900 focus:outline-none focus:border-zinc-900"
          >
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
          </select>
        </div>

        {/* Filial Selector */}
        <div>
          <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Filial</label>
          <select
            value={filialIdFilter}
            onChange={(e) => setFilialIdFilter(e.target.value)}
            className="p-2 bg-zinc-50 border border-[#E5E5E5] rounded-lg text-xs font-semibold text-zinc-900 focus:outline-none focus:border-zinc-900"
          >
            <option value="todas">Todas as filiais</option>
            {filiais.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Report Cards */}
      {loading ? (
        <div className="p-12 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
          <div className="w-6 h-6 border-2 border-zinc-300 border-t-[#F5D800] rounded-full animate-spin" />
          Gerando balanço financeiro do período...
        </div>
      ) : dadosMes ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Vendas */}
            <div className="bg-white p-5 rounded-xl border border-[#E5E5E5] space-y-2">
              <span className="text-xs font-medium text-zinc-500 flex items-center justify-between">
                Total de Vendas
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
              </span>
              <p className="text-2xl font-bold text-zinc-900">{formatMoney(dadosMes.total_vendas)}</p>
              <p className="text-[11px] text-zinc-500">{dadosMes.quantidade_vendas} vendas realizadas</p>
            </div>

            {/* Comparativo MoM */}
            <div className="bg-white p-5 rounded-xl border border-[#E5E5E5] space-y-2">
              <span className="text-xs font-medium text-zinc-500 flex items-center justify-between">
                Comparativo MoM
                {varMom >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600" />
                )}
              </span>
              <p className={`text-2xl font-bold ${varMom >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {varMom >= 0 ? `+${varMom.toFixed(1)}%` : `${varMom.toFixed(1)}%`}
              </p>
              <p className="text-[11px] text-zinc-500">
                vs Mês Anterior ({formatMoney(dadosMesAnterior?.total_vendas || 0)})
              </p>
            </div>

            {/* Total Contas Pagas */}
            <div className="bg-white p-5 rounded-xl border border-[#E5E5E5] space-y-2">
              <span className="text-xs font-medium text-zinc-500 flex items-center justify-between">
                Despesas Pagas (Contas)
                <DollarSign className="w-4 h-4 text-amber-600" />
              </span>
              <p className="text-2xl font-bold text-zinc-900">{formatMoney(dadosMes.total_contas_pagas || 0)}</p>
              <p className="text-[11px] text-zinc-500">Contas e faturas quitadas</p>
            </div>

            {/* Resultado Liquido */}
            <div className="bg-white p-5 rounded-xl border border-zinc-900 bg-zinc-900 text-white space-y-2">
              <span className="text-xs font-medium text-zinc-400 flex items-center justify-between">
                Resultado Líquido Estimado
                <PieChart className="w-4 h-4 text-[#F5D800]" />
              </span>
              <p className="text-2xl font-bold text-[#F5D800]">
                {formatMoney(dadosMes.lucro_liquido_estimado || 0)}
              </p>
              <p className="text-[11px] text-zinc-400">Receitas - Despesas Pagas</p>
            </div>
          </div>

          {/* Graphical Summary Cards */}
          <div className="bg-white p-6 rounded-xl border border-[#E5E5E5] space-y-4">
            <h3 className="font-bold text-sm text-zinc-900">
              Detalhamento de Desempenho - {getNomeMes(mes)} / {ano}
            </h3>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-zinc-700">Faturamento Bruto</span>
                  <span className="font-bold text-emerald-800">{formatMoney(dadosMes.total_vendas)}</span>
                </div>
                <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full w-full" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-zinc-700">Comprometimento com Contas Pagas</span>
                  <span className="font-bold text-amber-800">
                    {formatMoney(dadosMes.total_contas_pagas || 0)}
                  </span>
                </div>
                <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        dadosMes.total_vendas > 0
                          ? ((dadosMes.total_contas_pagas || 0) / dadosMes.total_vendas) * 100
                          : 0
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
