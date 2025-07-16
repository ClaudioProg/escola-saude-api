import { motion } from "framer-motion";

export default function ListaInscritos({ inscritos = [], turma }) {
  const formatarCPF = (cpf) =>
    cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden mt-4"
      aria-label={`Inscritos da turma ${turma?.nome}`}
    >
      {inscritos.length === 0 ? (
        <div className="flex flex-col items-center py-8">
          <span className="text-4xl mb-2">🗒️</span>
          <p className="text-gray-500 dark:text-gray-300 font-semibold">
            Nenhum inscrito nesta turma.
          </p>
        </div>
      ) : (
        <ul
          className="divide-y divide-gray-200 dark:divide-gray-700 rounded-xl shadow-sm bg-white dark:bg-gray-900"
          role="list"
        >
          {inscritos.map((inscrito) => {
            const statusPresenca = inscrito.presente
              ? {
                  texto: "🟡 Presente",
                  cor: "bg-yellow-200 text-yellow-900 dark:bg-yellow-400 dark:text-black",
                }
              : {
                  texto: "🔴 Faltou",
                  cor: "bg-red-300 text-red-900 dark:bg-red-500 dark:text-white",
                };

            return (
              <li
                key={inscrito.usuario_id}
                role="listitem"
                tabIndex={0}
                className="flex flex-col md:flex-row md:items-center justify-between py-3 px-4 gap-2 focus:outline-none focus:ring-2 focus:ring-lousa rounded transition-all"
                aria-label={`Inscrito: ${inscrito.nome}, ${statusPresenca.texto}`}
              >
                <div>
                  <span className="font-semibold text-gray-800 dark:text-white">
                    {inscrito.nome}
                  </span>
                  <div className="text-gray-600 dark:text-gray-300 text-sm">
                    {inscrito.email}
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <span className="text-gray-800 dark:text-gray-100 font-medium">
                    {formatarCPF(inscrito.cpf)}
                  </span>
                  <span
                    className={`mt-1 text-xs px-2 py-1 rounded-full font-bold ${statusPresenca.cor}`}
                    aria-label={`Status de presença: ${statusPresenca.texto}`}
                  >
                    {statusPresenca.texto}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </motion.div>
  );
}
