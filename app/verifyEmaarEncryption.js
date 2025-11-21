import crypto from "crypto";

const publicKey = `
-----BEGIN PUBLIC KEY-----
MIIBITANBgkqhkiG9w0BAQEFAAOCAQ4AMIIBCQKCAQBplKMtsTnUG8wrFD4GB6LvDqowA3hblUXYP+rgAKajV32iwC7xVb3k01KeQwQRIvw2E9TwMiJApuD0n2Iur4sJ2AWrWOEK5OTMx8LrknP/QGt/2Smu9Jju0wrwD2GzZo4JCoMjXJ/I03YrNCMmkgK7Ci8j9y0+Bq+ltbfTjJd3Nt7ZZLRfsjw+JztPZ7kWEt3AIf5k731ZaKWJF/uMVb7iv5XjX+Pkk5zYyX0Py6guSZdUpe2i1vwdp9ivpIzLLim3mjpTfzI04VZxSOShUPY44ghv7tr93ZuocYLlNW1nusxYmVnU31gabj6AVHCNUtc2Tzd+vH7IiW35yrR9hm7jAgMBAAE=
-----END PUBLIC KEY-----
`;

// Card JSON (Emaar expects a nested encrypted JSON string)
const cardPayload = {
  CardNumber: "5420187505091559",
  CardHolderName: "TEST",
  ExpiryMonth: "02",
  ExpiryYear: "2026",
  CVV: "123",
  SaveCard: "true",
  Currency: "AED",
  Amount: 295,
};

const plaintext = JSON.stringify(cardPayload);
console.log("🔓 Plaintext:", plaintext);

const encrypted = crypto.publicEncrypt(
  {
    key: publicKey,
    padding: crypto.constants.RSA_PKCS1_PADDING, // ⚠️ UPG uses PKCS#1 v1.5, not OAEP
  },
  Buffer.from(plaintext)
);

console.log("🔐 Encrypted Base64:\n", encrypted.toString("base64"));
