import { STATUS_LABEL } from "@/lib/format";

export function StatusDot({ status, className = "" }: { status: string; className?: string }) {
  return <span className={`dot dot-${status} ${className}`} role="img" aria-label={STATUS_LABEL[status] ?? status} />;
}
