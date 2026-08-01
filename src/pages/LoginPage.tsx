import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Eye, EyeOff, KeyRound, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modalForgot, setModalForgot] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!email || !senha) {
      setErro('Por favor, informe e-mail e senha');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErro('E-mail ou senha incorretos');
        } else {
          setErro(error.message);
        }
        setLoading(false);
        return;
      }

      if (data.session) {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setErro(err?.message || 'Ocorreu um erro ao realizar login');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErro('Digite seu e-mail no campo acima para solicitar a redefinição de senha');
      setModalForgot(false);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) {
        alert(`Erro ao solicitar redefinição: ${error.message}`);
      } else {
        setResetEmailSent(true);
      }
    } catch (err: any) {
      alert(`Erro: ${err?.message || 'Falha ao redefinir senha'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-[#F5D800] text-black mb-4 shadow-sm border border-[#E5E5E5]">
            <Building2 className="w-7 h-7 stroke-[1.75]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            SaaS Gestão de Materiais de Construção
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Painel corporativo de gestão para lojas de material de construção
          </p>
        </div>

        {/* Login Card */}
        <div className="industrial-card p-8">
          <h2 className="text-lg font-semibold text-zinc-900 mb-6 pb-3 border-b border-[#E5E5E5]">
            Entrar no sistema
          </h2>

          {erro && (
            <div className="mb-6 p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-800 text-sm">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>{erro}</div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-1.5">
                E-mail corporativo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com.br"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="senha" className="block text-sm font-medium text-zinc-700">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => setModalForgot(true)}
                  className="text-xs text-zinc-600 hover:text-zinc-900 underline underline-offset-2 transition-colors"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2 bg-white border border-[#E5E5E5] rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600"
                >
                  {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#F5D800] hover:bg-[#ebd000] text-zinc-950 font-semibold rounded-lg text-sm flex items-center justify-center gap-2 border border-[#d2b800] transition-colors disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <span>Entrando...</span>
              ) : (
                <>
                  <span>Entrar</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[#E5E5E5] text-center">
            <p className="text-sm text-zinc-600">
              Sua loja ainda não usa o sistema?{' '}
              <Link
                to="/cadastro"
                className="font-medium text-zinc-900 hover:underline transition-all ml-1"
              >
                Criar conta
              </Link>
            </p>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-xs text-zinc-500">
          Acesso seguro com isolamento por empresa via RLS.
        </div>
      </div>

      {/* Forgot Password Modal */}
      {modalForgot && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="industrial-card p-6 max-w-sm w-full bg-white">
            <h3 className="text-base font-semibold text-zinc-900 mb-2">
              Recuperar senha
            </h3>
            <p className="text-xs text-zinc-600 mb-4">
              Informe seu e-mail cadastrado. Enviaremos um link de redefinição de acesso.
            </p>

            {resetEmailSent ? (
              <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-lg mb-4">
                E-mail de redefinição enviado com sucesso! Verifique sua caixa de entrada.
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com.br"
                    className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setModalForgot(false);
                      setResetEmailSent(false);
                    }}
                    className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-3 py-1.5 bg-[#F5D800] text-zinc-950 font-medium text-xs rounded-lg hover:bg-[#ebd000] border border-[#d2b800]"
                  >
                    {loading ? 'Enviando...' : 'Enviar link'}
                  </button>
                </div>
              </form>
            )}

            {resetEmailSent && (
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalForgot(false);
                    setResetEmailSent(false);
                  }}
                  className="px-3 py-1.5 bg-zinc-900 text-white text-xs rounded-lg"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
