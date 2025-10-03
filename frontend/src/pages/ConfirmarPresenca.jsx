// frontend/src/pages/AdminChamadaForm.jsx
import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Settings2, Save, ArrowLeft, Plus, Trash2 } from "lucide-react";
import Footer from "../components/Footer";
import { datetimeLocalToBrWall, wallToDatetimeLocal } from "../utils/data";

// ✅ use o cliente central da app
import { apiGet, apiPost, apiPut } from "../services/api";

/* small utils */
const pad2 = (n) => String(n).padStart(2, "0");
const nowLocalDatetimeLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

// gera CÓDIGO a partir do Nome (compat c/ backend)
const toCodigo = (s) =>
  (s || "")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 30) || "LINHA";

/* UI helpers */
const Card = ({ children }) => (
  <div className="rounded-2xl border bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">{children}</div>
);
const Field = ({ label, hint, error, children }) => (
  <div className="mb-4">
    {label && <label className="mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-100">{label}</label>}
    {children}
    {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
  </div>
);
const Counter = ({ value, max }) => {
  const len = (value || "").length;
  const over = max ? len > max : false;
  return <span className={`text-xs ${over ? "text-red-600" : "text-zinc-500"}`}>{len}{max ? `/${max}` : ""}</span>;
};

/* HeaderHero */
function HeaderHero({ title, subtitle, accent = "indigo" }) {
  const accents = {
    indigo: "bg-indigo-600 dark:bg-indigo-700",
    emerald: "bg-emerald-600 dark:bg-emerald-700",
    sky: "bg-sky-600 dark:bg-sky-700",
    violet: "bg-violet-600 dark:bg-violet-700",
    amber: "bg-amber-600 dark:bg-amber-700",
    rose: "bg-rose-600 dark:bg-rose-700",
  };
  const bar = accents[accent] || accents.indigo;
  return (
    <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className={`w-full ${bar} text-white`}>
      <div className="mx-auto max-w-screen-xl px-4 py-6 text-center sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3">
          <Settings2 className="h-10 w-10" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm leading-5 opacity-90 sm:text-base">{subtitle}</p> : null}
          </div>
        </div>
      </div>
    </motion.header>
  );
}

/* Página principal */
export default function AdminChamadaForm({ chamadaId }) {
  const isEdit = !!chamadaId;

  const [form, setForm] = useState({
    titulo: "",
    descricao_markdown: "", // texto geral de normas
    periodo_experiencia_inicio: "2023-01",
    periodo_experiencia_fim: "2025-07",
    prazo_final_br: nowLocalDatetimeLocal(),
    aceita_poster: true,
    link_modelo_poster: "",
    max_coautores: 10,
    publicado: false,
    linhas: [],               // [{nome, descricao}]
    criterios: [],            // escrita
    criterios_orais: [],      // oral
    limites: {
      titulo: 100,
      introducao: 2000,
      objetivos: 1000,
      metodo: 1500,
      resultados: 1500,
      consideracoes: 1000,
    },
    // campos livres
    criterios_outros: "",          // item 5
    oral_outros: "",               // item 6
    premiacao_texto: "",           // item 7
    disposicoes_finais_texto: "",  // item 9
  });

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");
  const abortRef = useRef(null);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        setLoading(true);
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();

        // ✅ usa cliente central (sem /api fixo)
        const r = await apiGet(`chamadas/${chamadaId}`, { signal: abortRef.current.signal });
        const c = r?.chamada || {};

        setForm((prev) => ({
          ...prev,
          titulo: c.titulo || "",
          descricao_markdown: c.descricao_markdown || "",
          periodo_experiencia_inicio: c.periodo_experiencia_inicio || "2023-01",
          periodo_experiencia_fim: c.periodo_experiencia_fim || "2025-07",
          prazo_final_br: wallToDatetimeLocal(c.prazo_final_br || "") || nowLocalDatetimeLocal(),
          aceita_poster: !!c.aceita_poster,
          link_modelo_poster: c.link_modelo_poster || "",
          max_coautores: Number(c.max_coautores) || 10,
          publicado: !!c.publicado,
          linhas: (r?.linhas || []).map((l) => ({ nome: l.nome || "", descricao: l.descricao || "" })), // UI simples
          criterios: r?.criterios || [],
          criterios_orais: r?.criterios_orais || [],
          limites: {
            titulo: r?.limites?.titulo ?? 100,
            introducao: r?.limites?.introducao ?? 2000,
            objetivos: r?.limites?.objetivos ?? 1000,
            metodo: r?.limites?.metodo ?? 1500,
            resultados: r?.limites?.resultados ?? 1500,
            consideracoes: r?.limites?.consideracoes ?? 1000,
          },
          criterios_outros: r?.criterios_outros || "",
          oral_outros: r?.oral_outros || "",
          premiacao_texto: r?.premiacao_texto || "",
          disposicoes_finais_texto: r?.disposicoes_finais_texto || "",
        }));
      } catch (e) {
        setErr(e?.message || "Falha ao carregar a chamada para edição.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, chamadaId]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const updateLim = (k, v) => setForm((f) => ({ ...f, limites: { ...f.limites, [k]: v } }));

  const validar = () => {
    const { periodo_experiencia_inicio: ini, periodo_experiencia_fim: fim, limites } = form;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ini) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(fim)) return "Períodos devem estar no formato AAAA-MM.";
    if (ini > fim) return "Período inicial não pode ser maior que o final.";
    for (const [k, v] of Object.entries(limites)) {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 50 || n > 20000) return `Limite inválido para ${k}: use um número inteiro entre 50 e 20000.`;
    }
    return "";
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setOk(""); setErr("");
    const ver = validar();
    if (ver) { setErr(ver); return; }

    setSaving(true);
    try {
      const payload = {
        ...form,
        prazo_final_br: datetimeLocalToBrWall(form.prazo_final_br),
        max_coautores: Number(form.max_coautores) || 0,
        // 👇 compat: backend pode esperar {codigo, nome, descricao}
        linhas: (form.linhas || []).map((l) => ({
          codigo: toCodigo(l.nome),
          nome: l.nome || "",
          descricao: l.descricao || "",
        })),
      };

      if (isEdit) {
        await apiPut(`admin/chamadas/${chamadaId}`, payload);
        setOk("Chamada atualizada com sucesso.");
      } else {
        const r = await apiPost("admin/chamadas", payload);
        setOk("Chamada criada com sucesso.");
        if (r?.id) window.location.hash = `#/admin/chamadas/${r.id}`;
      }
    } catch (e) {
      setErr(e?.message || "Erro ao salvar a chamada. Revise os campos.");
    } finally {
      setSaving(false);
    }
  };

  const inputBase = "w-full rounded-xl border px-3 py-2 ring-offset-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800";
  const btnPrimary = "inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:disabled:bg-zinc-700";
  const btnGhost = "inline-flex items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50 dark:text-indigo-200 dark:hover:bg-indigo-900/30";
  const chip = "inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
  const sectionTitle = "mb-2 text-base font-semibold";

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">Carregando chamada…</div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <HeaderHero title={isEdit ? "Editar Chamada" : "Nova Chamada"} subtitle="Dividida em partes do edital para facilitar a edição." accent="indigo" />

      <main className="mx-auto w-full max-w-screen-xl p-4 sm:px-6 lg:px-8">
        {/* Ações rápidas */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <a href="#/admin/chamadas" className={btnGhost}><ArrowLeft className="h-4 w-4" /> Voltar</a>
          {form.publicado ? <span className={chip}>Publicado</span> : <span className={chip}>Rascunho</span>}
        </div>

        <Card>
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-8">

            {/* 1) Informações Gerais */}
            <section id="s1" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <h2 className={`sm:col-span-3 ${sectionTitle}`}>1) Informações Gerais</h2>

              <div className="sm:col-span-3">
                <Field label={<span>Título da chamada <Counter value={form.titulo} max={200} /></span>}>
                  <input
                    className={`${inputBase} text-lg sm:text-xl`}
                    value={form.titulo}
                    onChange={(e) => update("titulo", e.target.value)}
                    maxLength={200}
                    required
                    aria-required="true"
                  />
                </Field>
              </div>

              {/* períodos — mesma linha */}
              <Field label="Período da experiência — início (AAAA-MM)">
                <input
                  type="month"
                  className={inputBase}
                  value={form.periodo_experiencia_inicio}
                  onChange={(e) => update("periodo_experiencia_inicio", e.target.value)}
                  required
                  aria-required="true"
                />
              </Field>
              <Field label="Período da experiência — fim (AAAA-MM)">
                <input
                  type="month"
                  className={inputBase}
                  value={form.periodo_experiencia_fim}
                  onChange={(e) => update("periodo_experiencia_fim", e.target.value)}
                  required
                  aria-required="true"
                />
              </Field>
            </section>

            {/* 2) Prazo para submissão */}
            <section id="s2" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <h2 className={`sm:col-span-2 ${sectionTitle}`}>2) Prazo para submissão</h2>
              <Field label="Prazo final (Brasília)">
                <input
                  type="datetime-local"
                  className={inputBase}
                  value={form.prazo_final_br}
                  onChange={(e) => update("prazo_final_br", e.target.value)}
                  required
                  aria-required="true"
                />
              </Field>
            </section>

            {/* 3) Normas para submissão dos trabalhos */}
            <section id="s3" className="grid grid-cols-1 gap-4">
              <h2 className={sectionTitle}>3) Normas para submissão dos trabalhos</h2>

              {/* Linhas temáticas (sem CÓDIGO na UI) */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-medium">Linhas temáticas</h3>
                  <button type="button" onClick={() => update("linhas", [...form.linhas, { nome: "", descricao: "" }])} className={btnGhost}>
                    <Plus className="h-4 w-4" /> adicionar linha
                  </button>
                </div>
                <div className="grid gap-3">
                  {form.linhas.map((l, i) => (
                    <div key={i} className="grid gap-2">
                      <input
                        className={inputBase}
                        placeholder="Nome da linha temática (ex.: Intersetorialidade e o “Fazer Junto”…)"
                        value={l.nome}
                        onChange={(e) => {
                          const arr = [...form.linhas];
                          arr[i] = { ...arr[i], nome: e.target.value };
                          update("linhas", arr);
                        }}
                        aria-label="Nome da linha temática"
                      />
                      <div className="flex gap-2">
                        <textarea
                          className={`${inputBase} flex-1 min-h-[110px] rounded-2xl`}
                          placeholder="Descrição da linha temática (opcional)"
                          value={l.descricao || ""}
                          onChange={(e) => {
                            const arr = [...form.linhas];
                            arr[i] = { ...arr[i], descricao: e.target.value };
                            update("linhas", arr);
                          }}
                          aria-label="Descrição da linha temática"
                        />
                        <button
                          type="button"
                          onClick={() => update("linhas", form.linhas.filter((_, j) => j !== i))}
                          className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                          aria-label={`Remover linha temática ${i + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Limites de caracteres */}
              <div>
                <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Limites de caracteres da submissão</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    ["titulo", "Título da experiência"],
                    ["introducao", "Introdução com justificativa"],
                    ["objetivos", "Objetivos"],
                    ["metodo", "Método/Descrição da prática"],
                    ["resultados", "Resultados/Impactos"],
                    ["consideracoes", "Considerações finais"],
                  ].map(([key, rot]) => (
                    <Field key={key} label={rot}>
                      <input
                        type="number"
                        min={50}
                        max={20000}
                        className={inputBase}
                        value={form.limites[key]}
                        onChange={(e) => updateLim(key, e.target.value)}
                        aria-label={`Limite de caracteres para ${rot}`}
                      />
                    </Field>
                  ))}
                </div>
              </div>

              {/* Normas gerais (Markdown) */}
              <Field label="Descrição/Normas (Markdown)">
                <textarea
                  className={`${inputBase} min-h-[180px] rounded-2xl`}
                  value={form.descricao_markdown}
                  onChange={(e) => update("descricao_markdown", e.target.value)}
                  required
                  aria-required="true"
                />
              </Field>
            </section>

            {/* 4) Do limite de autores e coautores */}
            <section id="s4" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <h2 className={`sm:col-span-2 ${sectionTitle}`}>4) Do limite de autores e coautores</h2>
              <Field label="Máximo de coautores">
                <input
                  type="number"
                  min={0}
                  className={inputBase}
                  value={form.max_coautores}
                  onChange={(e) => update("max_coautores", e.target.value)}
                />
              </Field>
            </section>

            {/* 5) Dos critérios de avaliação (ESCRITA) */}
            <section id="s5" className="grid grid-cols-1 gap-4">
              <h2 className={sectionTitle}>5) Dos critérios de avaliação</h2>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-medium">Critérios — avaliação escrita</h3>
                  <button type="button" onClick={() => update("criterios", [...form.criterios, { titulo: "", escala_min: 1, escala_max: 5, peso: 1 }])} className={btnGhost}>
                    <Plus className="h-4 w-4" /> adicionar critério
                  </button>
                </div>
                <div className="grid gap-3">
                  {form.criterios.map((c, i) => (
                    <div key={i} className="grid gap-2 sm:grid-cols-2">
                      <input
                        className={inputBase}
                        placeholder="Título do critério"
                        value={c.titulo}
                        onChange={(e) => {
                          const arr = [...form.criterios];
                          arr[i] = { ...arr[i], titulo: e.target.value };
                          update("criterios", arr);
                        }}
                        aria-label="Título do critério (escrita)"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <Field label="Nota mínima">
                          <input
                            className={inputBase}
                            type="number"
                            value={c.escala_min ?? 1}
                            onChange={(e) => {
                              const arr = [...form.criterios];
                              arr[i] = { ...arr[i], escala_min: Number(e.target.value) || 1 };
                              update("criterios", arr);
                            }}
                            aria-label="Nota mínima do critério (escrita)"
                          />
                        </Field>
                        <Field label="Nota máxima">
                          <input
                            className={inputBase}
                            type="number"
                            value={c.escala_max ?? 5}
                            onChange={(e) => {
                              const arr = [...form.criterios];
                              arr[i] = { ...arr[i], escala_max: Number(e.target.value) || 5 };
                              update("criterios", arr);
                            }}
                            aria-label="Nota máxima do critério (escrita)"
                          />
                        </Field>
                        <Field label="Peso">
                          <input
                            className={inputBase}
                            type="number"
                            step="0.1"
                            value={c.peso ?? 1}
                            onChange={(e) => {
                              const arr = [...form.criterios];
                              arr[i] = { ...arr[i], peso: Number(e.target.value) || 1 };
                              update("criterios", arr);
                            }}
                            aria-label="Peso do critério (escrita)"
                          />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Field label="Outros critérios (escrita)">
                <textarea
                  className={`${inputBase} min-h-[100px] rounded-2xl`}
                  value={form.criterios_outros}
                  onChange={(e) => update("criterios_outros", e.target.value)}
                  placeholder="Digite outros critérios que complementam a avaliação escrita..."
                />
              </Field>
            </section>

            {/* 6) Da Apresentação Oral (ORAL) */}
            <section id="s6" className="grid grid-cols-1 gap-4">
              <h2 className={sectionTitle}>6) Da Apresentação Oral</h2>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-medium">Critérios — apresentação oral</h3>
                  <button type="button" onClick={() => update("criterios_orais", [...form.criterios_orais, { titulo: "", escala_min: 1, escala_max: 3, peso: 1 }])} className={btnGhost}>
                    <Plus className="h-4 w-4" /> adicionar critério
                  </button>
                </div>
                <div className="grid gap-3">
                  {form.criterios_orais.map((c, i) => (
                    <div key={i} className="grid gap-2 sm:grid-cols-2">
                      <input
                        className={inputBase}
                        placeholder="Título do critério"
                        value={c.titulo}
                        onChange={(e) => {
                          const arr = [...form.criterios_orais];
                          arr[i] = { ...arr[i], titulo: e.target.value };
                          update("criterios_orais", arr);
                        }}
                        aria-label="Título do critério (oral)"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <Field label="Nota mínima">
                          <input
                            className={inputBase}
                            type="number"
                            value={c.escala_min ?? 1}
                            onChange={(e) => {
                              const arr = [...form.criterios_orais];
                              arr[i] = { ...arr[i], escala_min: Number(e.target.value) || 1 };
                              update("criterios_orais", arr);
                            }}
                            aria-label="Nota mínima do critério (oral)"
                          />
                        </Field>
                        <Field label="Nota máxima">
                          <input
                            className={inputBase}
                            type="number"
                            value={c.escala_max ?? 3}
                            onChange={(e) => {
                              const arr = [...form.criterios_orais];
                              arr[i] = { ...arr[i], escala_max: Number(e.target.value) || 3 };
                              update("criterios_orais", arr);
                            }}
                            aria-label="Nota máxima do critério (oral)"
                          />
                        </Field>
                        <Field label="Peso">
                          <input
                            className={inputBase}
                            type="number"
                            step="0.1"
                            value={c.peso ?? 1}
                            onChange={(e) => {
                              const arr = [...form.criterios_orais];
                              arr[i] = { ...arr[i], peso: Number(e.target.value) || 1 };
                              update("criterios_orais", arr);
                            }}
                            aria-label="Peso do critério (oral)"
                          />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Field label="Outros critérios (oral)">
                <textarea
                  className={`${inputBase} min-h-[100px] rounded-2xl`}
                  value={form.oral_outros}
                  onChange={(e) => update("oral_outros", e.target.value)}
                  placeholder="Digite outros critérios para a apresentação oral..."
                />
              </Field>
            </section>

            {/* 7) Da premiação */}
            <section id="s7" className="grid grid-cols-1 gap-4">
              <h2 className={sectionTitle}>7) Da premiação</h2>
              <Field label="Texto da premiação">
                <textarea
                  className={`${inputBase} min-h-[120px] rounded-2xl`}
                  value={form.premiacao_texto}
                  onChange={(e) => update("premiacao_texto", e.target.value)}
                  placeholder="Descreva regras e formato da premiação..."
                />
              </Field>
            </section>

            {/* 8) Formulário eletrônico para submissão */}
            <section id="s8" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <h2 className={`sm:col-span-2 ${sectionTitle}`}>8) Formulário eletrônico para submissão</h2>

              <Field label="Aceita pôster (.ppt/.pptx)">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" className="rounded border-zinc-300" checked={form.aceita_poster}
                         onChange={(e) => update("aceita_poster", e.target.checked)} />
                  Aceitar envio de pôster no ato da submissão
                </label>
              </Field>

              <Field label="Link do modelo de pôster (PPT)">
                <input
                  className={inputBase}
                  value={form.link_modelo_poster}
                  onChange={(e) => update("link_modelo_poster", e.target.value)}
                  placeholder="https://…"
                  inputMode="url"
                />
              </Field>
            </section>

            {/* 9) Das disposições finais */}
            <section id="s9" className="grid grid-cols-1 gap-4">
              <h2 className={sectionTitle}>9) Das disposições finais</h2>
              <Field label="Texto das disposições finais">
                <textarea
                  className={`${inputBase} min-h-[120px] rounded-2xl`}
                  value={form.disposicoes_finais_texto}
                  onChange={(e) => update("disposicoes_finais_texto", e.target.value)}
                  placeholder="Informe as disposições finais..."
                />
              </Field>
            </section>

            {/* Ações */}
            <section className="flex flex-wrap items-center gap-3">
              <button disabled={saving} className={btnPrimary}>
                <Save className="h-4 w-4" /> {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar chamada"}
              </button>

              <label className="ml-1 inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="rounded border-zinc-300"
                  checked={form.publicado}
                  onChange={(e) => update("publicado", e.target.checked)}
                />
                Já publicar ao salvar
              </label>

              {ok && <span className="text-sm text-emerald-700 dark:text-emerald-300">{ok}</span>}
              {err && <span className="text-sm text-red-600">{err}</span>}
            </section>
          </form>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
