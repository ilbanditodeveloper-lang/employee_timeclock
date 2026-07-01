import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  href: string;
  className?: string;
  ariaLabel?: string;
};

export default function WhatsAppFloatButton({
  href,
  className,
  ariaLabel = "Contactar por WhatsApp",
}: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={ariaLabel}
      className={cn(
        "fixed bottom-5 right-5 z-50 flex size-14 items-center justify-center rounded-full",
        "bg-[#25D366] text-white shadow-lg shadow-emerald-900/25",
        "transition-transform hover:scale-105 hover:bg-[#20bd5a]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]",
        className
      )}
    >
      <MessageCircle className="size-7" />
    </a>
  );
}
