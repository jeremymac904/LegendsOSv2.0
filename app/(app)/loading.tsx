export default function Loading() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="flex items-center gap-3 text-sm text-ink-300">
        <span className="h-2 w-2 animate-pulse rounded-full bg-accent-gold" />
        Loading…
      </div>
    </div>
  );
}
