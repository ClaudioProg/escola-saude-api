// 📁 src/pages/QrDoSite.jsx
import QrSiteEscola from "../components/QrSiteEscola";
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";
import { QrCode } from "lucide-react";

export default function QrDoSite() {
  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-neutral-900">
      {/* 🟧 Cabeçalho (família QR/Presença) */}
      <PageHeader title="QR do Site" icon={QrCode} variant="laranja" />

      <main role="main" className="flex-1">
        <section className="max-w-3xl mx-auto px-6 py-8 text-center">
          <h1 className="sr-only">QR Code oficial do site da Escola</h1>

          <div
            className="mx-auto max-w-fit bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-sm p-6"
            role="region"
            aria-label="Código QR do site"
          >
            {/* QR puro – mais seguro */}
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Aponte a câmera do celular para acessar o site oficial da Escola.
            </p>
            <div className="mx-auto">
              <QrSiteEscola size={512} showLogo={false} />
            </div>
          </div>

          {/* Se quiser testar com logo pequeno (≤ 18%) */}
          {/*
          <h2 className="text-lg font-semibold mt-10 mb-3 text-lousa dark:text-white">
            Com logo pequeno
          </h2>
          <div className="mx-auto max-w-fit bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-sm p-6">
            <QrSiteEscola size={512} showLogo logoUrl="/logo-escola.png" logoPct={0.16} />
          </div>
          */}
        </section>
      </main>

      {/* Rodapé institucional */}
      <Footer />
    </div>
  );
}
