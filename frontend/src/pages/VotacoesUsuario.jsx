// src/pages/VotacoesUsuario.jsx
import { useEffect, useState } from "react";
import { listarVotacoesElegiveis, votar } from "../services/votacoes";
import { CheckCircle, Send, MapPin } from "lucide-react";
import { toast } from "react-toastify";

export default function VotacoesUsuario() {
  const [lista, setLista] = useState([]);
  const [escolhas, setEscolhas] = useState({}); // { [votacaoId]: Set(opcaoIds) }
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    listarVotacoesElegiveis().then(setLista).catch(() => toast.error("Falha ao carregar votações."));
  }, []);

  function toggle(vId, oId, tipo, max) {
    setEscolhas((prev) => {
      const s = new Set(prev[vId] || []);
      if (tipo === "unica") {
        return { ...prev, [vId]: new Set([oId]) };
      }
      if (s.has(oId)) s.delete(oId); else {
        if (s.size >= max) return prev;
        s.add(oId);
      }
      return { ...prev, [vId]: s };
    });
  }

  function pedirLocal() {
    if (!navigator.geolocation) return toast.error("Seu navegador não suporta geolocalização.");
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => toast.error("Não foi possível obter sua localização.")
    );
  }

  async function enviar(v) {
    const set = escolhas[v.id] || new Set();
    if (set.size === 0) return toast.warn("Selecione ao menos uma opção.");
    const payload = { opcoes: [...set] };
    if (coords) Object.assign(payload, { cliLat: coords.lat, cliLng: coords.lng });
    try {
      await votar(v.id, payload);
      toast.success("Voto registrado!");
      setLista((prev) => prev.filter((x) => x.id !== v.id)); // some da lista
    } catch (e) {
      toast.error(e?.response?.data?.erro || "Falha ao enviar voto.");
    }
  }

  if (!lista.length) {
    return (
      <main className="p-4">
        <div className="text-center text-sm opacity-75">Nenhuma votação disponível para você agora.</div>
      </main>
    );
  }

  return (
    <main className="p-4 space-y-4">
      {lista.map((v) => {
        const set = escolhas[v.id] || new Set();
        const precisaLocal = !!(v.geo_lat && v.geo_lng && v.geo_raio_m);
        return (
          <section key={v.id} className="rounded-2xl shadow p-4 bg-white">
            <header className="mb-3">
              <h2 className="text-lg font-semibold">{v.titulo}</h2>
              {v.descricao && <p className="text-sm opacity-80">{v.descricao}</p>}
            </header>

            <ul className="space-y-2">
              {(v.opcoes || []).map((o) => (
                <li key={o.id}>
                  <button
                    onClick={() => toggle(v.id, o.id, v.tipo_selecao, v.max_escolhas)}
                    className={`w-full flex items-center justify-between rounded-xl border px-3 py-2 ${set.has(o.id) ? "border-emerald-600" : "border-zinc-200"}`}
                    aria-pressed={set.has(o.id)}
                  >
                    <span>{o.titulo}</span>
                    {set.has(o.id) && <CheckCircle className="w-5 h-5" aria-hidden />}
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center gap-2">
              {precisaLocal && (
                <button onClick={pedirLocal} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 border">
                  <MapPin className="w-4 h-4" /> Usar minha localização
                </button>
              )}
              <button onClick={() => enviar(v)} className="ml-auto inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-emerald-600 text-white">
                <Send className="w-4 h-4" /> Enviar voto
              </button>
            </div>

            {/* Dica de seleção */}
            <p className="mt-2 text-xs opacity-70">
              {v.tipo_selecao === "unica"
                ? "Escolha 1 opção."
                : `Escolha até ${v.max_escolhas} opção(ões).`}
            </p>
          </section>
        );
      })}
    </main>
  );
}
