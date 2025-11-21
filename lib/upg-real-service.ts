import crypto from "crypto";



const API_KEY = process.env.NEXT_PUBLIC_API_KEY!;
const APP_KEY = process.env.NEXT_PUBLIC_APP_KEY!;
const BASE_URL = process.env.UPG_BASE_URL!;

interface TokenResponse {
  success: boolean;
  token?: string;
  error?: string;
}

export class UPGRealService {
  private token: string | null = null;

  // 1. Generate Real Token
  async generateToken(): Promise<TokenResponse> {
    try {
      console.log('🔑 Generating Real JWT Token...');
      console.log('API Key:', API_KEY);
      console.log('App Key:', APP_KEY);
      console.log('Base URL:', BASE_URL);

      const response = await fetch(`${BASE_URL}/generate/jwt`, {
        method: 'POST',
        headers: {
          'x-api-key': API_KEY,
          'AppKey': APP_KEY,
          'Language': 'EN',
          'Country': 'AE',
          'Content-Type': 'application/json'
        }
      });

      console.log('Response Status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error Response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      // Token is in response headers
      const jwtToken = 
        response.headers.get('jwt-token') ||
        response.headers.get('JWT-Token') || 
        response.headers.get('Jwt-Token');

      if (!jwtToken) {
        throw new Error('JWT token not found in response headers');
      }

      this.token = jwtToken;
      console.log('✅ Token Generated Successfully');

      return {
        success: true,
        token: jwtToken
      };
    } catch (error: any) {
      console.error('❌ Token Generation Failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 2. Initiate Redirect Payment
  async initiateRedirectPayment(paymentData: any): Promise<any> {
    try {
      if (!this.token) {
        const tokenResult = await this.generateToken();
        if (!tokenResult.success) {
          throw new Error('Failed to generate token');
        }
      }

      console.log('💳 Initiating Real Redirect Payment...');

      // const upg_hash = btoa(`${APP_KEY}|${paymentData.order_id}|${paymentData.total_amount}|${paymentData.payment_type}`);



const hashString = `${APP_KEY}|${paymentData.order_id}|${paymentData.total_amount}|${paymentData.payment_type}`;

const upg_hash = crypto
  .createHash("sha256")
  .update(hashString)
  .digest("base64");


      const requestBody = {
        order_id: paymentData.order_id,
        payment_type: paymentData.payment_type,
        total_amount: paymentData.total_amount,
        currency: paymentData.currency || 'AED',
        customer_identifier: paymentData.customer_identifier || '',
        payment_summary: paymentData.payment_summary || [{
          title: 'Payment Details',
          amount: paymentData.total_amount,
          description: 'Test payment'
        }],
        payment_title: paymentData.payment_title || 'Test Payment',
        payment_description: paymentData.payment_description || 'UPG POC Test',
        upg_hash: upg_hash,

        // ✅ REQUIRED FIELDS
  return_url: "https://example.com/payment/success",
  fail_url: "https://example.com/payment/fail",
  status_url: "https://example.com/payment/status"
      };

      console.log('Request Body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${BASE_URL}/payment/initiate`, {
        method: 'POST',
        headers: {
          'x-api-key': API_KEY,
          'AppKey': APP_KEY,
          'jwt-token': this.token!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Response Status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error Response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Payment Initiated:', result);

      return result;
    } catch (error: any) {
      console.error('❌ Payment Initiation Failed:', error);
      return {
        status: 'ERROR',
        error: error.message
      };
    }
  }

  // 3. Initiate Seamless Payment
  async initiateSeamlessPayment(paymentData: any, cardData: any): Promise<any> {
    try {
      if (!this.token) {
        const tokenResult = await this.generateToken();
        if (!tokenResult.success) {
          throw new Error('Failed to generate token');
        }
      }

      console.log('💳 Initiating Real Seamless Payment...');

      const encryptedCardData = btoa(JSON.stringify(cardData));

      const requestBody = {
        order_id: paymentData.order_id,
        payment_type: paymentData.payment_type,
        total_amount: paymentData.total_amount,
        currency: paymentData.currency || 'AED',
        customer_identifier: paymentData.customer_identifier || '',
        payment_data: [{
          type: 'CARD',
          data: encryptedCardData
        }]
      };

      console.log('Request Body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${BASE_URL}/paymentapi/initiate`, {
        method: 'POST',
        headers: {
          'x-api-key': API_KEY,
          'AppKey': APP_KEY,
          'jwt-token': this.token!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Response Status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error Response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Seamless Payment Initiated:', result);

      return result;
    } catch (error: any) {
      console.error('❌ Seamless Payment Failed:', error);
      return {
        status: 'FAILURE',
        error_message: error.message
      };
    }
  }

  // 4. Check Payment Status
  async checkPaymentStatus(orderId: string): Promise<any> {
    try {
      if (!this.token) {
        const tokenResult = await this.generateToken();
        if (!tokenResult.success) {
          throw new Error('Failed to generate token');
        }
      }

      console.log('🔍 Checking Payment Status for:', orderId);

      const response = await fetch(`${BASE_URL}/payment/status`, {
        method: 'POST',
        headers: {
          'x-api-key': API_KEY,
          'AppKey': APP_KEY,
          'jwt-token': this.token!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          OrderId: orderId,
          AppKey: APP_KEY
        })
      });

      console.log('Response Status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error Response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Payment Status:', result);

      return result;
    } catch (error: any) {
      console.error('❌ Status Check Failed:', error);
      return {
        status: 'ERROR',
        error: error.message
      };
    }
  }

  // 5. Get Touchpoint Balance
  async getTouchpointBalance(touchpointData: any): Promise<any> {
    try {
      if (!this.token) {
        const tokenResult = await this.generateToken();
        if (!tokenResult.success) {
          throw new Error('Failed to generate token');
        }
      }

      console.log('💰 Checking Touchpoint Balance...');

      const encryptedData = btoa(JSON.stringify({
        RequestId: `REQ-${Date.now()}`,
        CardNumber: touchpointData.cardNumber,
        CardHolderName: touchpointData.cardHolder,
        ExpiryMonth: touchpointData.expiryMonth,
        ExpiryYear: touchpointData.expiryYear
      }));

      const response = await fetch(`${BASE_URL}/PaymentAPI/GetTouchpointBalance`, {
        method: 'POST',
        headers: {
          'jwt-token': this.token!,
          'AppKey': APP_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          payment_data: encryptedData
        })
      });

      console.log('Response Status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error Response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Touchpoint Balance:', result);

      return result;
    } catch (error: any) {
      console.error('❌ Touchpoint Balance Failed:', error);
      return {
        status: 'FAILURE',
        error_message: error.message,
        total_points: '0',
        equivalent_amount: '0.00'
      };
    }
  }

  // 6. Reverse Touchpoint
  async reverseTouchpoint(orderId: string, amount: string): Promise<any> {
    try {
      if (!this.token) {
        const tokenResult = await this.generateToken();
        if (!tokenResult.success) {
          throw new Error('Failed to generate token');
        }
      }

      console.log('🔄 Reversing Touchpoint...');

      const response = await fetch(`${BASE_URL}/paymentapi/TPReversal`, {
        method: 'POST',
        headers: {
          'jwt-token': this.token!,
          'AppKey': APP_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          order_id: orderId,
          amount: amount
        })
      });

      console.log('Response Status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error Response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Touchpoint Reversed:', result);

      return result;
    } catch (error: any) {
      console.error('❌ Touchpoint Reversal Failed:', error);
      return {
        status: 'FAILURE',
        error_message: error.message
      };
    }
  }
}

export const upgRealService = new UPGRealService();