import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="p-6 md:p-8 prose prose-slate max-w-none">
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3 not-prose">
            Plantilla informativa — debe revisarse con un asesor legal antes de uso comercial.
          </p>
          <h1>Política de privacidad de la plataforma TimeClock</h1>
          <p><strong>Última actualización:</strong> 22 de junio de 2026</p>

          <h2>1. Responsable y encargado</h2>
          <p>
            Cada empresa cliente es <strong>responsable del tratamiento</strong> de los datos de sus
            empleados. La plataforma TimeClock actúa como <strong>encargado del tratamiento</strong>{" "}
            al prestar la herramienta técnica de registro horario.
          </p>

          <h2>2. Datos que trata la plataforma</h2>
          <ul>
            <li>Identificación: nombre, usuario, teléfono (opcional).</li>
            <li>Datos laborales: horarios, fichajes, incidencias, solicitudes de ausencia.</li>
            <li>Ubicación puntual al fichar (solo si la empresa lo activa).</li>
            <li>Datos técnicos mínimos: suscripción push, registros de auditoría.</li>
          </ul>

          <h2>3. Finalidad y base legal</h2>
          <p>
            Gestión del registro horario y control de jornada. La base legal principal es la{" "}
            <strong>obligación legal del empleador</strong> (art. 34.9 ET en España) y la ejecución
            de la relación laboral — no el consentimiento del trabajador como base principal.
          </p>

          <h2>4. Conservación</h2>
          <p>
            Los registros horarios se conservan <strong>4 años</strong> como mínimo. Otros datos
            mientras exista relación con la empresa o contrato de servicio.
          </p>

          <h2>5. Destinatarios</h2>
          <p>
            Empresa empleadora, trabajadores autorizados, asesoría laboral si procede, Inspección
            de Trabajo cuando lo solicite, y proveedores técnicos (hosting PostgreSQL, notificaciones
            push, mapas si se configuran).
          </p>

          <h2>6. Derechos</h2>
          <p>
            Acceso, rectificación, supresión, oposición, limitación y portabilidad cuando proceda.
            Contacta con el responsable de tu empresa (datos en la sección legal del negocio) o con
            el soporte de la plataforma.
          </p>

          <h2>7. Seguridad</h2>
          <p>
            Contraseñas con hash seguro, HTTPS en producción, aislamiento multiempresa, registro de
            auditoría en correcciones de fichajes.
          </p>
        </Card>
        <Button asChild variant="outline">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
