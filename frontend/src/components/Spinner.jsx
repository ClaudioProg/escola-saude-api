export default function Spinner() {
  return (
    <div
      className="flex items-center justify-center min-h-[120px]"
      role="status"
      aria-live="polite"
    >
      <div
        className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-lousa dark:border-white"
        aria-hidden="true"
      ></div>
      <span className="sr-only">Carregando...</span>
    </div>
  );
}
