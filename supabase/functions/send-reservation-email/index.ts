import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "reservas@marytierrarestaurantbga.com";
const RESTAURANT_EMAIL = "marytierrarestaurantbga@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
          <h1 style="margin:0;font-size:28px;font-weight:normal;color:#2B1810;letter-spacing:-0.5px;">Reserva Registrada</h1>
        </td></tr>

        <!-- Code -->
        <tr><td style="padding:28px 40px 0;text-align:center;">
          <p style="margin:0 0 4px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#8B8680;">Codigo de reserva</p>
          <p style="margin:0;font-size:20px;font-weight:bold;color:#8B6914;letter-spacing:1px;">${data.reservationCode}</p>
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
              <p style="margin:0 0 12px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#8B8680;">Siguiente paso</p>
              <p style="margin:0 0 8px;font-size:14px;color:#3A332E;line-height:1.6;">1. Realiza la transferencia de <strong>${formatPrice(data.depositAmount)}</strong></p>
              <p style="margin:0 0 16px;font-size:14px;color:#3A332E;line-height:1.6;">2. Envia el comprobante por WhatsApp al <strong>300 826 3403</strong></p>
              <p style="margin:0 0 4px;font-size:14px;color:#2B1810;"><strong>Bancolombia</strong> - Cuenta Corriente</p>
              <p style="margin:0 0 2px;font-size:14px;color:#3A332E;">No. Cuenta: <strong>30200003995</strong></p>
              <p style="margin:0 0 2px;font-size:14px;color:#3A332E;">NIT: 901857854</p>
              <p style="margin:0;font-size:14px;color:#3A332E;">Titular: MYT RESTAURANT SAS</p>
            </td></tr>
          </table>
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const data = await req.json();

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
          to: [data.customerEmail],
          subject: `Recordatorio de pago - Reserva ${data.reservationCode}`,
          html: reminderHtml,
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
        to: [emailData.customerEmail],
        subject: `Reserva ${emailData.reservationCode} — Mar&Tierra Restaurant`,
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
