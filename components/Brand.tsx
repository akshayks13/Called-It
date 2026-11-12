import Image from "next/image";
import logo from "@/assets/called-it-logo.png";

export default function Brand({ compact = false }: { compact?: boolean }) {
  const size = compact ? 36 : 64;

  return (
    <span className={`inline-flex shrink-0 items-center ${compact ? "gap-1.5" : "gap-3"}`}>
      <Image src={logo} alt="" width={size} height={size} sizes={`${size}px`} preload className="rounded-lg" />
      <span className={`font-display leading-none tracking-wide whitespace-nowrap text-amber ${compact ? "text-[19px]" : "text-[25px]"}`}>
        CALLED IT<span className="text-fg">.</span>
      </span>
    </span>
  );
}
