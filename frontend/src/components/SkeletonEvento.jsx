export default function SkeletonEvento() {
  return (
    <div
      className="max-w-3xl mx-auto p-6 mt-8 animate-pulse"
      aria-label="Carregando detalhes do evento"
      aria-busy="true"
      aria-live="polite"
      role="status"
      tabIndex={0}
    >
      <div className="h-8 bg-gray-200 dark:bg-zinc-700 rounded w-2/3 mb-4"></div>
      <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded w-full mb-3"></div>
      <div className="h-4 bg-gray-100 dark:bg-zinc-600 rounded w-1/2 mb-3"></div>
      <div className="h-10 bg-gray-100 dark:bg-zinc-600 rounded w-full"></div>
    </div>
  );
}
