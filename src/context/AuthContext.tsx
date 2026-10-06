import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ID, OAuthProvider, account } from "../lib/appwrite";
import type { Models } from "../lib/appwrite";
import { SinCoberturaError } from "../lib/cobertura";
import { olvidarCopiaLocal } from "../api/armies";
import { accessStateFor, isAdmin, isEditor } from "../api/access";
import type { AccessState } from "../api/access";

type User = Models.User<Models.Preferences>;

interface AuthValue {
  user: User | null;
  access: AccessState;
  admin: boolean;
  /** Corrige el contenido transcrito a mano: las cartas de mision. */
  editor: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => void;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

const USUARIO_KEY = "warhost:usuario";

function leerUsuario(): User | null {
  try {
    return JSON.parse(window.localStorage.getItem(USUARIO_KEY) ?? "null") as User | null;
  } catch {
    return null;
  }
}

function guardarUsuario(user: User | null) {
  try {
    if (user) window.localStorage.setItem(USUARIO_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(USUARIO_KEY);
  } catch {
    // Almacenamiento bloqueado: sin cobertura habra que volver a entrar.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const actual = await account.get();
      setUser(actual);
      guardarUsuario(actual);
    } catch (err) {
      // Sin cobertura no se sabe si la sesion sigue viva: se da por buena la
      // ultima conocida para poder consultar la copia local.
      setUser(err instanceof SinCoberturaError ? leerUsuario() : null);
      if (!(err instanceof SinCoberturaError)) guardarUsuario(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      await account.createEmailPasswordSession({ email, password });
      await refresh();
    },
    [refresh],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      await account.create({ userId: ID.unique(), email, password, name });
      await account.createEmailPasswordSession({ email, password });
      // El correo de verificacion dispara la funcion que encola la solicitud de acceso.
      await account.createEmailVerification({ url: `${window.location.origin}/verify` });
      await refresh();
    },
    [refresh],
  );

  const loginWithGoogle = useCallback(() => {
    account.createOAuth2Session({
      provider: OAuthProvider.Google,
      success: `${window.location.origin}/`,
      failure: `${window.location.origin}/login?error=oauth`,
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await account.deleteSession({ sessionId: "current" });
    } finally {
      setUser(null);
      guardarUsuario(null);
      olvidarCopiaLocal();
    }
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      access: accessStateFor(user),
      admin: isAdmin(user),
      editor: isEditor(user),
      loading,
      refresh,
      login,
      loginWithGoogle,
      register,
      logout,
    }),
    [user, loading, refresh, login, loginWithGoogle, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return value;
}
