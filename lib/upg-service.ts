import axios from 'axios';
import { mockEncrypt, createUpgHash } from './utils';

const BASE_URL = process.env.NEXT_PUBLIC_UPG_BASE_URL;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
const APP_KEY = process.env.NEXT_PUBLIC_APP_KEY;

class UPGService {
  private token: string | null = null;

  // 1. Generate Token
  async generateToken() {
    try {
      const response = await axios.post(
        `${BASE_URL}/pgs/generate/jwt`,
        {},
        {
          headers: {
            'x-api-key': API_KEY,
            'AppKey': APP_KEY,
            'Language': 'EN',
            'Country': 'AE'
          }
        }
      );
      
      this.token = response.headers['jwt-token'];
      return { success: true, token: this.token };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // 2. Redirect Flow - Payment Initiate
  async initiateRedirectPayment(paymentData: any) {
    if (!this.token) await this.generateToken();

    const upg_hash = createUpgHash(
      APP_KEY!,
      paymentData.order_id,
      paymentData.total_amount,
      paymentData.payment_type
    );

    try {
      const response = await axios.post(
        `${BASE_URL}/pgs/payment/initiate`,
        {
          ...paymentData,
          upg_hash,
          currency: 'AED'
        },
        {
          headers: {
            'x-api-key': API_KEY,
            'AppKey': APP_KEY,
            'jwt-token': this.token
          }
        }
      );
      
      return response.data;
    } catch (error: any) {
      return { status: 'ERROR', error: error.message };
    }
  }

  // 3. Seamless Flow - Payment Initiate
  async initiateSeamlessPayment(paymentData: any, cardData: any) {
    if (!this.token) await this.generateToken();

    const encryptedCard = mockEncrypt(cardData);

    try {
      const response = await axios.post(
        `${BASE_URL}/pgs/paymentapi/initiate`,
        {
          order_id: paymentData.order_id,
          payment_type: paymentData.payment_type,
          total_amount: paymentData.total_amount,
          currency: 'AED',
          payment_data: [
            {
              type: 'CARD',
              data: encryptedCard
            }
          ]
        },
        {
          headers: {
            'x-api-key': API_KEY,
            'AppKey': APP_KEY,
            'jwt-token': this.token
          }
        }
      );
      
      return response.data;
    } catch (error: any) {
      return { status: 'FAILURE', error_message: error.message };
    }
  }

  // 4. Check Payment Status
  async checkPaymentStatus(orderId: string) {
    if (!this.token) await this.generateToken();

    try {
      const response = await axios.post(
        `${BASE_URL}/pgs/payment/status`,
        {
          OrderId: orderId,
          AppKey: APP_KEY
        },
        {
          headers: {
            'x-api-key': API_KEY,
            'AppKey': APP_KEY,
            'jwt-token': this.token
          }
        }
      );
      
      return response.data;
    } catch (error: any) {
      return { status: 'ERROR', error: error.message };
    }
  }

  // 5. ADCB Touchpoint Balance
  async getTouchpointBalance(touchpointData: any) {
    if (!this.token) await this.generateToken();

    const encryptedData = mockEncrypt({
      RequestId: `REQ-${Date.now()}`,
      CardNumber: touchpointData.cardNumber,
      CardHolderName: touchpointData.cardHolder,
      ExpiryMonth: touchpointData.expiryMonth,
      ExpiryYear: touchpointData.expiryYear
    });

    try {
      const response = await axios.post(
        `${BASE_URL}/pgs/paymentapi/CheckTouchPointBalance`,
        { payment_data: encryptedData },
        {
          headers: {
            'jwt-token': this.token,
            'AppKey': APP_KEY
          }
        }
      );
      
      return response.data;
    } catch (error: any) {
      return { 
        status: 'FAILURE', 
        error_message: error.message,
        total_points: '0',
        equivalent_amount: '0.00'
      };
    }
  }

  // 6. Touchpoint Reversal
  async reverseTouchpoint(orderId: string, amount: string) {
    if (!this.token) await this.generateToken();

    try {
      const response = await axios.post(
        `${BASE_URL}/pgs/paymentapi/TPReversal`,
        { order_id: orderId, amount },
        {
          headers: {
            'jwt-token': this.token,
            'AppKey': APP_KEY
          }
        }
      );
      
      return response.data;
    } catch (error: any) {
      return { status: 'FAILURE', error_message: error.message };
    }
  }
}

export const upgService = new UPGService();