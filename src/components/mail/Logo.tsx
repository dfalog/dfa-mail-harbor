import { cn } from "@/lib/utils";

export function Logo({ inverted = false, className }: { inverted?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl text-sm font-extrabold",
        inverted ? "bg-primary-foreground text-primary" : "bg-gradient-primary text-primary-foreground shadow-glow")}>
        DFA
      </div>
      <span className={cn("text-lg font-extrabold tracking-tight", inverted ? "text-primary-foreground" : "text-foreground")}>
        DFA <span className={inverted ? "" : "text-primary"}>Mail</span>
      </span>
    </div>
  );
}
