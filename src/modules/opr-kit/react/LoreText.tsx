import { lazy, Suspense } from "react";

// El markdown pesa mas que el resto de la tarjeta y solo lo usa el trasfondo:
// se descarga aparte y, mientras, se ve el texto tal cual.
const ReactMarkdown = lazy(() => import("react-markdown"));

export default function LoreText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={["lore-markdown", className].filter(Boolean).join(" ")}>
      <Suspense fallback={<p>{text}</p>}>
        <ReactMarkdown>{text}</ReactMarkdown>
      </Suspense>
    </div>
  );
}
