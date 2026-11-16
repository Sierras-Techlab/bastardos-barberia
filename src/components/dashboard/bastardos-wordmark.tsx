export function BastardosWordmark({
  withSubtitle = false,
}: {
  withSubtitle?: boolean;
}) {
  return (
    <span className="inline-flex min-w-0 flex-col">
      <span className="flex items-center gap-1.5">
        <svg
          viewBox="0 0 36 23"
          fill="none"
          aria-hidden="true"
          className="h-4 w-6 shrink-0"
        >
          <path d="M3 18 6.5 6 13 13.5 18 4 23.5 13.5 30 6 33 18H3Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M5 21H31" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <span className="text-[1.08rem] leading-none font-black tracking-[-0.07em] italic sm:text-xl">BASTARDOS</span>
      </span>
      {withSubtitle && (
        <span className="mt-1 text-[10px] leading-none font-bold tracking-[0.22em] text-red-400">BARBERÍA</span>
      )}
    </span>
  );
}
