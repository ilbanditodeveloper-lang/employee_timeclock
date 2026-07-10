import { useState } from "react";
import { Link } from "wouter";
import { Scale } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { adminApiInput } from "@/lib/adminContext";

const DOC_LINKS: Record<string, string> = {
  terms_of_use: "/legal/terms",
  privacy_policy: "/legal/privacy",
  dpa: "/legal/dpa",
};

export default function LegalReacceptanceBanner() {
  const [acknowledged, setAcknowledged] = useState(false);
  const input = adminApiInput();
  const missingQuery = trpc.publicApi.getMissingCompanyLegalAcceptances.useQuery(input);
  const trpcUtils = trpc.useUtils();
  const acceptMutation = trpc.publicApi.acceptCompanyLegalDocuments.useMutation({
    onSuccess: async () => {
      toast.success("Documentos legales aceptados");
      setAcknowledged(false);
      await trpcUtils.publicApi.getMissingCompanyLegalAcceptances.invalidate();
    },
    onError: (error) => toast.error(error.message || "No se pudo registrar la aceptación"),
  });

  const missing = missingQuery.data ?? [];
  if (!missing.length) return null;

  return (
    <Dialog open>
      <DialogContent
        className="max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="size-5 text-amber-600" />
            Actualización de documentos legales
          </DialogTitle>
          <DialogDescription>
            Hemos actualizado los textos de la plataforma. Debes revisarlos y aceptarlos para seguir usando el panel de
            administración.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-sm">
          {missing.map((doc) => (
            <li key={`${doc.code}-${doc.version}`} className="rounded-md border border-border bg-muted/50 px-3 py-2">
              <p className="font-medium text-foreground">{doc.title}</p>
              <p className="text-xs text-muted-foreground">Versión {doc.version}</p>
              {DOC_LINKS[doc.code] ? (
                <Link href={DOC_LINKS[doc.code]} className="text-xs text-primary underline" target="_blank">
                  Leer documento
                </Link>
              ) : null}
            </li>
          ))}
        </ul>

        <div className="flex items-start gap-3">
          <Checkbox
            id="legal-reaccept"
            checked={acknowledged}
            onCheckedChange={(v) => setAcknowledged(v === true)}
          />
          <label htmlFor="legal-reaccept" className="text-sm text-muted-foreground leading-relaxed">
            He leído los documentos anteriores en nombre de mi empresa y acepto la versión vigente. Entiendo que debo
            revisarlos con un asesor antes de uso oficial masivo.
          </label>
        </div>

        <DialogFooter>
          <Button
            type="button"
            disabled={!acknowledged || acceptMutation.isPending}
            onClick={() => acceptMutation.mutate({ ...input, legalAcknowledged: true })}
          >
            {acceptMutation.isPending ? "Guardando…" : "Aceptar y continuar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
