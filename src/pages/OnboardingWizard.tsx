import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Building2, 
  User, 
  Mail, 
  Lock, 
  MapPin, 
  FileText, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Gift, 
  AlertCircle,
  Sparkles,
  Store
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { formatarCpfCnpj, onlyNumbers } from '../utils/formatters';
import { InputMaiusculo } from '../components/InputMaiusculo';

export const OnboardingWizard: React.FC = () => {
  const navigate = useNavigate();
  const { refreshUserData } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Step 1 Form: Criar conta
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);

  // Step 2 Form: Dados da loja
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [empresaEncontrada, setEmpresaEncontrada] = useState<string | null>(null);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [nomeFilial, setNomeFilial] = useState('Matriz');
  const [enderecoFilial, setEnderecoFilial] = useState('');
  const [createdEmpresaId, setCreatedEmpresaId] = useState<string | null>(null);

  // Consulta CNPJ na BrasilAPI quando atingir 14 dígitos numéricos
  useEffect(() => {
    const cleanCnpj = onlyNumbers(cpfCnpj);
    if (cleanCnpj.length === 14) {
      setBuscandoCnpj(true);
      fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`)
        .then((res) => {
          if (!res.ok) throw new Error('CNPJ não encontrado');
          return res.json();
        })
        .then((data) => {
          const nomeEncontrado = data.razao_social || data.nome_fantasia;
          if (nomeEncontrado) {
            setEmpresaEncontrada(nomeEncontrado);
          } else {
            setEmpresaEncontrada(null);
          }
        })
        .catch(() => {
          setEmpresaEncontrada(null);
        })
        .finally(() => {
          setBuscandoCnpj(false);
        });
    } else {
      setEmpresaEncontrada(null);
      setBuscandoCnpj(false);
    }
  }, [cpfCnpj]);

  // Step 3 Form: Código cortesia
  const [temCodigoCortesia, setTemCodigoCortesia] = useState(false);
  const [codigoCortesia, setCodigoCortesia] = useState('');
  const [cortesiaAplicada, setCortesiaAplicada] = useState<boolean | null>(null);
  const [msgCortesia, setMsgCortesia] = useState<string | null>(null);

  // Utility to generate slug
  const generateSlug = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || `loja-${Date.now()}`;
  };

  // Step 1 submit: Create account on Supabase Auth
  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!nomeUsuario.trim() || !email.trim() || !senha) {
      setErro('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (senha.length < 6) {
      setErro('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      // SignUp
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha,
        options: {
          data: {
            nome: nomeUsuario.trim(),
          },
        },
      });

      if (error) {
        setErro(error.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        setCreatedUserId(data.user.id);
        setStep(2);
      } else {
        setErro('Falha ao registrar usuário. Verifique se o e-mail já está em uso.');
      }
    } catch (err: any) {
      setErro(err?.message || 'Erro inesperado ao criar a conta.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 submit: Create company onboarding
  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!nomeEmpresa.trim() || !nomeFilial.trim()) {
      setErro('Por favor, informe o nome da empresa e o nome da primeira filial.');
      return;
    }

    let userId = createdUserId;
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    }

    if (!userId) {
      setErro('Sessão do usuário não encontrada. Por favor, volte ao passo 1.');
      return;
    }

    setLoading(true);
    try {
      const slug = generateSlug(nomeEmpresa);

      // Call RPC criar_empresa_onboarding
      const { data, error } = await supabase.rpc('criar_empresa_onboarding', {
        p_nome_empresa: nomeEmpresa.trim(),
        p_slug: slug,
        p_cnpj: onlyNumbers(cpfCnpj) || null,
        p_admin_user_id: userId,
        p_admin_nome: nomeUsuario.trim() || 'Administrador',
      });

      if (error) {
        console.error('Erro na RPC criar_empresa_onboarding:', error);
        // Fallback or retry message
        setErro(`Erro ao cadastrar loja: ${error.message}`);
        setLoading(false);
        return;
      }

      // If data is returned (usually empresa_id or object)
      const empresaIdResult = typeof data === 'string' ? data : data?.id || data?.empresa_id;
      if (empresaIdResult) {
        setCreatedEmpresaId(empresaIdResult);

        // Update branch name & address if provided and branch exists
        if (enderecoFilial.trim() || nomeFilial.trim()) {
          try {
            await supabase
              .from('filiais')
              .update({
                nome: nomeFilial.trim(),
                endereco: enderecoFilial.trim() || null,
              })
              .eq('empresa_id', empresaIdResult);
          } catch (e) {
            console.warn('Atualização complementar da filial:', e);
          }
        }
      }

      // Refresh auth context user state
      await refreshUserData();

      setStep(3);
    } catch (err: any) {
      setErro(err?.message || 'Falha ao concluir onboarding da loja.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3 submit: Optional courtesy code
  const handleStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setMsgCortesia(null);

    if (temCodigoCortesia && codigoCortesia.trim()) {
      if (!createdEmpresaId) {
        // Try to fetch empresaId from current auth user
        const { data: userProfile } = await supabase
          .from('usuarios')
          .select('empresa_id')
          .eq('id', createdUserId || '')
          .maybeSingle();

        if (userProfile?.empresa_id) {
          setCreatedEmpresaId(userProfile.empresa_id);
        }
      }

      const empId = createdEmpresaId;
      if (!empId) {
        setErro('Identificador da empresa não localizado para validar cortesia.');
        return;
      }

      setLoading(true);
      try {
        const { data: resgatoSucesso, error } = await supabase.rpc('resgatar_codigo_cortesia', {
          p_codigo: codigoCortesia.trim(),
          p_empresa_id: empId,
        });

        if (error) {
          setCortesiaAplicada(false);
          setMsgCortesia(`Não foi possível ativar: ${error.message}`);
        } else if (resgatoSucesso === true) {
          setCortesiaAplicada(true);
          setMsgCortesia('Código de cortesia ativado com sucesso!');
        } else {
          setCortesiaAplicada(false);
          setMsgCortesia('Código inválido ou já utilizado.');
        }
      } catch (err: any) {
        setCortesiaAplicada(false);
        setMsgCortesia(`Erro: ${err?.message || 'Falha na validação do código'}`);
      } finally {
        setLoading(false);
      }
    }

    await refreshUserData();
    setStep(4);
  };

  const handleFinish = async () => {
    await refreshUserData();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[#F5D800] text-black mb-3 border border-[#E5E5E5] shadow-xs">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Cadastro de loja e onboarding
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Configure sua conta corporativa em poucos passos
          </p>
        </div>

        {/* Stepper Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-500 mb-2">
            <span className={step >= 1 ? 'text-zinc-900 font-semibold' : ''}>1. Conta</span>
            <span className={step >= 2 ? 'text-zinc-900 font-semibold' : ''}>2. Loja</span>
            <span className={step >= 3 ? 'text-zinc-900 font-semibold' : ''}>3. Cortesia</span>
            <span className={step >= 4 ? 'text-zinc-900 font-semibold' : ''}>4. Conclusão</span>
          </div>
          <div className="w-full bg-[#E5E5E5] h-2 rounded-full overflow-hidden flex">
            <div
              className="bg-[#F5D800] h-full transition-all duration-300"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* Wizard Card */}
        <div className="industrial-card p-8">
          {erro && (
            <div className="mb-6 p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-800 text-sm">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>{erro}</div>
            </div>
          )}

          {/* STEP 1: CRIAR CONTA */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 mb-1">
                  Etapa 1 — Criar sua conta de usuário
                </h2>
                <p className="text-xs text-zinc-600 mb-4 pb-3 border-b border-[#E5E5E5]">
                  Informe os dados do responsável da conta
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Seu nome completo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                    <User className="w-4 h-4" />
                  </div>
                  <InputMaiusculo
                    type="text"
                    required
                    value={nomeUsuario}
                    onChange={(e) => setNomeUsuario(e.target.value)}
                    placeholder="Ex: Carlos Silva"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  E-mail corporativo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="carlos@construcao.com.br"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Senha de acesso
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <Link
                  to="/login"
                  className="text-xs text-zinc-600 hover:text-zinc-900"
                >
                  Já tenho conta
                </Link>

                <button
                  type="submit"
                  disabled={loading}
                  className="py-2.5 px-5 bg-[#F5D800] hover:bg-[#ebd000] text-zinc-950 font-semibold rounded-lg text-sm flex items-center gap-2 border border-[#d2b800] transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {loading ? 'Criando conta...' : 'Próximo passo'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: DADOS DA LOJA */}
          {step === 2 && (
            <form onSubmit={handleStep2} className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 mb-1">
                  Etapa 2 — Dados da empresa e filial
                </h2>
                <p className="text-xs text-zinc-600 mb-4 pb-3 border-b border-[#E5E5E5]">
                  Informe os dados básicos da sua loja de materiais de construção
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Nome da empresa / Razão social
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <InputMaiusculo
                    type="text"
                    required
                    value={nomeEmpresa}
                    onChange={(e) => setNomeEmpresa(e.target.value)}
                    placeholder="Ex: Comercial Silva Materiais para Construção"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  CPF ou CNPJ <span className="text-xs font-normal text-zinc-500">(opcional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={cpfCnpj}
                    onChange={(e) => {
                      const formatted = formatarCpfCnpj(e.target.value);
                      setCpfCnpj(formatted);
                    }}
                    placeholder="000.000.000-00 ou 00.000.000/0001-00"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900"
                  />
                </div>
                {buscandoCnpj && (
                  <p className="mt-1.5 text-xs text-zinc-500 flex items-center gap-1.5">
                    Consultando CNPJ...
                  </p>
                )}
                {empresaEncontrada && !buscandoCnpj && (
                  <p className="mt-1.5 text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Empresa encontrada: {empresaEncontrada}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                    Nome da primeira filial
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                      <Store className="w-4 h-4" />
                    </div>
                    <InputMaiusculo
                      type="text"
                      required
                      value={nomeFilial}
                      onChange={(e) => setNomeFilial(e.target.value)}
                      placeholder="Ex: Matriz Centro"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                    Endereço da filial <span className="text-xs font-normal text-zinc-500">(opcional)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <InputMaiusculo
                      type="text"
                      value={enderecoFilial}
                      onChange={(e) => setEnderecoFilial(e.target.value)}
                      placeholder="Av. Principal, 1000"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50/60 border border-[#F5D800] rounded-lg flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-xs font-medium text-amber-900">
                  Seu trial de 7 dias começou agora. Aproveite todos os recursos liberados.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="py-2 px-3 text-xs text-zinc-600 hover:text-zinc-900 flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="py-2.5 px-5 bg-[#F5D800] hover:bg-[#ebd000] text-zinc-950 font-semibold rounded-lg text-sm flex items-center gap-2 border border-[#d2b800] transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {loading ? 'Cadastrando loja...' : 'Continuar'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: CÓDIGO CORTESIA (OPCIONAL) */}
          {step === 3 && (
            <form onSubmit={handleStep3} className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 mb-1">
                  Etapa 3 — Código de cortesia / Cupom de acesso
                </h2>
                <p className="text-xs text-zinc-600 mb-4 pb-3 border-b border-[#E5E5E5]">
                  Possui um código de desconto ou benefício especial de parceiro?
                </p>
              </div>

              <div className="p-4 border border-[#E5E5E5] rounded-lg bg-zinc-50/50">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={temCodigoCortesia}
                    onChange={(e) => {
                      setTemCodigoCortesia(e.target.checked);
                      if (!e.target.checked) {
                        setCodigoCortesia('');
                        setMsgCortesia(null);
                        setCortesiaAplicada(null);
                      }
                    }}
                    className="w-4 h-4 text-zinc-900 focus:ring-zinc-900 rounded border-zinc-300"
                  />
                  <span className="text-sm font-medium text-zinc-900">
                    Tenho um código cortesia
                  </span>
                </label>

                {temCodigoCortesia && (
                  <div className="mt-4 pt-4 border-t border-[#E5E5E5] space-y-3">
                    <label className="block text-xs font-medium text-zinc-700">
                      Digite o seu código de cortesia
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                        <Gift className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={codigoCortesia}
                        onChange={(e) => setCodigoCortesia(e.target.value.toUpperCase())}
                        placeholder="Ex: CORTESIA2026"
                        className="w-full pl-9 pr-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-sm text-zinc-900 uppercase tracking-wider focus:outline-none focus:border-zinc-900"
                      />
                    </div>
                  </div>
                )}
              </div>

              {msgCortesia && (
                <div
                  className={`p-3 rounded-lg text-xs font-medium ${
                    cortesiaAplicada
                      ? 'bg-green-50 border border-green-200 text-green-800'
                      : 'bg-red-50 border border-red-200 text-red-800'
                  }`}
                >
                  {msgCortesia}
                </div>
              )}

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="py-2 px-3 text-xs text-zinc-600 hover:text-zinc-900 flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="py-2.5 px-5 bg-[#F5D800] hover:bg-[#ebd000] text-zinc-950 font-semibold rounded-lg text-sm flex items-center gap-2 border border-[#d2b800] transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {loading ? 'Validando...' : 'Avançar para conclusão'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: CONFIRMAÇÃO / SUCESSO */}
          {step === 4 && (
            <div className="text-center py-4 space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50 text-green-600 border border-green-200 mb-2">
                <CheckCircle2 className="w-10 h-10 stroke-[1.75]" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-zinc-900">
                  Cadastro concluído com sucesso!
                </h2>
                <p className="mt-2 text-sm text-zinc-600 max-w-sm mx-auto">
                  Sua loja <span className="font-semibold text-zinc-900">{nomeEmpresa}</span> e a filial <span className="font-semibold text-zinc-900">{nomeFilial}</span> foram configuradas no sistema.
                </p>
              </div>

              <div className="p-4 bg-zinc-50 border border-[#E5E5E5] rounded-lg text-left text-xs space-y-2">
                <div className="flex justify-between border-b border-[#E5E5E5] pb-2">
                  <span className="text-zinc-500">Responsável:</span>
                  <span className="font-medium text-zinc-900">{nomeUsuario}</span>
                </div>
                <div className="flex justify-between border-b border-[#E5E5E5] pb-2">
                  <span className="text-zinc-500">Status da conta:</span>
                  <span className="font-semibold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded">
                    Trial de 7 dias ativo
                  </span>
                </div>
                {cortesiaAplicada && (
                  <div className="flex justify-between border-b border-[#E5E5E5] pb-2 text-green-700">
                    <span>Benefício cortesia:</span>
                    <span className="font-semibold">Ativado</span>
                  </div>
                )}
                <div className="flex justify-between pt-1">
                  <span className="text-zinc-500">Catálogo inicial:</span>
                  <span className="font-medium text-zinc-900">Modelos de produtos clonados</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleFinish}
                className="w-full py-3 px-6 bg-[#F5D800] hover:bg-[#ebd000] text-zinc-950 font-bold rounded-lg text-sm flex items-center justify-center gap-2 border border-[#d2b800] transition-colors shadow-xs cursor-pointer"
              >
                <span>Ir para o dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
