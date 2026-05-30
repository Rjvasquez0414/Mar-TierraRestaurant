import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "reservas@marytierrarestaurantbga.com";
const RESTAURANT_EMAIL = "marytierrarestaurantbga@gmail.com";

// Cliente con service role para verificar el email REAL del cliente por
// código de reserva. Evita que se usen estos endpoints para enviar correos
// a destinatarios arbitrarios desde el dominio del restaurante.
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

// CORS restringido a los orígenes propios (en vez de "*").
const ALLOWED_ORIGINS = [
  "https://marytierrarestaurantbga.com",
  "https://www.marytierrarestaurantbga.com",
  "http://localhost:8765",
  "http://localhost:3000",
];
function cors(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

// Devuelve el email real del cliente dueño de la reserva, o null si no existe.
async function verifiedRecipient(code: unknown): Promise<string | null> {
  if (!code || typeof code !== "string") return null;
  try {
    const { data, error } = await supabaseAdmin
      .from("reservations")
      .select("customer:customers(email)")
      .eq("reservation_code", code.toUpperCase().trim())
      .maybeSingle();
    if (error || !data) return null;
    // deno-lint-ignore no-explicit-any
    const email = (data as any).customer?.email;
    return (typeof email === "string" && email.includes("@")) ? email : null;
  } catch (_e) {
    return null;
  }
}

interface ReservationEmail {
  customerName: string;
  customerEmail: string;
  reservationCode: string;
  date: string;
  time: string;
  partySize: number;
  salonName: string;
  typeName: string;
  depositAmount: number;
  isConsumable: boolean;
}

function formatPrice(amount: number): string {
  return "$" + amount.toLocaleString("es-CO");
}

function buildCustomerEmail(data: ReservationEmail): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FDFBF7;border:1px solid rgba(43,24,16,0.08);border-radius:4px;">

        <!-- Header -->
        <tr><td style="padding:40px 40px 24px;text-align:center;border-bottom:1px solid rgba(43,24,16,0.08);">
          <p style="margin:0 0 8px;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#8B8680;">Mar &amp; Tierra Restaurant</p>
          <h1 style="margin:0;font-size:28px;font-weight:normal;color:#2B1810;letter-spacing:-0.5px;">Cupo Apartado</h1>
        </td></tr>

        <!-- Code -->
        <tr><td style="padding:28px 40px 0;text-align:center;">
          <p style="margin:0 0 4px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#8B8680;">Codigo de reserva</p>
          <p style="margin:0;font-size:20px;font-weight:bold;color:#8B6914;letter-spacing:1px;">${data.reservationCode}</p>
        </td></tr>

        <!-- Pending notice -->
        <tr><td style="padding:24px 40px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(212,175,55,0.10);border:1px solid rgba(212,175,55,0.32);border-radius:4px;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0;font-size:14px;color:#3A332E;line-height:1.6;">Tu cupo esta <strong style="color:#2B1810;">reservado por 24 horas</strong>. Realiza el anticipo y envia el comprobante para confirmar tu reserva. Verificamos los pagos en horario de atencion (<strong style="color:#2B1810;">8:00 a.m. a 10:00 p.m.</strong>). Si no recibimos el pago en 24 horas, el cupo se libera automaticamente.</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Details -->
        <tr><td style="padding:28px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(43,24,16,0.06);border-radius:4px;">
            <tr>
              <td style="padding:14px 20px;border-bottom:1px solid rgba(43,24,16,0.06);font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8B8680;width:120px;">Fecha</td>
              <td style="padding:14px 20px;border-bottom:1px solid rgba(43,24,16,0.06);font-size:15px;color:#2B1810;">${data.date}</td>
            </tr>
            <tr>
              <td style="padding:14px 20px;border-bottom:1px solid rgba(43,24,16,0.06);font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8B8680;">Hora</td>
              <td style="padding:14px 20px;border-bottom:1px solid rgba(43,24,16,0.06);font-size:15px;color:#2B1810;">${data.time}</td>
            </tr>
            <tr>
              <td style="padding:14px 20px;border-bottom:1px solid rgba(43,24,16,0.06);font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8B8680;">Personas</td>
              <td style="padding:14px 20px;border-bottom:1px solid rgba(43,24,16,0.06);font-size:15px;color:#2B1810;">${data.partySize}</td>
            </tr>
            <tr>
              <td style="padding:14px 20px;border-bottom:1px solid rgba(43,24,16,0.06);font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8B8680;">Salon</td>
              <td style="padding:14px 20px;border-bottom:1px solid rgba(43,24,16,0.06);font-size:15px;color:#2B1810;">${data.salonName}</td>
            </tr>
            <tr>
              <td style="padding:14px 20px;border-bottom:1px solid rgba(43,24,16,0.06);font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8B8680;">Experiencia</td>
              <td style="padding:14px 20px;border-bottom:1px solid rgba(43,24,16,0.06);font-size:15px;color:#2B1810;">${data.typeName}</td>
            </tr>
            <tr>
              <td style="padding:14px 20px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8B8680;">Anticipo</td>
              <td style="padding:14px 20px;font-size:16px;font-weight:bold;color:#2B1810;">${formatPrice(data.depositAmount)} <span style="font-size:12px;font-weight:normal;color:#8B8680;">${data.isConsumable ? "(consumible)" : "(no consumible)"}</span></td>
            </tr>
          </table>
        </td></tr>

        <!-- Payment info -->
        <tr><td style="padding:0 40px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(43,24,16,0.025);border:1px solid rgba(43,24,16,0.06);border-radius:4px;padding:20px;">
            <tr><td>
              <p style="margin:0 0 12px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#8B8680;">Que sigue</p>
              <p style="margin:0 0 8px;font-size:14px;color:#3A332E;line-height:1.6;">1. Realiza el anticipo de <strong>${formatPrice(data.depositAmount)}</strong></p>
              <p style="margin:0 0 8px;font-size:14px;color:#3A332E;line-height:1.6;">2. Envia el comprobante por WhatsApp al <strong>300 826 3403</strong></p>
              <p style="margin:0 0 16px;font-size:14px;color:#3A332E;line-height:1.6;">3. Confirmamos tu reserva al verificar el pago (8:00 a.m. a 10:00 p.m.)</p>
              <p style="margin:0 0 4px;font-size:14px;color:#2B1810;"><strong>Bancolombia</strong> - Cuenta Corriente</p>
              <p style="margin:0 0 2px;font-size:14px;color:#3A332E;">No. Cuenta: <strong>30200003995</strong></p>
              <p style="margin:0 0 2px;font-size:14px;color:#3A332E;">NIT: 901857854</p>
              <p style="margin:0;font-size:14px;color:#3A332E;">Titular: MYT RESTAURANT SAS</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Self-service link -->
        <tr><td style="padding:20px 40px;text-align:center;">
          <a href="https://marytierrarestaurantbga.com/mi-reserva.html?code=${data.reservationCode}" style="display:inline-block;padding:12px 28px;background:#2B1810;color:#FDFBF7;text-decoration:none;border-radius:3px;font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Consultar mi reserva</a>
          <p style="margin:10px 0 0;font-size:12px;color:#8B8680;">Modifica o cancela tu reserva desde este enlace</p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 40px;border-top:1px solid rgba(43,24,16,0.08);text-align:center;">
          <p style="margin:0 0 8px;font-size:13px;font-style:italic;color:#8B8680;">Donde el mar y la tierra se complementan.</p>
          <p style="margin:0;font-size:12px;color:#8B8680;">Cra 35a #46-102, Cabecera del Llano, Bucaramanga</p>
          <p style="margin:4px 0 0;font-size:12px;color:#8B8680;">+57 300 826 3403 &middot; @marytierrarestaurantbga</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildAdminNotification(data: ReservationEmail): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:20px;font-family:Arial,sans-serif;background:#f5f5f5;">
  <div style="max-width:500px;margin:0 auto;background:#fff;border:1px solid #e0e0e0;border-radius:4px;padding:24px;">
    <h2 style="margin:0 0 16px;font-size:16px;color:#2B1810;">Nueva reserva: ${data.reservationCode}</h2>
    <p style="margin:0 0 4px;font-size:14px;color:#333;"><strong>${data.customerName}</strong> — ${data.customerEmail}</p>
    <p style="margin:0 0 16px;font-size:14px;color:#666;">${data.date} a las ${data.time} — ${data.partySize} personas — ${data.salonName}</p>
    <p style="margin:0 0 4px;font-size:14px;color:#333;">Tipo: <strong>${data.typeName}</strong></p>
    <p style="margin:0;font-size:14px;color:#333;">Anticipo: <strong>${formatPrice(data.depositAmount)}</strong> ${data.isConsumable ? "(consumible)" : "(no consumible)"}</p>
    <hr style="margin:16px 0;border:none;border-top:1px solid #e0e0e0;">
    <p style="margin:0;font-size:12px;color:#999;">Pendiente de pago. Verificar en el panel de admin.</p>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  const corsHeaders = cors(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const reject = (msg: string, status = 400) =>
    new Response(JSON.stringify({ success: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status,
    });

  try {
    const data = await req.json();

    // El destinatario SIEMPRE se resuelve desde la BD por código de reserva
    // (no se confía en el email que venga en el body).
    const recipient = await verifiedRecipient(data.reservationCode);
    if (!recipient) return reject("Reserva no encontrada o sin email registrado.");

    // Payment reminder email
    if (data.type === 'payment_reminder') {
      const reminderHtml = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FDFBF7;border:1px solid rgba(43,24,16,0.08);border-radius:4px;">
        <tr><td style="padding:40px 40px 24px;text-align:center;border-bottom:1px solid rgba(43,24,16,0.08);">
          <p style="margin:0 0 8px;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#8B8680;">Mar &amp; Tierra Restaurant</p>
          <h1 style="margin:0;font-size:24px;font-weight:normal;color:#2B1810;">Recordatorio de Pago</h1>
        </td></tr>
        <tr><td style="padding:28px 40px;">
          <p style="margin:0 0 20px;font-size:15px;color:#2B1810;line-height:1.6;">Hola <strong>${data.customerName}</strong>, te recordamos que tu reserva <strong>${data.reservationCode}</strong> requiere el anticipo de <strong>${data.depositAmount}</strong> para ser confirmada.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(43,24,16,0.06);border-radius:4px;margin-bottom:20px;">
            <tr><td style="padding:12px 20px;border-bottom:1px solid rgba(43,24,16,0.06);font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8B8680;width:100px;">Fecha</td><td style="padding:12px 20px;border-bottom:1px solid rgba(43,24,16,0.06);font-size:14px;color:#2B1810;">${data.date}</td></tr>
            <tr><td style="padding:12px 20px;border-bottom:1px solid rgba(43,24,16,0.06);font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8B8680;">Hora</td><td style="padding:12px 20px;border-bottom:1px solid rgba(43,24,16,0.06);font-size:14px;color:#2B1810;">${data.time}</td></tr>
            <tr><td style="padding:12px 20px;border-bottom:1px solid rgba(43,24,16,0.06);font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8B8680;">Personas</td><td style="padding:12px 20px;border-bottom:1px solid rgba(43,24,16,0.06);font-size:14px;color:#2B1810;">${data.partySize}</td></tr>
            <tr><td style="padding:12px 20px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8B8680;">Salon</td><td style="padding:12px 20px;font-size:14px;color:#2B1810;">${data.salonName}</td></tr>
          </table>
          <div style="background:rgba(43,24,16,0.025);border:1px solid rgba(43,24,16,0.06);border-radius:4px;padding:20px;margin-bottom:20px;">
            <p style="margin:0 0 8px;font-size:14px;color:#2B1810;"><strong>Bancolombia</strong> - Cuenta Corriente</p>
            <p style="margin:0 0 4px;font-size:14px;color:#3A332E;">No. Cuenta: <strong>30200003995</strong></p>
            <p style="margin:0 0 4px;font-size:14px;color:#3A332E;">NIT: 901857854</p>
            <p style="margin:0 0 12px;font-size:14px;color:#3A332E;">Titular: MYT RESTAURANT SAS</p>
            <p style="margin:0;font-size:13px;font-style:italic;color:#8B8680;">Envia el comprobante por WhatsApp al 300 826 3403</p>
          </div>
          <p style="margin:0;font-size:13px;color:#8B8680;font-style:italic;">Si ya realizaste el pago, puedes ignorar este mensaje. Tu reserva sera confirmada tras verificar el comprobante.</p>
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid rgba(43,24,16,0.08);text-align:center;">
          <p style="margin:0;font-size:12px;color:#8B8680;">Cra 35a #46-102, Cabecera del Llano, Bucaramanga</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: `Mar&Tierra Restaurant <${FROM_EMAIL}>`,
          to: [recipient],
          subject: `Recordatorio de pago - Reserva ${data.reservationCode}`,
          html: reminderHtml,
        }),
      });
      const result = await res.json();
      return new Response(JSON.stringify({ success: true, id: result.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Reservation released email (cupo liberado por falta de pago)
    if (data.type === 'reservation_released') {
      const releasedHtml = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FDFBF7;border:1px solid rgba(43,24,16,0.08);border-radius:4px;">
        <tr><td style="padding:40px 40px 24px;text-align:center;border-bottom:1px solid rgba(43,24,16,0.08);">
          <p style="margin:0 0 8px;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#8B8680;">Mar &amp; Tierra Restaurant</p>
          <h1 style="margin:0;font-size:24px;font-weight:normal;color:#2B1810;">Reserva Liberada</h1>
        </td></tr>
        <tr><td style="padding:28px 40px;">
          <p style="margin:0 0 18px;font-size:15px;color:#2B1810;line-height:1.6;">Hola <strong>${data.customerName}</strong>, liberamos tu reserva <strong>${data.reservationCode}</strong> porque no recibimos el pago del anticipo dentro de las 24 horas. El cupo quedó disponible nuevamente.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(43,24,16,0.06);border-radius:4px;margin-bottom:20px;">
            <tr><td style="padding:12px 20px;border-bottom:1px solid rgba(43,24,16,0.06);font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8B8680;width:100px;">Fecha</td><td style="padding:12px 20px;border-bottom:1px solid rgba(43,24,16,0.06);font-size:14px;color:#2B1810;">${data.date}</td></tr>
            <tr><td style="padding:12px 20px;border-bottom:1px solid rgba(43,24,16,0.06);font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8B8680;">Hora</td><td style="padding:12px 20px;border-bottom:1px solid rgba(43,24,16,0.06);font-size:14px;color:#2B1810;">${data.time}</td></tr>
            <tr><td style="padding:12px 20px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8B8680;">Salon</td><td style="padding:12px 20px;font-size:14px;color:#2B1810;">${data.salonName || '-'}</td></tr>
          </table>
          <p style="margin:0 0 20px;font-size:14px;color:#3A332E;line-height:1.6;">¿Aún quieres acompañarnos? Puedes reservar de nuevo cuando quieras; recuerda completar el anticipo dentro de las 24 horas para asegurar tu cupo.</p>
          <div style="text-align:center;">
            <a href="https://marytierrarestaurantbga.com/#reservation-info" style="display:inline-block;padding:12px 28px;background:#2B1810;color:#FDFBF7;text-decoration:none;border-radius:3px;font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Reservar de nuevo</a>
          </div>
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid rgba(43,24,16,0.08);text-align:center;">
          <p style="margin:0 0 6px;font-size:13px;font-style:italic;color:#8B8680;">Donde el mar y la tierra se complementan.</p>
          <p style="margin:0;font-size:12px;color:#8B8680;">+57 300 826 3403 &middot; Cra 35a #46-102, Bucaramanga</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: `Mar&Tierra Restaurant <${FROM_EMAIL}>`,
          to: [recipient],
          subject: `Reserva liberada - ${data.reservationCode} — Mar&Tierra Restaurant`,
          html: releasedHtml,
        }),
      });
      const result = await res.json();
      return new Response(JSON.stringify({ success: true, id: result.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Reservation confirmed email (pago verificado por el admin)
    if (data.type === 'reservation_confirmed') {
      const confirmedHtml = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FDFBF7;border:1px solid rgba(43,24,16,0.08);border-radius:4px;">
        <tr><td style="padding:40px 40px 24px;text-align:center;border-bottom:1px solid rgba(43,24,16,0.08);">
          <p style="margin:0 0 8px;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#8B8680;">Mar &amp; Tierra Restaurant</p>
          <h1 style="margin:0;font-size:28px;font-weight:normal;color:#2B1810;letter-spacing:-0.5px;">¡Reserva Confirmada!</h1>
        </td></tr>
        <tr><td style="padding:28px 40px 0;text-align:center;">
          <p style="margin:0 0 4px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#8B8680;">Codigo de reserva</p>
          <p style="margin:0;font-size:20px;font-weight:bold;color:#8B6914;letter-spacing:1px;">${data.reservationCode}</p>
        </td></tr>
        <tr><td style="padding:24px 40px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(74,110,90,0.10);border:1px solid rgba(74,110,90,0.30);border-radius:4px;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0;font-size:14px;color:#2B1810;line-height:1.6;">Confirmamos tu pago. <strong>Tu reserva está asegurada.</strong> Te esperamos.</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(43,24,16,0.06);border-radius:4px;">
            <tr><td style="padding:14px 20px;border-bottom:1px solid rgba(43,24,16,0.06);font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8B8680;width:120px;">Fecha</td><td style="padding:14px 20px;border-bottom:1px solid rgba(43,24,16,0.06);font-size:15px;color:#2B1810;">${data.date}</td></tr>
            <tr><td style="padding:14px 20px;border-bottom:1px solid rgba(43,24,16,0.06);font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8B8680;">Hora</td><td style="padding:14px 20px;border-bottom:1px solid rgba(43,24,16,0.06);font-size:15px;color:#2B1810;">${data.time}</td></tr>
            <tr><td style="padding:14px 20px;border-bottom:1px solid rgba(43,24,16,0.06);font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8B8680;">Personas</td><td style="padding:14px 20px;border-bottom:1px solid rgba(43,24,16,0.06);font-size:15px;color:#2B1810;">${data.partySize}</td></tr>
            <tr><td style="padding:14px 20px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8B8680;">Salon</td><td style="padding:14px 20px;font-size:15px;color:#2B1810;">${data.salonName}</td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 40px 28px;text-align:center;">
          <a href="https://marytierrarestaurantbga.com/mi-reserva.html?code=${data.reservationCode}" style="display:inline-block;padding:12px 28px;background:#2B1810;color:#FDFBF7;text-decoration:none;border-radius:3px;font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Ver mi reserva</a>
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid rgba(43,24,16,0.08);text-align:center;">
          <p style="margin:0 0 6px;font-size:13px;font-style:italic;color:#8B8680;">Donde el mar y la tierra se complementan.</p>
          <p style="margin:0;font-size:12px;color:#8B8680;">+57 300 826 3403 &middot; Cra 35a #46-102, Bucaramanga</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: `Mar&Tierra Restaurant <${FROM_EMAIL}>`,
          to: [recipient],
          subject: `Reserva confirmada - ${data.reservationCode} — Mar&Tierra Restaurant`,
          html: confirmedHtml,
        }),
      });
      const result = await res.json();
      return new Response(JSON.stringify({ success: true, id: result.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Default: new reservation confirmation
    const emailData: ReservationEmail = data;

    // Send to customer
    const customerRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `Mar&Tierra Restaurant <${FROM_EMAIL}>`,
        to: [recipient],
        subject: `Cupo apartado — Reserva ${emailData.reservationCode} — Mar&Tierra Restaurant`,
        html: buildCustomerEmail(emailData),
      }),
    });

    // Send to restaurant admin
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `Reservas Mar&Tierra <${FROM_EMAIL}>`,
        to: [RESTAURANT_EMAIL],
        subject: `Nueva reserva: ${emailData.reservationCode} — ${emailData.customerName}`,
        html: buildAdminNotification(emailData),
      }),
    });

    const result = await customerRes.json();

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
