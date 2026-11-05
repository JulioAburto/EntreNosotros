import Link from "next/link";
export default function NotFound() { return <div className="empty-state"><h1>Volvamos a encontrarnos</h1><p>Esta página no existe, pero nuestra historia sigue aquí.</p><Link className="button button-primary" href="/">Volver al inicio</Link></div>; }
