import { cn } from "@/lib/utils";
import logo from "@/assets/dfa-log-logo.png.asset.json";

export function Logo({ className }: { inverted?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <img src={logo.url} alt="DFA LOG" className="h-8 w-auto" />
      <span className="border-l border-border pl-2 text-sm font-bold text-navy">Mail</span>
    </div>
  );
}
