// 📁 src/pages/QRCodesEventosAdmin.jsx
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import Breadcrumbs from "../components/Breadcrumbs";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import NadaEncontrado from "../components/NadaEncontrado";
import { apiGet } from "../services/api"; // ✅ centralizado
import { gerarQrCodePresencaPDF } from "../utils/gerarQrCodePresencaPDF.jsx";

// Cabeçalho compacto + rodapé institucional
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";
import { QrCode } from "lucide-react";

export default function QRCodesEventosAdmin() {
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [eventos, setEventos] = useState([]); // [{...evento, turmas: []}]
  const [erro, setErro] = useState("");

  useEffect(() => {
    (async () => {
      setCarregandoDados(true);
      try {
        // 1) Carrega eventos
        const listaEventos = await apiGet("/api/eventos", { on403: "silent" });
        const eventosArr = Array.isArray(listaEventos) ? listaEventos : [];

        // 2) Carrega turmas por evento em paralelo
        const withTurmas = await Promise.all(
          eventosArr.map(async (ev) => {
            try {
              const turmas = await apiGet(`/api/turmas/evento/${ev.id}`, { on403: "silent" });
              return { ...ev, turmas: Array.isArray(turmas) ? turmas : [] };
            } catch {
              return { ...ev, turmas: [] };
            }
          })
        );

        setEventos(withTurmas);
        setErro("");
      } catch (e) {
        console.error(e);
        setErro("Erro ao carregar eventos/turmas");
        toast.error("❌ Erro ao carregar eventos/turmas.");
      } finally {
        setCarregandoDados(false);
      }
    })();
  }, []);

  const vazio = useMemo(
    () => !carregandoDados && (!eventos.length || eventos.every((e) => !e.turmas?.length)),
    [carregandoDados, eventos]
  );

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      {/* 🟧 Cabeçalho (família QR/Presença) */}
      <PageHeader title="QR Codes de Presença por Turma" icon={QrCode} variant="laranja" />

      <main role="main" className="flex-1 px-4 py-6 max-w-5xl mx-auto">
        <Breadcrumbs trilha={[{ label: "Painel administrador" }, { label: "QR Codes de Presença" }]} />

        {carregandoDados ? (
          <CarregandoSkeleton linhas={4} />
        ) : erro ? (
          <p className="text-red-600 dark:text-red-400 text-center" role="alert">{erro}</p>
        ) : vazio ? (
          <NadaEncontrado mensagem="Nenhum evento com turmas encontrado." />
        ) : (
          <section className="space-y-6" aria-label="Lista de eventos e turmas">
            {eventos.map((ev) => (
              <div key={ev.id} className="bg-white dark:bg-zinc-800 rounded-xl shadow p-4">
                <h3 className="text-lg font-semibold text-lousa dark:text-white">
                  {ev.titulo || ev.nome || `Evento #${ev.id}`}
                </h3>

                {!ev.turmas?.length ? (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                    Nenhuma turma cadastrada para este evento.
                  </p>
                ) : (
                  <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {ev.turmas.map((t) => {
                      // tenta pegar instrutores do evento ou da turma
                      const nomesInstrutores =
                        (Array.isArray(ev?.instrutor) && ev.instrutor.length
                          ? ev.instrutor.map((i) => i?.nome).filter(Boolean)
                          : Array.isArray(t?.instrutor)
                          ? t.instrutor.map((i) => i?.nome).filter(Boolean)
                          : []
                        ).join(", ") || "Instrutor";

                      return (
                        <li
                          key={t.id}
                          className="border rounded-lg p-3 flex items-center justify-between gap-3 dark:border-zinc-700"
                        >
                          <div>
                            <p className="font-medium text-gray-800 dark:text-gray-100">
                              {t.nome || `Turma #${t.id}`}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-300">
                              {nomesInstrutores}
                            </p>
                          </div>

                          <button
                            onClick={() =>
                              gerarQrCodePresencaPDF(
                                t,
                                ev.titulo || ev.nome || "Evento",
                                nomesInstrutores
                              )
                            }
                            className="bg-lousa hover:bg-green-800 text-white text-sm font-semibold px-3 py-1.5 rounded transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-700"
                            aria-label={`Gerar PDF de QR Code da turma ${t.nome || t.id}`}
                          >
                            Gerar PDF
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </section>
        )}
      </main>

      {/* Rodapé institucional */}
      <Footer />
    </div>
  );
}
