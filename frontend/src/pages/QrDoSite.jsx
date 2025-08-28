// 📁 src/pages/QrDoSite.jsx
import QrSiteEscola from "../components/QrSiteEscola";

export default function QrDoSite() {
  return (
    <main className="p-6">
      {/* QR puro (sem logo) – mais seguro */}
      <h1 className="text-xl font-semibold mb-3">QR do site (sem logo)</h1>
      <QrSiteEscola size={512} showLogo={false} />

      {/* Se quiser testar com logo pequeno (≤ 18%) */}
      {/* <h2 className="text-xl font-semibold mt-10 mb-3">Com logo pequeno</h2>
      <QrSiteEscola size={512} showLogo logoUrl="/logo-escola.png" logoPct={0.16} /> */}
    </main>
  );
}
