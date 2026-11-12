import Image from "next/image";

export default function Brand({ compact = false }: { compact?: boolean }) {
  const size = compact ? 30 : 42;

  return (
    <span className={`inline-flex shrink-0 items-center ${compact ? "gap-1.5" : "gap-3"}`}>
      <Image src="/icon.svg" alt="" width={size} height={size} unoptimized />
      <span className={`font-display leading-none tracking-wide whitespace-nowrap text-fg ${compact ? "text-[19px]" : "text-[27px]"}`}>
        CALLED IT<span className="text-amber">.</span>
      </span>
    </span>
  );
}
