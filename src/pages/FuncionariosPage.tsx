import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Edit, 
  UserCheck, 
  UserX, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  X, 
  Building2, 
  Store, 
  DollarSign, 
  ShieldCheck, 
  Key, 
  RefreshCw 
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { createClient } from '@supabase/supabase-js';
import { supabase, getStoredAnonKey } from '../lib/supabaseClient';
import { Usuario, CargoUsuario, Filial } from '../types';
import { useAuth } from '../context/AuthContext';
import { InputMaiusculo } from '../components/InputMaiusculo';

export const FuncionariosPage: React.FC = () => {
  const { usuarioProfile, empresa, filiais, selectedFilial } = useAuth();

  const isManagerOrAdmin = ['super_admin', 'admin', 'gerente'].includes(usuarioProfile?.cargo || '');

  const [funcionarios, setFuncionarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroMsg, setErroMsg] = useState<string | null>(null);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [cargoFilter, setCargoFilter] = useState<string>('todos');
  const [filialFilter, setFilialFilter] = useState<string>('todas');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  // Modals
  const [showNovoModal, setShowNovoModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showConviteModal, setShowConviteModal] = useState(false);
  const [conviteInfo, setConviteInfo] = useState<{ email: string; senhaTemp: string; nome: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Form states - Novo Funcionário
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [cargo, setCargo] = useState<CargoUsuario>('vendedor');
  const [formFilialId, setFormFilialId] = useState<string>('');
  
  // Extra campos Entregador
  const [remuneracaoTipo, setRemuneracaoTipo] = useState<'so_fixo' | 'so_comissao' | 'fixo_comissao'>('so_fixo');
  const [salarioFixo, setSalarioFixo] = useState<string>('');
  const [comissaoPercentual, setComissaoPercentual] = useState<string>('');
  const [comissaoValorFixo, setComissaoValorFixo] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states - Editar Funcionário
  const [editingFuncionario, setEditingFuncionario] = useState<Usuario | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editCargo, setEditCargo] = useState<CargoUsuario>('vendedor');
  const [editFilialId, setEditFilialId] = useState<string>('');
  const [editAtivo, setEditAtivo] = useState(true);
  
  const [editRemuneracaoTipo, setEditRemuneracaoTipo] = useState<'so_fixo' | 'so_comissao' | 'fixo_comissao'>('so_fixo');
  const [editSalarioFixo, setEditSalarioFixo] = useState<string>('');
  const [editComissaoPercentual, setEditComissaoPercentual] = useState<string>('');
  const [editComissaoValorFixo, setEditComissaoValorFixo] = useState<string>('');

  const loadFuncionarios = async () => {
    if (!empresa?.id) return;
    setLoading(true);
    setErroMsg(null);
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('empresa_id', empresa.id)
        .order('nome', { ascending: true });

      if (error) throw error;
      setFuncionarios((data as Usuario[]) || []);
    } catch (err: any) {
      setErroMsg(err?.message || 'Erro ao carregar lista de funcionários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isManagerOrAdmin) {
      loadFuncionarios();
    }
  }, [empresa?.id, isManagerOrAdmin]);

  // Handle open New Employee Modal
  const handleOpenNovoModal = () => {
    setNome('');
    setEmail('');
    setCargo('vendedor');
    setFormFilialId(selectedFilial?.id || (filiais.length > 0 ? filiais[0].id : ''));
    setRemuneracaoTipo('so_fixo');
    setSalarioFixo('');
    setComissaoPercentual('');
    setComissaoValorFixo('');
    setFormError(null);
    setShowNovoModal(true);
  };

  // Generate temporary password
  const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pass = 'Loja@';
    for (let i = 0; i < 4; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  // Submit New Employee
  const handleNovoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!nome.trim() || !email.trim()) {
      setFormError('Preencha os campos obrigatórios (Nome e E-mail).');
      return;
    }

    if (!empresa?.id) {
      setFormError('Empresa não identificada.');
      return;
    }

    setSubmitting(true);
    const resolvedFilialId = formFilialId || selectedFilial?.id || (
      await supabase
        .from('filiais')
        .select('id')
        .eq('empresa_id', empresa?.id)
        .limit(1)
        .maybeSingle()
    ).data?.id;

    if (!resolvedFilialId) {
      toast.error('Nenhuma filial encontrada. Cadastre uma filial primeiro.');
      setSubmitting(false);
      return;
    }

    const senhaTemp = generateTempPassword();

    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://zxuiybythajwdoijdakt.supabase.co';
      const anonKey = getStoredAnonKey();
      
      let userId: string | null = null;

      // Create temporary client without session persistence to avoid switching current admin user
      if (anonKey) {
        try {
          const tempAuthClient = createClient(SUPABASE_URL, anonKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
          });
          const { data: authData, error: authErr } = await tempAuthClient.auth.signUp({
            email: email.trim(),
            password: senhaTemp,
          });

          if (authData?.user?.id) {
            userId = authData.user.id;
          } else if (authErr) {
            console.warn('Erro auth signUp:', authErr.message);
          }
        } catch (authException) {
          console.warn('Falha na autenticação isolada:', authException);
        }
      }

      // Fallback ID if auth signUp didn't return an ID
      if (!userId) {
        userId = crypto.randomUUID();
      }

      // Prepare payload for 'usuarios' table
      const novoUsuario = {
        id: userId,
        empresa_id: empresa.id,
        filial_id: resolvedFilialId,
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        cargo: cargo,
        remuneracao_tipo: cargo === 'entregador' ? remuneracaoTipo : null,
        salario_fixo: cargo === 'entregador' && (remuneracaoTipo === 'so_fixo' || remuneracaoTipo === 'fixo_comissao') 
          ? Number(salarioFixo || 0) 
          : null,
        comissao_percentual: cargo === 'entregador' && (remuneracaoTipo === 'so_comissao' || remuneracaoTipo === 'fixo_comissao') 
          ? Number(comissaoPercentual || 0) 
          : null,
        comissao_valor_fixo: cargo === 'entregador' 
          ? Number(comissaoValorFixo || 0) 
          : null,
        ativo: true,
      };

      const { error: dbError } = await supabase.from('usuarios').upsert([novoUsuario]);

      if (dbError) throw dbError;

      setShowNovoModal(false);
      setConviteInfo({
        nome: nome.trim(),
        email: email.trim(),
        senhaTemp: senhaTemp,
      });
      setShowConviteModal(true);
      loadFuncionarios();
    } catch (err: any) {
      setFormError(err?.message || 'Erro ao cadastrar funcionário.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (func: Usuario) => {
    setEditingFuncionario(func);
    setEditNome(func.nome || '');
    setEditCargo(func.cargo || 'vendedor');
    setEditFilialId(func.filial_id || '');
    setEditAtivo(func.ativo !== false);
    
    setEditRemuneracaoTipo(func.remuneracao_tipo || 'so_fixo');
    setEditSalarioFixo(func.salario_fixo ? String(func.salario_fixo) : '');
    setEditComissaoPercentual(func.comissao_percentual ? String(func.comissao_percentual) : '');
    setEditComissaoValorFixo(func.comissao_valor_fixo ? String(func.comissao_valor_fixo) : '');

    setFormError(null);
    setShowEditModal(true);
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFuncionario) return;
    setFormError(null);
    setSubmitting(true);

    try {
      const payload: Partial<Usuario> = {
        nome: editNome.trim(),
        cargo: editCargo,
        filial_id: editFilialId || null,
        ativo: editAtivo,
        remuneracao_tipo: editCargo === 'entregador' ? editRemuneracaoTipo : null,
        salario_fixo: editCargo === 'entregador' && (editRemuneracaoTipo === 'so_fixo' || editRemuneracaoTipo === 'fixo_comissao') 
          ? Number(editSalarioFixo || 0) 
          : null,
        comissao_percentual: editCargo === 'entregador' && (editRemuneracaoTipo === 'so_comissao' || editRemuneracaoTipo === 'fixo_comissao') 
          ? Number(editComissaoPercentual || 0) 
          : null,
        comissao_valor_fixo: editCargo === 'entregador' 
          ? Number(editComissaoValorFixo || 0) 
          : null,
      };

      const { error } = await supabase
        .from('usuarios')
        .update(payload)
        .eq('id', editingFuncionario.id);

      if (error) throw error;

      setSucessoMsg(`Funcionário ${editNome} atualizado com sucesso!`);
      setShowEditModal(false);
      loadFuncionarios();
      setTimeout(() => setSucessoMsg(null), 4000);
    } catch (err: any) {
      setFormError(err?.message || 'Erro ao salvar alterações do funcionário.');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Status (Ativar / Desativar)
  const handleToggleAtivo = async (func: Usuario) => {
    const novoStatus = func.ativo === false ? true : false;
    const acaoTexto = novoStatus ? 'ativar' : 'desativar';

    if (!window.confirm(`Deseja realmente ${acaoTexto} o funcionário ${func.nome}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ ativo: novoStatus })
        .eq('id', func.id);

      if (error) throw error;

      setSucessoMsg(`Funcionário ${func.nome} ${novoStatus ? 'ativado' : 'desativado'} com sucesso.`);
      loadFuncionarios();
      setTimeout(() => setSucessoMsg(null), 4000);
    } catch (err: any) {
      setErroMsg(err?.message || 'Erro ao alterar status do funcionário.');
    }
  };

  // Copy invitation text
  const handleCopiarConvite = () => {
    if (!conviteInfo) return;
    const texto = `Olá, ${conviteInfo.nome}!\nVocê foi convidado para acessar o sistema da loja.\n\nE-mail: ${conviteInfo.email}\nSenha Temporária: ${conviteInfo.senhaTemp}\n\nAcesse e faça seu login. Recomendamos alterar a senha no primeiro acesso.`;
    navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  };

  // Map cargo for display
  const formatCargo = (cargoName?: string) => {
    if (!cargoName) return 'Não definido';
    const map: Record<string, string> = {
      super_admin: 'Super Admin',
      admin: 'Administrador',
      gerente: 'Gerente',
      vendedor: 'Vendedor',
      caixa: 'Caixa',
      estoquista: 'Estoquista',
      financeiro: 'Financeiro',
      comprador: 'Comprador',
      entregador: 'Entregador',
    };
    return map[cargoName] || cargoName;
  };

  // Cargo badge color helper
  const getCargoBadgeClass = (c: string) => {
    switch (c) {
      case 'admin':
      case 'super_admin':
        return 'bg-purple-100 text-purple-900 border-purple-200';
      case 'gerente':
        return 'bg-blue-100 text-blue-900 border-blue-200';
      case 'entregador':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'vendedor':
        return 'bg-emerald-100 text-emerald-900 border-emerald-200';
      case 'caixa':
        return 'bg-indigo-100 text-indigo-900 border-indigo-200';
      case 'financeiro':
        return 'bg-cyan-100 text-cyan-900 border-cyan-200';
      default:
        return 'bg-zinc-100 text-zinc-800 border-zinc-200';
    }
  };

  // Map Filial name
  const getFilialNome = (fId?: string | null) => {
    if (!fId) return 'Todas / Matriz';
    const found = filiais.find(f => f.id === fId);
    return found ? found.nome : 'Matriz';
  };

  // Filtered list
  const filteredFuncionarios = funcionarios.filter((f) => {
    const matchesSearch = 
      f.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCargo = cargoFilter === 'todos' || f.cargo === cargoFilter;
    const matchesFilial = filialFilter === 'todas' || f.filial_id === filialFilter;
    
    let matchesStatus = true;
    if (statusFilter === 'ativo') matchesStatus = f.ativo !== false;
    if (statusFilter === 'inativo') matchesStatus = f.ativo === false;

    return matchesSearch && matchesCargo && matchesFilial && matchesStatus;
  });

  // KPI calculations
  const totalFuncionarios = funcionarios.length;
  const totalAtivos = funcionarios.filter(f => f.ativo !== false).length;
  const totalInativos = funcionarios.filter(f => f.ativo === false).length;
  const totalEntregadores = funcionarios.filter(f => f.cargo === 'entregador').length;

  if (!isManagerOrAdmin) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white border border-[#E5E5E5] rounded-2xl shadow-sm text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7 stroke-[2]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">Acesso Restrito ao Módulo</h2>
          <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
            A gestão e cadastro de funcionários é restrita a <span className="font-semibold text-zinc-900">Gerentes</span> e <span className="font-semibold text-zinc-900">Administradores</span>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-zinc-700" />
            <span>Gestão de Funcionários e Equipe</span>
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Cadastre, edite permissões, vincule filiais e configure remunerações da equipe
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenNovoModal}
          className="px-4 py-2 bg-[#F5D800] hover:bg-[#ebd000] text-zinc-950 font-bold text-xs rounded-lg border border-[#d2b800] flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Cadastrar Novo Funcionário</span>
        </button>
      </div>

      {/* Messages */}
      {sucessoMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{sucessoMsg}</span>
        </div>
      )}

      {erroMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{erroMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div 
          onClick={() => setStatusFilter('todos')}
          className={`card-interativo p-4 space-y-1 ${statusFilter === 'todos' ? 'card-selected' : ''}`}
        >
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
            Total da Equipe
          </span>
          <span className="text-xl font-extrabold text-zinc-900 block">
            {totalFuncionarios}
          </span>
        </div>

        <div 
          onClick={() => setStatusFilter('ativo')}
          className={`card-interativo p-4 space-y-1 bg-emerald-50/40 border-emerald-200 ${statusFilter === 'ativo' ? 'card-selected' : ''}`}
        >
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
            Funcionários Ativos
          </span>
          <span className="text-xl font-extrabold text-emerald-900 block">
            {totalAtivos}
          </span>
        </div>

        <div 
          onClick={() => setStatusFilter('inativo')}
          className={`card-interativo p-4 space-y-1 bg-zinc-100/60 border-zinc-200 ${statusFilter === 'inativo' ? 'card-selected' : ''}`}
        >
          <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block">
            Desativados / Inativos
          </span>
          <span className="text-xl font-extrabold text-zinc-700 block">
            {totalInativos}
          </span>
        </div>

        <div 
          onClick={() => setCargoFilter('entregador')}
          className={`card-interativo p-4 space-y-1 bg-amber-50/40 border-amber-200 ${cargoFilter === 'entregador' ? 'card-selected' : ''}`}
        >
          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
            Equipe de Entregas
          </span>
          <span className="text-xl font-extrabold text-amber-950 block">
            {totalEntregadores}
          </span>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="card-interativo p-4 cursor-default hover:translate-y-0 hover:border-l-transparent">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Search input */}
          <div className="relative sm:col-span-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
              <Search className="w-4 h-4" />
            </div>
            <InputMaiusculo
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou e-mail..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
            />
          </div>

          {/* Cargo filter */}
          <div>
            <select
              value={cargoFilter}
              onChange={(e) => setCargoFilter(e.target.value)}
              className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs font-medium text-zinc-800 focus:outline-none focus:border-zinc-900"
            >
              <option value="todos">Todos os Cargos</option>
              <option value="admin">Administrador</option>
              <option value="gerente">Gerente</option>
              <option value="vendedor">Vendedor</option>
              <option value="caixa">Caixa</option>
              <option value="estoquista">Estoquista</option>
              <option value="financeiro">Financeiro</option>
              <option value="comprador">Comprador</option>
              <option value="entregador">Entregador</option>
            </select>
          </div>

          {/* Filial filter */}
          <div>
            <select
              value={filialFilter}
              onChange={(e) => setFilialFilter(e.target.value)}
              className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs font-medium text-zinc-800 focus:outline-none focus:border-zinc-900"
            >
              <option value="todas">Todas as Filiais</option>
              {filiais.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs font-medium text-zinc-800 focus:outline-none focus:border-zinc-900"
            >
              <option value="todos">Todos os Status</option>
              <option value="ativo">Somente Ativos</option>
              <option value="inativo">Somente Inativos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Employees Table */}
      <div className="card-interativo overflow-hidden cursor-default hover:translate-y-0 hover:border-l-transparent">
        {loading ? (
          <div className="p-12 text-center text-zinc-500 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-zinc-400" />
            <span>Carregando funcionários...</span>
          </div>
        ) : filteredFuncionarios.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-xs space-y-2">
            <Users className="w-8 h-8 mx-auto text-zinc-300" />
            <p className="font-semibold text-zinc-700">Nenhum funcionário encontrado</p>
            <p className="text-[11px] text-zinc-400">Tente ajustar os filtros de busca ou cadastre um novo funcionário.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-[#E5E5E5] text-zinc-500 font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Funcionário</th>
                  <th className="px-4 py-3">Cargo / Perfil</th>
                  <th className="px-4 py-3">Filial Vinculada</th>
                  <th className="px-4 py-3">Remuneração (Se Entregador)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5] bg-white">
                {filteredFuncionarios.map((func) => {
                  const isAtivo = func.ativo !== false;
                  return (
                    <tr key={func.id} className="hover:bg-zinc-50/80 transition-colors">
                      {/* Name & Email */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${
                            isAtivo ? 'bg-zinc-100 text-zinc-700 border-[#E5E5E5]' : 'bg-zinc-200 text-zinc-400 border-zinc-300'
                          }`}>
                            {func.nome.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-zinc-900 leading-tight">
                              {func.nome}
                            </p>
                            <p className="text-[11px] text-zinc-500">
                              {func.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Cargo */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${getCargoBadgeClass(func.cargo)}`}>
                          {formatCargo(func.cargo)}
                        </span>
                      </td>

                      {/* Filial */}
                      <td className="px-4 py-3 text-zinc-700 font-medium">
                        <div className="flex items-center gap-1.5 text-zinc-700">
                          <Store className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{getFilialNome(func.filial_id)}</span>
                        </div>
                      </td>

                      {/* Remuneração details */}
                      <td className="px-4 py-3 text-zinc-600 text-[11px]">
                        {func.cargo === 'entregador' ? (
                          <div className="space-y-0.5">
                            <span className="font-semibold text-zinc-800">
                              {func.remuneracao_tipo === 'so_fixo' && 'Só Fixo'}
                              {func.remuneracao_tipo === 'so_comissao' && 'Só Comissão'}
                              {func.remuneracao_tipo === 'fixo_comissao' && 'Fixo + Comissão'}
                              {!func.remuneracao_tipo && 'Não definido'}
                            </span>
                            {(func.salario_fixo || 0) > 0 && (
                              <p className="text-zinc-500">
                                Fixo: R$ {Number(func.salario_fixo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                            )}
                            {(func.comissao_percentual || 0) > 0 && (
                              <p className="text-zinc-500">
                                Comis: {func.comissao_percentual}%
                                {(func.comissao_valor_fixo || 0) > 0 && ` + R$ ${Number(func.comissao_valor_fixo).toFixed(2)}/ent.`}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {isAtivo ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <UserCheck className="w-3 h-3" />
                            <span>Ativo</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-200 text-zinc-600 border border-zinc-300">
                            <UserX className="w-3 h-3" />
                            <span>Inativo</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(func)}
                            className="p-1.5 text-zinc-600 hover:text-zinc-900 border border-[#E5E5E5] hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
                            title="Editar funcionário"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleAtivo(func)}
                            className={`px-2.5 py-1 text-[11px] font-semibold border rounded-lg transition-colors cursor-pointer ${
                              isAtivo 
                                ? 'border-zinc-300 hover:bg-red-50 text-zinc-700 hover:text-red-700' 
                                : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            }`}
                          >
                            {isAtivo ? 'Desativar' : 'Reativar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Novo Funcionário */}
      {showNovoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#E5E5E5] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 bg-zinc-900 text-white flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#F5D800] text-zinc-950 flex items-center justify-center font-bold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Cadastrar Novo Funcionário</h3>
                  <p className="text-[11px] text-zinc-400">Preencha os dados e perfil de acesso</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNovoModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleNovoSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Nome */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Nome Completo <span className="text-red-500">*</span>
                </label>
                <InputMaiusculo
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="w-full p-2.5 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>

              {/* E-mail */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  E-mail de Acesso <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="funcionario@loja.com"
                  className="w-full p-2.5 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>

              {/* Cargo & Filial Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Cargo Dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Cargo / Perfil de Acesso <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value as CargoUsuario)}
                    className="w-full p-2.5 bg-white border border-[#E5E5E5] rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-zinc-900"
                  >
                    <option value="vendedor">Vendedor</option>
                    <option value="caixa">Caixa</option>
                    <option value="estoquista">Estoquista</option>
                    <option value="entregador">Entregador</option>
                    <option value="gerente">Gerente</option>
                    <option value="financeiro">Financeiro</option>
                    <option value="comprador">Comprador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                {/* Filial Dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Filial Vinculada
                  </label>
                  <select
                    value={formFilialId}
                    onChange={(e) => setFormFilialId(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E5E5E5] rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-zinc-900"
                  >
                    <option value="">Matriz / Todas as Filiais</option>
                    {filiais.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Campos Extras se Entregador */}
              {cargo === 'entregador' && (
                <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-amber-950 font-bold text-xs border-b border-amber-200 pb-2">
                    <DollarSign className="w-4 h-4 text-amber-700" />
                    <span>Configuração de Remuneração do Entregador</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Tipo de Remuneração
                    </label>
                    <select
                      value={remuneracaoTipo}
                      onChange={(e) => setRemuneracaoTipo(e.target.value as any)}
                      className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-zinc-900"
                    >
                      <option value="so_fixo">Só Salário Fixo</option>
                      <option value="so_comissao">Só Comissão por Entrega</option>
                      <option value="fixo_comissao">Fixo + Comissão por Entrega</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(remuneracaoTipo === 'so_fixo' || remuneracaoTipo === 'fixo_comissao') && (
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                          Salário Fixo (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={salarioFixo}
                          onChange={(e) => setSalarioFixo(e.target.value)}
                          placeholder="2000.00"
                          className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                        />
                      </div>
                    )}

                    {(remuneracaoTipo === 'so_comissao' || remuneracaoTipo === 'fixo_comissao') && (
                      <>
                        <div>
                          <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                            Comissão (%)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={comissaoPercentual}
                            onChange={(e) => setComissaoPercentual(e.target.value)}
                            placeholder="5.0"
                            className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                            Comissão Fixa (R$/entrega)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={comissaoValorFixo}
                            onChange={(e) => setComissaoValorFixo(e.target.value)}
                            placeholder="10.00"
                            className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E5E5]">
                <button
                  type="button"
                  onClick={() => setShowNovoModal(false)}
                  className="px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#F5D800] hover:bg-[#ebd000] text-zinc-950 font-bold text-xs rounded-lg border border-[#d2b800] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Cadastrando...</span>
                    </>
                  ) : (
                    <span>Cadastrar e Gerar Convite</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Convite Gerado Sucesso */}
      {showConviteModal && conviteInfo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#E5E5E5] rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 bg-emerald-900 text-white flex items-center justify-between border-b border-emerald-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-400 text-emerald-950 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Convite Gerado com Sucesso!</h3>
                  <p className="text-[11px] text-emerald-200">Repasse os dados para o funcionário</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConviteModal(false)}
                className="text-emerald-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-zinc-600 leading-relaxed">
                O funcionário <span className="font-bold text-zinc-900">{conviteInfo.nome}</span> foi cadastrado. Repasse as credenciais abaixo para que ele faça o primeiro acesso:
              </p>

              <div className="p-4 bg-zinc-50 border border-[#E5E5E5] rounded-xl space-y-2.5 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-sans font-bold block">E-mail de Acesso</span>
                  <span className="font-bold text-zinc-900">{conviteInfo.email}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-sans font-bold block">Senha Temporária</span>
                  <span className="font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 inline-block">
                    {conviteInfo.senhaTemp}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCopiarConvite}
                  className={`w-full py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer border ${
                    copiado 
                      ? 'bg-emerald-600 text-white border-emerald-700' 
                      : 'bg-zinc-900 hover:bg-zinc-800 text-white border-zinc-900'
                  }`}
                >
                  {copiado ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Dados Copiados!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar Dados do Convite</span>
                    </>
                  )}
                </button>
              </div>

              <div className="pt-2 text-right">
                <button
                  type="button"
                  onClick={() => setShowConviteModal(false)}
                  className="px-4 py-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Editar Funcionário */}
      {showEditModal && editingFuncionario && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#E5E5E5] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 bg-zinc-900 text-white flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#F5D800] text-zinc-950 flex items-center justify-center font-bold">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Editar Funcionário</h3>
                  <p className="text-[11px] text-zinc-400">{editingFuncionario.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Nome */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Nome Completo
                </label>
                <InputMaiusculo
                  type="text"
                  required
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>

              {/* Cargo & Filial Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Cargo Dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Cargo / Perfil
                  </label>
                  <select
                    value={editCargo}
                    onChange={(e) => setEditCargo(e.target.value as CargoUsuario)}
                    className="w-full p-2.5 bg-white border border-[#E5E5E5] rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-zinc-900"
                  >
                    <option value="vendedor">Vendedor</option>
                    <option value="caixa">Caixa</option>
                    <option value="estoquista">Estoquista</option>
                    <option value="entregador">Entregador</option>
                    <option value="gerente">Gerente</option>
                    <option value="financeiro">Financeiro</option>
                    <option value="comprador">Comprador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                {/* Filial Dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Filial Vinculada
                  </label>
                  <select
                    value={editFilialId}
                    onChange={(e) => setEditFilialId(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E5E5E5] rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-zinc-900"
                  >
                    <option value="">Matriz / Todas as Filiais</option>
                    {filiais.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status (Ativo / Inativo) */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Status da Conta
                </label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs font-medium text-zinc-800 cursor-pointer">
                    <input
                      type="radio"
                      name="status_ativo"
                      checked={editAtivo === true}
                      onChange={() => setEditAtivo(true)}
                      className="accent-[#F5D800]"
                    />
                    <span>Ativo (Acesso Liberado)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-zinc-800 cursor-pointer">
                    <input
                      type="radio"
                      name="status_ativo"
                      checked={editAtivo === false}
                      onChange={() => setEditAtivo(false)}
                      className="accent-red-600"
                    />
                    <span className="text-red-700">Inativo (Desativado)</span>
                  </label>
                </div>
              </div>

              {/* Campos Extras se Entregador */}
              {editCargo === 'entregador' && (
                <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-amber-950 font-bold text-xs border-b border-amber-200 pb-2">
                    <DollarSign className="w-4 h-4 text-amber-700" />
                    <span>Configuração de Remuneração do Entregador</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Tipo de Remuneração
                    </label>
                    <select
                      value={editRemuneracaoTipo}
                      onChange={(e) => setEditRemuneracaoTipo(e.target.value as any)}
                      className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-zinc-900"
                    >
                      <option value="so_fixo">Só Salário Fixo</option>
                      <option value="so_comissao">Só Comissão por Entrega</option>
                      <option value="fixo_comissao">Fixo + Comissão por Entrega</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(editRemuneracaoTipo === 'so_fixo' || editRemuneracaoTipo === 'fixo_comissao') && (
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                          Salário Fixo (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={editSalarioFixo}
                          onChange={(e) => setEditSalarioFixo(e.target.value)}
                          placeholder="2000.00"
                          className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                        />
                      </div>
                    )}

                    {(editRemuneracaoTipo === 'so_comissao' || editRemuneracaoTipo === 'fixo_comissao') && (
                      <>
                        <div>
                          <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                            Comissão (%)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={editComissaoPercentual}
                            onChange={(e) => setEditComissaoPercentual(e.target.value)}
                            placeholder="5.0"
                            className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                            Comissão Fixa (R$/entrega)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={editComissaoValorFixo}
                            onChange={(e) => setEditComissaoValorFixo(e.target.value)}
                            placeholder="10.00"
                            className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E5E5]">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#F5D800] hover:bg-[#ebd000] text-zinc-950 font-bold text-xs rounded-lg border border-[#d2b800] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>Salvar Alterações</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
