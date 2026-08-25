export const BrandedLoader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-950">
    <span className="text-xl font-semibold text-gray-800 dark:text-gray-100 tracking-tight mb-6">
      StuddyHub <span className="text-blue-600 dark:text-blue-400">AI</span>
    </span>
    {/* Thin animated progress bar */}
    <div className="w-48 h-1 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
      <div className="h-full rounded-full bg-blue-600 dark:bg-blue-400 animate-[shimmer_1.4s_ease-in-out_infinite]" />
    </div>
    <style>{`
      @keyframes shimmer {
        0%   { width: 0%; margin-left: 0; }
        50%  { width: 70%; margin-left: 15%; }
        100% { width: 0%; margin-left: 100%; }
      }
    `}</style>
  </div>
);