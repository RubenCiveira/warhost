import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { account } from "../lib/appwrite";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../lib/format";
import { ErrorBanner, Spinner } from "../components/ui";

/**
 * Vuelta del login con Google: ?userId=...&secret=...
 * Canjear el token desde la app guarda la sesion aunque el navegador bloquee
 * las cookies de terceros del endpoint de Appwrite.
 */
export default function OAuth() {
  const [params] = useSearchParams();
  const { refresh } = useAuth();
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const userId = params.get("userId");
    const secret = params.get("secret");
    if (!userId || !secret) {
      setState("error");
      setError("La respuesta de Google esta incompleta.");
      return;
    }
    // StrictMode monta dos veces en desarrollo y el secreto es de un solo uso.
    if (started.current) return;
    started.current = true;

    void (async () => {
      try {
        await account.createSession({ userId, secret });
        await refresh();
        setState("done");
      } catch (err) {
        setState("error");
        setError(errorMessage(err));
      }
    })();
  }, [params, refresh]);

  if (state === "done") return <Navigate to="/" replace />;

  return (
    <div className="center-screen">
      <div className="card">
        <h1>Acceso con Google</h1>
        {state === "working" ? <Spinner /> : null}
        {state === "error" ? (
          <>
            <ErrorBanner error={error} />
            <Link to="/login">Volver</Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
