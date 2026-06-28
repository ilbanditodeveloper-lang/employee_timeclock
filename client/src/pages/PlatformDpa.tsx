import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function PlatformDpa() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="p-6 md:p-8 prose prose-slate max-w-none">
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3 not-prose">
            Plantilla orientativa — requiere revisión por asesor legal/gestoría/DPO antes de uso
            oficial. Debe formalizarse entre el proveedor de TimeClock y cada empresa cliente.
          </p>
          <h1>Acuerdo de encargado del tratamiento (Art. 28 RGPD)</h1>
          <p><strong>Plataforma:</strong> TimeClock</p>

          <h2>1. Objeto</h2>
          <p>
            Tratamiento de datos personales de empleados de la empresa cliente para registro
            horario y gestión de jornada mediante la plataforma SaaS TimeClock.
          </p>

          <h2>2. Duración</h2>
          <p>Vigencia del contrato de servicio SaaS entre las partes.</p>

          <h2>3. Tipo de datos e interesados</h2>
          <ul>
            <li>Datos identificativos laborales: nombre, usuario, teléfono (opcional).</li>
            <li>Registro horario: entradas, salidas, horarios, incidencias, ausencias.</li>
            <li>Ubicación puntual al fichar (solo si la empresa lo activa).</li>
            <li>Datos técnicos: auditoría de cambios, suscripciones push.</li>
          </ul>

          <h2>4. Obligaciones del encargado</h2>
          <ul>
            <li>Tratar solo según instrucciones documentadas del responsable (empresa cliente).</li>
            <li>Confidencialidad del personal autorizado.</li>
            <li>Medidas de seguridad técnicas y organizativas adecuadas.</li>
            <li>Subencargados (hosting, notificaciones) con garantías equivalentes.</li>
            <li>Asistencia al responsable en derechos de los interesados.</li>
            <li>Supresión o devolución al finalizar, salvo obligación legal de conservación.</li>
          </ul>

          <h2>5. Medidas de seguridad</h2>
          <p>
            Aislamiento multiempresa, HTTPS, hash de contraseñas, auditoría de correcciones en
            fichajes, backups del proveedor de base de datos.
          </p>

          <h2>6. Contacto</h2>
          <p>
            Para formalizar este acuerdo o solicitar información, contacte con el soporte de la
            plataforma TimeClock o con su proveedor del servicio.
          </p>
        </Card>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/legal/privacy">Política de privacidad</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/legal/terms">Términos de uso</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Volver al inicio</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
