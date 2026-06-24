import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function TermsOfUse() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="p-6 md:p-8 prose prose-slate max-w-none">
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3 not-prose">
            Plantilla informativa — debe revisarse con un asesor legal antes de uso comercial.
          </p>
          <h1>Términos de uso para empresas</h1>

          <h2>1. Objeto</h2>
          <p>
            TimeClock es una herramienta técnica SaaS para registro horario. La empresa usuaria es
            responsable del cumplimiento legal frente a sus trabajadores.
          </p>

          <h2>2. Obligaciones de la empresa</h2>
          <ul>
            <li>Informar a los empleados sobre el tratamiento de datos.</li>
            <li>Configurar correctamente sus datos legales (CIF, contacto privacidad).</li>
            <li>Conservar y exportar registros horarios durante 4 años.</li>
            <li>No usar la app para fines no laborales ni vigilancia invasiva.</li>
          </ul>

          <h2>3. Limitación de responsabilidad</h2>
          <p>
            La plataforma presta infraestructura y software. No sustituye asesoramiento legal ni
            garantiza por sí sola el cumplimiento normativo sin configuración y uso correctos.
          </p>

          <h2>4. Datos y baja</h2>
          <p>
            Antes de eliminar una cuenta empresarial, exporta los registros. Los fichajes pueden
            estar sujetos a retención legal mínima de 4 años.
          </p>
        </Card>
        <Button asChild variant="outline">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
