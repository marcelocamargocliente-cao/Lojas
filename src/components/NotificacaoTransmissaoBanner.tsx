import React, { useState, useEffect } from 'react';
import { Megaphone, Check, X, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { ChatMensagem } from '../types';
import { useAuth } from '../context/AuthContext';

export const NotificacaoTransmissaoBanner: React.FC = () => {
  const { usuarioProfile, empresa, selectedFilial } = useAuth();
  const [transmissoesPendentes, setTransmissoesPendentes] = useState<ChatMensagem[]>([]);

  useEffect(() => {
    if (!usuarioProfile) return;
    fetchTransmissoes();

    // Subscribe to real-time chat_mensagens for new transmissions
    const channel = supabase
      .channel('chat_transmissoes_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_mensagens',
          filter: `tipo=eq.transmissao`,
        },
        () => {
          fetchTransmissoes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [usuarioProfile, empresa, selectedFilial]);

  const fetchTransmissoes = async () => {
    if (!usuarioProfile) return;

    try {
      // 1. Fetch transmissions for company/branch
      let query = supabase
        .from('chat_mensagens')
        .select('*, remetente:usuarios(*)')
        .eq('tipo', 'transmissao')
        .eq('deletado', false)
        .order('created_at', { ascending: false })
        .limit(5);

      if (empresa?.id) {
        query = query.eq('empresa_id', empresa.id);
      }

      const { data: rawMsgs } = await query;
      if (!rawMsgs || rawMsgs.length === 0) {
        setTransmissoesPendentes([]);
        return;
      }

      // 2. Filter out messages already read by current user in chat_leituras
      const msgIds = rawMsgs.map((m) => m.id);
      const { data: leituras } = await supabase
        .from('chat_leituras')
        .select('mensagem_id')
        .eq('usuario_id', usuarioProfile.id)
        .in('mensagem_id', msgIds);

      const lidosSet = new Set(leituras?.map((l) => l.mensagem_id));

      const unread = rawMsgs.filter((m) => !lidosSet.has(m.id));
      setTransmissoesPendentes(unread);
    } catch (err) {
      console.warn('Erro ao carregar transmissoes pendentes:', err);
    }
  };

  const handleMarcarLido = async (mensagemId: string) => {
    if (!usuarioProfile) return;

    // Optimistically remove from state
    setTransmissoesPendentes((prev) => prev.filter((m) => m.id !== mensagemId));

    try {
      await supabase.from('chat_leituras').insert([
        {
          mensagem_id: mensagemId,
          usuario_id: usuarioProfile.id,
          lido_em: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      console.error('Erro ao marcar aviso como lido:', err);
    }
  };

  if (transmissoesPendentes.length === 0) return null;

  const currentBroadcast = transmissoesPendentes[0];

  return (
    <div className="bg-[#FFF9E0] border border-[#F5D800] text-zinc-900 rounded-xl p-3.5 shadow-xs mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#F5D800] text-zinc-950 flex items-center justify-center font-bold shrink-0 border border-[#d2b800] mt-0.5">
          <Megaphone className="w-5 h-5 stroke-[2.2]" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-xs uppercase bg-zinc-900 text-white px-2 py-0.5 rounded text-[10px] tracking-wide">
              Aviso da Gerência
            </span>
            <span className="text-[11px] text-zinc-600 font-medium">
              Por: {currentBroadcast.remetente?.nome || 'Administração'} ({currentBroadcast.escopo_transmissao === 'empresa' ? 'Toda a Empresa' : 'Sua Filial'})
            </span>
          </div>
          <p className="text-xs font-semibold text-zinc-950 mt-1 whitespace-pre-wrap">
            {currentBroadcast.conteudo}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => handleMarcarLido(currentBroadcast.id)}
        className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
      >
        <Check className="w-4 h-4 text-[#F5D800]" />
        <span>Estou Ciente</span>
      </button>
    </div>
  );
};
