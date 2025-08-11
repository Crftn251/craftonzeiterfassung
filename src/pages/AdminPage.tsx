import { useEffect } from "react";

export default function AdminPage() {
  useEffect(() => {
    document.title = 'Admin – Crafton Time';
    const meta = document.querySelector('meta[name=\"description\"]');
    if (meta) meta.setAttribute('content', 'Verwaltung von Nutzern, Filialen, Tätigkeiten. Korrekturen & Freigaben.');
  }, []);

  return (
    <>
      <h1 className="sr-only">Admin – Crafton Time</h1>
      <section className="rounded-2xl border bg-card p-6">
        <h2 className="text-xl font-semibold mb-2">Admin</h2>
        <p className="text-muted-foreground">Rollenbasiert. Inhalte folgen nach Anbindung an Backend.</p>
      </section>
    </>
  );
}
