import { formatDateTime } from "@/lib/business-day";
import { formatBRL } from "@/lib/money";
import type { TicketData } from "@/lib/types";

// Ficha para impressora térmica (58 ou 80 mm). Só aparece na impressão
// (ver .print-ticket em styles/totem.css).

export function PrintTicket({ ticket, paperWidthMm }: { ticket: TicketData; paperWidthMm: 58 | 80 }) {
  const narrow = paperWidthMm === 58;
  const rule = <div style={{ borderTop: "1px dashed #000", margin: "2.5mm 0" }} />;

  return (
    <div
      className="print-ticket"
      style={{ ["--paper" as string]: narrow ? "48mm" : "72mm", fontSize: narrow ? "8pt" : "9.5pt" }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: narrow ? "11pt" : "13pt", fontWeight: 900, textTransform: "uppercase" }}>
          {ticket.eventName}
        </div>
        {ticket.venue && <div>{ticket.venue}</div>}
        <div>{formatDateTime(ticket.paidAt)}</div>
      </div>

      {rule}

      <div style={{ textAlign: "center" }}>
        <div style={{ fontWeight: 700, letterSpacing: "0.2em" }}>SENHA</div>
        <div style={{ fontSize: narrow ? "30pt" : "40pt", fontWeight: 900, lineHeight: 1.05 }}>{ticket.ticketCode}</div>
        {ticket.kind === "reprint" && <div style={{ fontWeight: 700 }}>*** REIMPRESSÃO ***</div>}
      </div>

      {rule}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {ticket.items.map((item, i) => (
            <tr key={i}>
              <td style={{ verticalAlign: "top", paddingRight: "1.5mm", whiteSpace: "nowrap", fontWeight: 700 }}>
                {item.quantity}x
              </td>
              <td style={{ verticalAlign: "top", width: "100%" }}>{item.name}</td>
              <td style={{ verticalAlign: "top", whiteSpace: "nowrap", textAlign: "right", paddingLeft: "1.5mm" }}>
                {formatBRL(item.quantity * item.unitPriceCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {rule}

      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: narrow ? "10pt" : "12pt" }}>
        <span>TOTAL</span>
        <span>{formatBRL(ticket.totalCents)}</span>
      </div>
      <div>Pago com Pix{ticket.pixRef ? ` · ref. ${ticket.pixRef}` : ""}</div>

      {rule}

      <div style={{ textAlign: "center" }}>
        <div style={{ fontWeight: 700 }}>Apresente esta ficha no balcão.</div>
        <div>Comprovante sem valor fiscal.</div>
      </div>
    </div>
  );
}
