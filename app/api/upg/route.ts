import { NextResponse } from "next/server";
import axios from "axios";
import crypto from "crypto";
import fs from "fs";
import https from "https";

let httpsAgent: any = undefined;

// Load certificate chain for production only
if (process.env.NODE_ENV === "production") {
  const emaarCertChain = fs.readFileSync("./certs/emaar-apigee-chain.pem");
  httpsAgent = new https.Agent({ ca: emaarCertChain });
}

// 🌍 Base configuration
const BASE_URL = process.env.UPG_BASE_URL || "https://apidev.emaar.com/pgs";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY!;
const APP_KEY = process.env.NEXT_PUBLIC_APP_KEY!;

// 🔐 Emaar RSA Public Key (for encryption)
const EMAAR_PUBLIC_KEY = `
-----BEGIN PUBLIC KEY-----
MIIBITANBgkqhkiG9w0BAQEFAAOCAQ4AMIIBCQKCAQBplKMtsTnUG8wrFD4GB6LvDqowA3hblUXYP+rgAKajV32iwC7xVb3k01KeQwQRIvw2E9TwMiJApuD0n2Iur4sJ2AWrWOEK5OTMx8LrknP/QGt/2Smu9Jju0wrwD2GzZo4JCoMjXJ/I03YrNCMmkgK7Ci8j9y0+Bq+ltbfTjJd3Nt7ZZLRfsjw+JztPZ7kWEt3AIf5k731ZaKWJF/uMVb7iv5XjX+Pkk5zYyX0Py6guSZdUpe2i1vwdp9ivpIzLLim3mjpTfzI04VZxSOShUPY44ghv7tr93ZuocYLlNW1nusxYmVnU31gabj6AVHCNUtc2Tzd+vH7IiW35yrR9hm7jAgMBAAE=
-----END PUBLIC KEY-----
`;

