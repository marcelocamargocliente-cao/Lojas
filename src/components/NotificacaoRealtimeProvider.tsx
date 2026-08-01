import React, { createContext, useContext, useEffect, useState } from 'react';
import { Bell, X, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { NotificacaoRealtime } from '../types';

interface NotificacaoRealtimeContextType {
  notificacoes: NotificacaoRealtime[];
  fecharNotificacao: (id: string) => void;
}

const NotificacaoRealtimeContext = createContext<NotificacaoRealtimeContextType>({
  notificacoes: [],
  fecharNotificacao: () => {},
});

export const useNotificacaoRealtime = () => useContext(NotificacaoRealtimeContext);

export const NotificacaoRealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { empresa } = useAuth();
  const [notificacoes, setNotificacoes] = useState<NotificacaoRealtime[]>([]);

  useEffect(() => {
    if (!empresa?.id) return;

    // Fetch initial unread notifications
    async function loadNotificacoes() {
      const { data } = await supabase
        .from('notificacoes_realtime')
        .select('*')
        .eq('empresa_id', empresa.id)
        .eq('lida', false)
        .order('created_at', { ascending: false })
        .limit(5);

      if (data) {
        setNotificacoes(data as NotificacaoRealtime[]);
      }
    }

    loadNotificacoes();

    // Subscribe to Supabase Realtime changes
    const channel = supabase
      .channel('notificacoes_realtime_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificacoes_realtime',
          filter: `empresa_id=eq.${empresa.id}`,
        },
        (payload) => {
          const newNotif = payload.new as NotificacaoRealtime;
          setNotificacoes((prev) => [newNotif, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [empresa?.id]);

  const fecharNotificacao = async (id: string) => {
    setNotificacoes((prev) => prev.filter((n) => n.id !== id));
    try {
      await supabase.from('notificacoes_realtime').update({ lida: true }).eq('id', id);
    } catch (e) {
      console.warn('Erro ao marcar notificacao como lida:', e);
    }
  };

  return (
    <NotificacaoRealtimeContext.Provider value={{ notificacoes, fecharNotificacao }}>
      {children}

      {/* Floating Toast Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {notificacoes.map((n) => (
          <div
            key={n.id}
            className="pointer-events-auto bg-zinc-900 text-white border border-zinc-800 p-3.5 rounded-lg shadow-xl flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded bg-[#F5D800] text-zinc-950 flex items-center justify-center font-bold shrink-0 mt-0.5">
                <Bell className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#F5D800] uppercase tracking-wider block">
                  Notificação do Sistema
                </span>
                <p className="text-xs text-zinc-200 leading-snug font-medium mt-0.5">
                  {n.mensagem}
                </p>
                {n.created_at && (
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    {new Date(n.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => fecharNotificacao(n.id)}
              className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </NotificacaoRealtimeContext.Provider>
  );
};
