import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useCobertura } from "../lib/cobertura";
import { EmptyState } from "./ui";

/** Para las vistas que solo tienen sentido contra el servidor: sin cobertura ni se intentan. */
export default function RequiereCobertura({ children }: { children: ReactNode }) {
  if (useCobertura()) return <>{children}</>;
  return (
    <EmptyState title="No disponible sin cobertura">
      <p className="muted">
        Esta seccion necesita conexion. Tus <Link to="/ejercitos">ejercitos</Link> siguen disponibles para consultarlos.
      </p>
    </EmptyState>
  );
}
