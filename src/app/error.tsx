"use client";

export default function ErrorPage({ reset }: { reset: () => void }) { return <div className="empty-state" role="alert"><h1>Necesitamos un pequeño respiro</h1><p>No se pudo mostrar esta página. Puedes intentarlo de nuevo; no se borrará el progreso guardado.</p><button className="button button-primary" onClick={reset}>Intentar de nuevo</button></div>; }
