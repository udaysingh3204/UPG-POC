import { NextResponse } from "next/server";

/**
 * ✅ Handles callback/redirect from Emaar UPG after payment.
 * UPG sends query params like OrderId, Status, StatusMessage, Amount, etc.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // Convert query params into a JS object
  const params = Object.fromEntries(searchParams.entries());

  console.log("📥 Received Payment Callback:", params);

  // Extract key fields safely
  const {
    OrderId,
    Status,
    Amount,
    Currency,
    StatusMessage,
    ReceiptNo,
    PGName,
    ApprovalCode,
  } = params;

  // Optional: You can store this in DB, or trigger any backend logic here

  // ✅ Build redirect URL to frontend dashboard
  // Example: /dashboard/new-book/3?step=3&status=COMPLETED&message=Approved
  const redirectUrl = new URL("https://stgattagentportal.emaar.ae/dashboard/new-book/3");
  redirectUrl.searchParams.set("step", "3");

  if (Status?.toLowerCase() === "success") {
    redirectUrl.searchParams.set("status", "COMPLETED");
    redirectUrl.searchParams.set("message", "Approved");
  } else if (Status?.toLowerCase() === "invalid" || Status?.toLowerCase() === "failed") {
    redirectUrl.searchParams.set("status", "FAILED");
    redirectUrl.searchParams.set("message", StatusMessage || "Payment failed");
  } else {
    redirectUrl.searchParams.set("status", "PENDING");
    redirectUrl.searchParams.set("message", "Awaiting confirmation");
  }

  // Include reference details for record-keeping
  redirectUrl.searchParams.set("transactionNo", params.transactionNo || "");
  redirectUrl.searchParams.set("receiptNo", ReceiptNo || "");
  redirectUrl.searchParams.set("paymentMode", PGName || "");
  redirectUrl.searchParams.set("approvalCode", ApprovalCode || "");
  redirectUrl.searchParams.set("amount", Amount || "0.00");
  redirectUrl.searchParams.set("currency", Currency || "AED");
  redirectUrl.searchParams.set("orderId", OrderId || "");

  console.log("🔁 Redirecting user to:", redirectUrl.toString());

  // 🔁 Redirect the user to the frontend route
  return NextResponse.redirect(redirectUrl.toString(), 302);
}
