import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { Empresa, Filial, Usuario } from '../types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  usuarioProfile: Usuario | null;
  empresa: Empresa | null;
  filiais: Filial[];
  selectedFilial: Filial | null;
  loading: boolean;
  setSelectedFilial: (filial: Filial | null) => void;
  refreshUserData: () => Promise<void>;
  signOut: () => Promise<void>;
  hasAnonKey: boolean;
  saveAnonKey: (key: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [usuarioProfile, setUsuarioProfile] = useState<Usuario | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [selectedFilial, setSelectedFilial] = useState<Filial | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [hasAnonKey, setHasAnonKey] = useState<boolean>(true);

  const fetchUserProfileAndCompany = async (userId: string) => {
    try {
      // 1. Get user profile from 'usuarios' table
      const { data: userProfile, error: userErr } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (userErr) {
        console.warn('Erro ao carregar perfil do usuário:', userErr.message);
      }

      if (userProfile) {
        setUsuarioProfile(userProfile as Usuario);

        // 2. Get company details from 'empresas' table
        if (userProfile.empresa_id) {
          const { data: empData, error: empErr } = await supabase
            .from('empresas')
            .select('*')
            .eq('id', userProfile.empresa_id)
            .maybeSingle();

          if (!empErr && empData) {
            setEmpresa(empData as Empresa);
          }

          // 3. Get branches list from 'filiais' table
          const { data: filiaisData, error: filErr } = await supabase
            .from('filiais')
            .select('*')
            .eq('empresa_id', userProfile.empresa_id);

          if (!filErr && filiaisData && filiaisData.length > 0) {
            setFiliais(filiaisData as Filial[]);
            setSelectedFilial(prev => prev || filiaisData[0] as Filial);
          }
        }
      } else {
        setUsuarioProfile(null);
        setEmpresa(null);
        setFiliais([]);
        setSelectedFilial(null);
      }
    } catch (err) {
      console.error('Erro na sincronização do usuário com Supabase:', err);
    }
  };

  const refreshUserData = async () => {
    if (user?.id) {
      await fetchUserProfileAndCompany(user.id);
    }
  };

  useEffect(() => {
    // Check initial auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        fetchUserProfileAndCompany(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user?.id) {
          await fetchUserProfileAndCompany(session.user.id);
        } else {
          setUsuarioProfile(null);
          setEmpresa(null);
          setFiliais([]);
          setSelectedFilial(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setUsuarioProfile(null);
    setEmpresa(null);
    setFiliais([]);
    setSelectedFilial(null);
  };

  const saveAnonKey = (key: string) => {
    if (key) {
      localStorage.setItem('supabase_anon_key', key.trim());
      setHasAnonKey(true);
      window.location.reload();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        usuarioProfile,
        empresa,
        filiais,
        selectedFilial,
        loading,
        setSelectedFilial,
        refreshUserData,
        signOut,
        hasAnonKey,
        saveAnonKey,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
