interface PassLogProps {
  passes: string[];
}

export function PassLog({ passes }: PassLogProps) {
  if (passes.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 px-4 py-3 bg-card border border-border rounded-md">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Applied Passes
      </h4>
      <ul className="flex flex-col gap-1">
        {passes.map((pass) => (
          <li
            key={pass}
            className="flex items-center gap-2 text-xs text-foreground/80"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
            {pass}
          </li>
        ))}
      </ul>
    </div>
  );
}
