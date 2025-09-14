// 📁 src/components/Footer.jsx
import { Mail, Phone, MapPin } from "lucide-react";

export default function Footer() {
  return (
    <footer
      className="bg-emerald-900 text-white mt-10"
      role="contentinfo"
      aria-label="Rodapé institucional"
    >
      <div className="max-w-7xl mx-auto px-6 py-8 grid gap-8 sm:grid-cols-2">
        {/* Logo e Instituição */}
        <div>
          <h2 className="text-lg font-bold">
            Escola Municipal de Saúde Pública
          </h2>
          <address className="not-italic text-sm mt-2 leading-relaxed">
            Rua Amador Bueno, 333 – 4º andar – Sala 401 <br />
            Centro, Santos – SP, 11013-151
          </address>
        </div>

        {/* Contatos */}
        <div className="space-y-3 text-sm">
          <p className="flex items-center gap-2">
            <Phone size={18} aria-hidden="true" />
            <a
              href="tel:+551332015000"
              className="hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded-sm"
            >
              (13) 3201-5000 R. 5331
            </a>
          </p>

          <p className="flex items-center gap-2">
            <Mail size={18} aria-hidden="true" />
            <a
              href="mailto:escoladasaude@santos.sp.gov.br"
              className="hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded-sm break-all"
            >
              escoladasaude@santos.sp.gov.br
            </a>
          </p>

          <p className="flex items-center gap-2">
            <MapPin size={18} aria-hidden="true" />
            <span>Santos/SP</span>
          </p>
        </div>
      </div>

      <div className="bg-emerald-800 text-center text-xs py-3 px-2">
        © {new Date().getFullYear()} Escola da Saúde – Secretaria Municipal de Saúde – Prefeitura de Santos
      </div>
    </footer>
  );
}