// 🔐 Helper: RSA encryption for sensitive data
function encryptRSA(data: any) {
  const text = typeof data === "string" ? data : JSON.stringify(data);
  const encrypted = crypto.publicEncrypt(
    { key: EMAAR_PUBLIC_KEY, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(text)
  );
  return encrypted.toString("base64");
}

// 💰 Helper: always return string with 2 decimal places (Emaar format)
function formatAmount(value: any) {
  const num = parseFloat(value);
  return isNaN(num) ? "0.00" : num.toFixed(2);
}

export async function POST(req: Request) {
  try {
    const { action, data } = await req.json();

    // ===========================================================
    // STEP 1️⃣ Generate JWT Token
    // ===========================================================
    if (action === "generateToken") {
      const response = await axios.post(`${BASE_URL}/generate/jwt`, {}, {
        headers: {
          "x-api-key": API_KEY,
          "AppKey": APP_KEY,
          "Language": "EN",
          "Country": "AE",
        },
        httpsAgent,
      });

      const jwtToken =
        response.headers["jwt-token"] ||
        response.headers["Jwt-Token"] ||
        response.headers["JWT-Token"];

      console.log("✅ JWT Token Generated:", jwtToken?.slice(0, 40) + "...");
      return NextResponse.json({ success: true, token: jwtToken });
    }

    // ===========================================================
    // STEP 2️⃣ Initiate Payment (Redirect / Seamless)
    // ===========================================================
    if (action === "initiateRedirect" || action === "initiateSeamless") {
      const jwtToken =
        req.headers.get("jwt-token") ||
        data?.jwtToken ||
        process.env.NEXT_PUBLIC_JWT_TOKEN ||
        "";

      if (!jwtToken) {
        return NextResponse.json(
          { status: "ERROR", error: "Missing jwt-token" },
          { status: 400 }
        );
      }

      // 🔒 Encrypt card data (if provided)
      let paymentData = [];
      if (data.cardData) {
        const encryptedCardData = encryptRSA({
          cardNumber: data.cardData.cardNumber,
          cardHolder: data.cardData.cardHolder,
          expiryMonth: data.cardData.expiryMonth,
          expiryYear: data.cardData.expiryYear,
          cvv: data.cardData.cvv,
        });
        paymentData = [{ type: "CARD", data: encryptedCardData }];
      }

      // 🧾 Build other_paramaters (base64 encoded)
      const otherParams = {
        lang: "en",
        "x-tenant-key": "Jtb5ePReM4T7hwvvX0MAuQXycoyxLCRH",
        "x-apikey": "GWc3wBKA59iBhTJLDuTc3oue0tc2jqh2",
        paymentMethod: "CreditCard",
      };
      const encodedOtherParams = Buffer.from(JSON.stringify(otherParams)).toString("base64");

      const paymentSource = data.paymentData || data;

      // ✅ Construct payload (Emaar expected format)
      const payload = {
        order_id: paymentSource.order_id,
        payment_type: paymentSource.payment_type || "AT THE TOP PAYMENT",
        total_amount: Number(paymentSource.total_amount || 0), // ✅ formatted safely
        customer_identifier: paymentSource.customer_identifier || "customer@example.com",
        other_paramaters: encodedOtherParams,
        payment_data: paymentData,
        CallbackURL:
          // "https://stgattagentportal.emaar.ae/api/upg/processResponse?lang=en&x-tenant-key=Jtb5ePReM4T7hwvvX0MAuQXycoyxLCRH&x-apikey=GWc3wBKA59iBhTJLDuTc3oue0tc2jqh2",
          "https://stgattagentportal.emaar.ae/api/payment/processResponse",
      };

      console.log("🚀 Sending Payload to /paymentAPI/initiate:", JSON.stringify(payload, null, 2));

      const response = await axios.post(`${BASE_URL}/paymentAPI/initiate`, payload, {
        headers: {
          "x-api-key": API_KEY,
          "AppKey": APP_KEY,
          "jwt-token": jwtToken,
          "Content-Type": "application/json",
        },
        validateStatus: () => true,
      });

      console.log("📦 UPG Response:", response.data);
      return NextResponse.json(response.data);
    }

    // ===========================================================
    // STEP 3️⃣ Check Payment Status
    // ===========================================================
    if (action === "checkStatus") {
      const jwtToken =
        req.headers.get("jwt-token") ||
        data?.jwtToken ||
        process.env.NEXT_PUBLIC_JWT_TOKEN ||
        "";

      if (!jwtToken) {
        return NextResponse.json(
          { status: "ERROR", error: "Missing jwt-token" },
          { status: 400 }
        );
      }

      console.log(`🔍 Checking payment status for Order ID: ${data.orderId}`);

      const payload = {
        OrderId: data.orderId, // ✅ case-sensitive key
        AppKey: APP_KEY,
      };

      const response = await axios.post(`${BASE_URL}/payment/status`, payload, {
        headers: {
          "x-api-key": API_KEY,
          "AppKey": APP_KEY,
          "jwt-token": jwtToken,
          "Content-Type": "application/json",
        },
        validateStatus: () => true,
      });

      console.log("📦 Payment Status Response:", JSON.stringify(response.data, null, 2));

      if (!response.data || Object.keys(response.data).length === 0) {
        return NextResponse.json({
          status: "PENDING",
          message: "Payment not yet processed or invalid Order ID.",
          order_id: data.orderId,
        });
      }

      return NextResponse.json(response.data);
    }

    // ===========================================================
    // STEP 4️⃣ Touchpoint Balance
    // ===========================================================
    if (action === "touchpointBalance") {
      const response = await axios.post(`${BASE_URL}/PaymentAPI/GetTouchpointBalance`, data, {
        headers: {
          "x-api-key": API_KEY,
          "AppKey": APP_KEY,
        },
        validateStatus: () => true,
      });
      console.log("💰 Touchpoint Balance Response:", response.data);
      return NextResponse.json(response.data);
    }

    // ===========================================================
    // STEP 5️⃣ Touchpoint Reversal
    // ===========================================================
    if (action === "touchpointReversal") {
      const response = await axios.post(`${BASE_URL}/paymentAPI/TPReversal`, data, {
        headers: {
          "x-api-key": API_KEY,
          "AppKey": APP_KEY,
        },
        validateStatus: () => true,
      });
      console.log("↩️ Touchpoint Reversal Response:", response.data);
      return NextResponse.json(response.data);
    }

    // ===========================================================
    // Fallback: Unknown action
    // ===========================================================
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  } catch (error: any) {
    console.error("💥 Error:", error?.response?.data || error.message);
    return NextResponse.json(
      { status: "ERROR", error: error?.response?.data || error.message },
      { status: 500 }
    );
  }
}
