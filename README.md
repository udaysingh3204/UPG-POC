# UPG Payment Gateway POC

A complete Payment Gateway Proof of Concept (POC) built using **Next.js**, **TypeScript**, and **Emaar UPG APIs**. This project demonstrates:

* JWT token generation
* Redirect payment flow
* Seamless payment flow (card encryption + 3DS)
* Payment status polling
* ADCB Touchpoint balance & reversal
* SSL certificate pinning (Apigee)
* Real API integration setup

---

## 🚀 Features

* Full UI for Redirect & Seamless payment
* 3DS pop-up detection and status auto-polling
* RSA encryption for card data (PKCS#1 v1.5)
* Touchpoint balance & reversal
* Configurable for **Mock** and **Real API** modes
* Supports Emaar’s new SSL certificate chain

---

## 📂 Project Structure

```
app/
  api/upg/route.ts      → Backend API for UPG
  page.tsx              → Payment UI
certs/
  emaar-apigee-chain.pem
lib/
  encryptCard.ts        → RSA encryption utils
  upgService.ts         → API service wrapper
```

---

## 🛠️ Setup Instructions

Follow these steps to run the project locally.

### **1. Clone the repository**

```bash
git clone <YOUR_REPO_URL>
cd upg-poc
```

### **2. Install dependencies**

```bash
npm install
```

### **3. Add Environment Variables**

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_API_KEY=xxxxxxxxxx
NEXT_PUBLIC_APP_KEY=xxxxxxxxxx
UPG_BASE_URL=https://apidev.emaar.com/pgs
NODE_ENV=development
```

For production:

```env
NODE_ENV=production
```

---

## 🔐 SSL Certificate Setup (Production Only)

1. Create a `certs/` folder at project root.
2. Paste the **full certificate chain** provided by Emaar into:

```
certs/emaar-apigee-chain.pem
```

3. The backend API automatically loads pinned certificates when **NODE_ENV=production**.

---

## ▶️ Running the Project

### Development Mode

```bash
npm run dev
```

UI will be available at:

```
http://localhost:3000
```

### Production Build

```bash
npm run build
npm start
```

---

## 🔧 API Flow Overview

### 1. Generate Token

```
POST /api/upg { action: "generateToken" }
```

### 2. Initiate Redirect or Seamless Payment

```
POST /api/upg { action: "initiateRedirect" }
```

### 3. Poll Payment Status

```
POST /api/upg { action: "checkStatus" }
```

### 4. Touchpoint Balance / Reversal

```
POST /api/upg { action: "touchpointBalance" }
```

---

## 📦 Build & Deploy

You can deploy on:

* Vercel
* AWS EC2
* Azure Web App
* Docker

Ensure production `.env` contains:

```
NODE_ENV=production
```

and your cert file exists:

```
certs/emaar-apigee-chain.pem
```

---

## 🤝 Contributions

Open PRs and issue reports are welcome.

---

## 📜 License

MIT License.
