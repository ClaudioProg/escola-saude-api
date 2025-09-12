// 📁 src/components/Footer.jsx
import { Mail, Phone, MapPin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-green-900 text-white mt-10">
      <div className="max-w-7xl mx-auto px-6 py-8 grid md:grid-cols-2 gap-6">
        {/* Logo e Instituição */}
        <div>
          <h2 className="text-lg font-bold">Escola Municipal de Saúde Pública</h2>
          <p className="text-sm mt-2">
            Rua Amador Bueno, 333 - 4º andar - Sala 401 <br />
            Centro, Santos - SP, 11013-151
          </p>
        </div>

        {/* Contatos */}
        <div className="space-y-2">
          <p className="flex items-center gap-2">
            <Phone size={18} /> (13) 3201-5000 R. 5331
          </p>
          <p className="flex items-center gap-2">
            <Mail size={18} /> escoladasaude@santos.sp.gov.br
          </p>
          <p className="flex items-center gap-2">
            <MapPin size={18} /> Santos/SP
          </p>
        </div>
      </div>

      <div className="bg-green-800 text-center text-xs py-2">
        © {new Date().getFullYear()} Escola da Saúde - Secretaria Municipal de Saúde - Prefeitura de Santos
      </div>
    </footer>
  );
}
