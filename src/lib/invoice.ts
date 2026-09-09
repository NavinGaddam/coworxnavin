import { jsPDF } from "jspdf";
import { Booking, spaceLabel } from "../pages/types";

function money(n: number) {
  return `Rs. ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function downloadInvoice(b: Booking, company: any) {
  const hasGst = !!String(company?.gstNumber || "").trim();
  const gstRate = Number(company?.gstRate || 0);
  const total = Number(b.total || 0);
  const addonTotal = (b.addons || []).reduce(
    (n, a) => n + Number(a.total || 0),
    0,
  );
  const gstBase = hasGst && gstRate > 0 ? total / (1 + gstRate / 100) : total;
  const gstAmount = hasGst && gstRate > 0 ? total - gstBase : 0;
  const cgst = gstAmount / 2,
    sgst = gstAmount / 2;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = 56;
  const line = () => {
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageW - margin, y);
    y += 18;
  };
  const label = (t: string) => {
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(t.toUpperCase(), margin, y);
    y += 13;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(20);
  doc.text(company?.name || "Coworx Central", margin, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  const addressLines = doc.splitTextToSize(
    company?.address || "Solapur City, Maharashtra",
    270,
  );
  doc.text(addressLines, margin, y);
  y += addressLines.length * 14;
  if (company?.phone)
    (doc.text(`Phone: ${company.phone}`, margin, y), (y += 14));
  if (hasGst) (doc.text(`GSTIN: ${company.gstNumber}`, margin, y), (y += 14));
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.text(hasGst ? "TAX INVOICE" : "RECEIPT", pageW - margin, 56, {
    align: "right",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(
    `Invoice: ${b.invoiceNumber || b.id.slice(0, 8).toUpperCase()}`,
    pageW - margin,
    76,
    { align: "right" },
  );
  doc.text(
    `Date: ${b.confirmedAt?.toDate?.()?.toLocaleDateString?.("en-IN") || b.date}`,
    pageW - margin,
    90,
    { align: "right" },
  );

  y += 10;
  line();
  label("Billed to");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text(b.customerName || b.customerEmail || "Customer", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  if (b.customerEmail) (doc.text(b.customerEmail, margin, y), (y += 14));
  if (b.customerPhone) (doc.text(b.customerPhone, margin, y), (y += 14));
  y += 6;
  line();

  label("Service");
  doc.setFontSize(10);
  doc.setTextColor(30);
  const cols = [margin, margin + 220, margin + 340, pageW - margin];
  doc.setFont("helvetica", "bold");
  doc.text("Description", cols[0], y);
  doc.text("Period", cols[1], y);
  doc.text("Qty", cols[2], y);
  doc.text("Amount", cols[3], y, { align: "right" });
  y += 8;
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  const period =
    b.endDate && b.endDate !== b.date ? `${b.date} - ${b.endDate}` : b.date;
  const qty =
    b.start && b.durationHours
      ? `${b.durationHours} hrs`
      : b.days
        ? `${b.days} day${b.days === 1 ? "" : "s"}`
        : b.durationHours
          ? `${b.durationHours} hr${b.durationHours === 1 ? "" : "s"}`
          : "1";
  doc.text(spaceLabel(b.space) + (b.label ? ` (${b.label})` : ""), cols[0], y, {
    maxWidth: 200,
  });
  doc.text(period, cols[1], y);
  doc.text(qty, cols[2], y);
  doc.text(money(Number(b.base || total)), cols[3], y, { align: "right" });
  y += 20;
  for (const a of b.addons || []) {
    doc.text(a.name, cols[0], y);
    doc.text("-", cols[1], y);
    doc.text(String(a.qty), cols[2], y);
    doc.text(money(a.total), cols[3], y, { align: "right" });
    y += 18;
  }
  y += 6;
  line();

  const totalsX = pageW - margin - 240;
  const row = (l: string, v: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 12 : 10);
    doc.setTextColor(bold ? 20 : 90);
    doc.text(l, totalsX, y);
    doc.text(v, pageW - margin, y, { align: "right" });
    y += bold ? 20 : 16;
  };
  if (Number(b.discount || 0) > 0) row("Discount", `- ${money(b.discount)}`);
  if (Number(b.staffDiscount || 0) > 0)
    row("Staff discount", `- ${money(Number(b.staffDiscount))}`);
  if (addonTotal > 0) row("Add-ons", money(addonTotal));
  if (hasGst && gstRate > 0) {
    row("Taxable value", money(gstBase));
    row(`CGST (${(gstRate / 2).toFixed(1)}%)`, money(cgst));
    row(`SGST (${(gstRate / 2).toFixed(1)}%)`, money(sgst));
  }
  y += 4;
  doc.setDrawColor(150);
  doc.line(totalsX, y, pageW - margin, y);
  y += 18;
  row("Total", money(total), true);
  row("Payment status", b.paymentStatus || "Pending");
  row("Amount received", money(Number(b.paymentReceived || 0)));
  row("Amount due", money(Math.max(0, total - Number(b.paymentReceived || 0))));

  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(140);
  doc.text(
    "Working hours: 9:00 AM - 7:00 PM. Thank you for choosing " +
      (company?.name || "Coworx Central") +
      ".",
    margin,
    y,
  );
  if (hasGst) {
    y += 14;
    doc.text("This is a system-generated tax invoice.", margin, y);
  }

  doc.save(`${b.invoiceNumber || b.id.slice(0, 8)}-invoice.pdf`);
}
