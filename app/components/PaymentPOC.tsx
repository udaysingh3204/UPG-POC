'use client';

import React, { useState } from 'react';
import {
  CreditCard,
  CheckCircle,
  AlertCircle,
  Code,
  Smartphone,
  ArrowRight
} from 'lucide-react';

type FlowType = 'redirect' | 'seamless' | 'touchpoints' | 'docs';

interface ResponseType {
  token: any;
  initiate: any;
  status: any;
  touchpoint: any;
}

export default function PaymentPOC() {
  const [activeTab, setActiveTab] = useState<FlowType>('redirect');
  const [environment, setEnvironment] = useState('dev');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useRealAPI, setUseRealAPI] = useState(false);

  const config = {
    apiKey: process.env.NEXT_PUBLIC_API_KEY || '',
    appKey: process.env.NEXT_PUBLIC_APP_KEY || '',
    language: 'EN',
    country: 'AE'
  };

  const [paymentData, setPaymentData] = useState({
    orderId: `ORD-${Date.now()}`,
    paymentType: 'AT THE TOP PAYMENT',
    amount: '100.00',
    currency: 'AED',
    customerIdentifier: 'customer@example.com'
  });

  const [cardData, setCardData] = useState({
    cardNumber: '5420187505091559',
    cardHolder: 'JOHN DOE',
    expiryMonth: '12',
    expiryYear: '2025',
    cvv: '123'
  });

  const [touchpointData, setTouchpointData] = useState({
    cardNumber: '5420187505091559',
    cardHolder: 'HAIDER',
    expiryMonth: '02',
    expiryYear: '2024'
  });

  const [responses, setResponses] = useState<ResponseType>({
    token: null,
    initiate: null,
    status: null,
    touchpoint: null
  });

  const [transactionHistory, setTransactionHistory] = useState<any[]>([]);

  const logTransaction = (data: any) => {
    setTransactionHistory((prev) =>
      [
        {
          id: Date.now(),
          orderId: data.orderId,
          amount: data.amount,
          status: data.status,
          timestamp: new Date().toLocaleString(),
          ...data
        },
        ...prev
      ].slice(0, 10)
    );
  };

  const getBaseUrl = () => process.env.NEXT_PUBLIC_UPG_BASE_URL;

  // 🔄 Auto-poll the backend for payment status every 5 seconds
async function pollPaymentStatus(orderId: string, jwtToken: string) {
  const maxRetries = 24; // 24 × 5 = 2 minutes total
  let retries = 0;

  console.log(`⏳ Starting payment-status polling for ${orderId}`);

  const interval = setInterval(async () => {
    retries++;

    const res = await fetch('/api/upg', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'jwt-token': jwtToken,
      },
      body: JSON.stringify({
        action: 'checkStatus',
        useRealAPI: true,
        data: { orderId },
      }),
    });

    const data = await res.json();
    console.log('🔄 Payment status check:', data);
    setResponses((prev) => ({ ...prev, status: data }));

    if (data.paymentStatus === 'Captured' || data.statusMessage?.includes('Approved')) {
      clearInterval(interval);
      setStep(4);
      alert(`✅ Payment Captured! Amount AED ${data.authorizedAmount}`);
    } else if (data.paymentStatus === 'Failed' || data.statusMessage?.includes('Declined')) {
      clearInterval(interval);
      setStep(4);
      alert('❌ Payment Failed. Please try again.');
    } else if (retries >= maxRetries) {
      clearInterval(interval);
      console.log('⚠️ Payment status timeout.');
      alert('Payment check timed out. Please verify later.');
    } else {
      console.log('🕒 Waiting for user to complete 3DS...');
    }
  }, 5000);
}

  /** 🔑 Generate Token & Store Locally */
  const generateToken = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/upg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateToken',
          useRealAPI
        })
      });

      const result = await response.json();

      // store JWT token
      const token =
        result.token ||
        result.jwtToken ||
        result['jwt-token'] ||
        result?.headers?.['jwt-token'];

      if (token) {
        localStorage.setItem('upg_jwt_token', token);
        console.log('✅ JWT Token stored:', token);
      }

      if (result.success || result.status === 'SUCCESS') {
        setResponses((prev) => ({
          ...prev,
          token: {
            ...result,
            mode: useRealAPI ? 'REAL API' : 'MOCK'
          }
        }));
        setStep(2);
      } else {
        throw new Error(result.error || 'Token generation failed');
      }
    } catch (error: any) {
      setError(`Token Generation Failed: ${error.message}`);
      setResponses((prev) => ({
        ...prev,
        token: { status: 'ERROR', error: error.message }
      }));
    } finally {
      setLoading(false);
    }
  };

/** 💳 Redirect Payment */
const initiateRedirectPayment = async () => {
  setLoading(true);
  setError(null);
  try {
    const jwtToken = localStorage.getItem('upg_jwt_token') || '';
    if (!jwtToken) {
      throw new Error('Missing JWT token — please generate one first.');
    }

    console.log('🚀 Using JWT Token:', jwtToken);

    const response = await fetch('/api/upg', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'jwt-token': jwtToken, // ✅ Pass it in header
      },
      body: JSON.stringify({
        action: 'initiateRedirect',
        useRealAPI,
        data: {
          useRealAPI: useRealAPI,
          order_id: paymentData.orderId,
          payment_type: paymentData.paymentType,
          total_amount: Number(paymentData.amount),
          currency: 'AED',
          customer_identifier: paymentData.customerIdentifier,
          payment_summary: [
            {
              title: 'Payment Details',
              amount: paymentData.amount,
              description: 'Test payment',
            },
          ],
          payment_title: 'Test Payment',
          payment_description: 'UPG POC Test',
          jwtToken, // ✅ Also include in body (for safety)
        },
      }),
    });

    const result = await response.json();
    console.log('📦 Redirect Response:', result);

    setResponses((prev) => ({
      ...prev,
      initiate: {
        ...result,
        mode: useRealAPI ? 'REAL API' : 'MOCK',
      },
    }));

    if (result.status === 'SUCCESS') {
      setStep(3);
      pollPaymentStatus(paymentData.orderId, jwtToken);
    } else {
      throw new Error(result.error || 'Payment initiation failed');
    }
  } catch (error: any) {
    setError(`Payment Initiation Failed: ${error.message}`);
    setResponses((prev) => ({
      ...prev,
      initiate: { status: 'ERROR', error: error.message },
    }));
  } finally {
    setLoading(false);
  }
};

  /** 💳 Seamless Payment (Card Entry) */
  /** 💳 Seamless Payment (Card Entry + Auto 3DS Flow) */
const initiateSeamlessPayment = async () => {
  setLoading(true);
  setError(null);
  try {
    const jwtToken = localStorage.getItem('upg_jwt_token') || '';
    if (!jwtToken) {
      throw new Error('Missing JWT token — please generate one first.');
    }

    const response = await fetch('/api/upg', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'jwt-token': jwtToken
      },
      body: JSON.stringify({
        action: 'initiateSeamless',
        useRealAPI,
        data: {
          paymentData: {
            order_id: paymentData.orderId,
            payment_type: paymentData.paymentType,
            total_amount: Number(paymentData.amount),
            currency: 'AED',
            customer_identifier: paymentData.customerIdentifier
          },
          cardData
        }
      })
    });

    const result = await response.json();
    console.log('📦 Seamless Init Response:', result);

    setResponses((prev) => ({
      ...prev,
      initiate: {
        ...result,
        mode: useRealAPI ? 'REAL API' : 'MOCK'
      }
    }));

    if (result.status === 'SUCCESS') {
      console.log('🚀 Payment initiated successfully!');

      // ✅ Step 1: Open 3DS page if auth_url present
      if (result.auth_url) {
        console.log('🌐 Opening 3DS auth URL:', result.auth_url);
        const popup = window.open(
          result.auth_url,
          'UPG Payment Authentication',
          'width=600,height=700,left=450,top=150'
        );

        // ✅ Step 2: Start polling payment status in background
        console.log(`⏳ Polling status for order ${paymentData.orderId}`);
        const pollTimer = setTimeout(() => {
          pollPaymentStatus(paymentData.orderId, jwtToken);
        }, 2000);

        // ✅ Step 3: Detect popup close (user done/cancelled)
        const popupChecker = setInterval(() => {
          if (popup && popup.closed) {
            clearInterval(popupChecker);
            clearTimeout(pollTimer);
            console.log('🧾 Popup closed by user — verifying payment...');
            pollPaymentStatus(paymentData.orderId, jwtToken);
          }
        }, 3000);
      }

      setStep(3);
    } else {
      throw new Error(result.error_message || 'Payment initiation failed');
    }
  } catch (error: any) {
    console.error('💥 Seamless Payment Error:', error.message);
    setError(`Seamless Payment Failed: ${error.message}`);
    setResponses((prev) => ({
      ...prev,
      initiate: { status: 'FAILURE', error_message: error.message }
    }));
  } finally {
    setLoading(false);
  }
};


  /** 🔍 Check Payment Status */
  // const checkPaymentStatus = async () => {
  //   setLoading(true);
  //   setError(null);
  //   try {
  //     const jwtToken = localStorage.getItem('upg_jwt_token') || '';
  //     if (!jwtToken) throw new Error('Missing JWT token — please generate one first.');

  //     const response = await fetch('/api/upg', {
  //       method: 'POST',
  //       headers: {
  //          'Content-Type': 'application/json' ,
  //         'jwt-token' : jwtToken, },
  //       body: JSON.stringify({
  //         action: 'checkStatus',
  //         useRealAPI,
  //         data: { orderId: paymentData.orderId }
  //       })
  //     });

  //     const result = await response.json();

  //     console.log('📦 Status Response:', result);

  //     setResponses((prev) => ({
  //       ...prev,
  //       status: {
  //         ...result,
  //         mode: useRealAPI ? 'REAL API' : 'MOCK'
  //       }
  //     }));

  //     setStep(4);

  //     if (result.paymentStatus === 'Success' || result.status === 'SUCCESS') {
  //       logTransaction({
  //         orderId: paymentData.orderId,
  //         amount: paymentData.amount,
  //         status: 'Success'
  //       });
  //     }
  //   } catch (error: any) {
  //     setError(`Status Check Failed: ${error.message}`);
  //     setResponses((prev) => ({
  //       ...prev,
  //       status: { status: 'ERROR', error: error.message }
  //     }));
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const checkPaymentStatus = async () => {
  const jwtToken = localStorage.getItem('upg_jwt_token') || '';
  if (!jwtToken) return alert('Please generate token first.');

  pollPaymentStatus(paymentData.orderId, jwtToken);
};




  // UPDATED: Check Touchpoint Balance with Real API support
  const checkTouchpointBalance = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/upg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'touchpointBalance',
          useRealAPI: useRealAPI,
          data: touchpointData
        })
      });

      const result = await response.json();
      
      setResponses(prev => ({
        ...prev,
        touchpoint: {
          ...result,
          mode: useRealAPI ? 'REAL API' : 'MOCK'
        }
      }));
    } catch (error: any) {
      setError(`Touchpoint Balance Check Failed: ${error.message}`);
      setResponses(prev => ({
        ...prev,
        touchpoint: { status: 'FAILURE', error_message: error.message }
      }));
    } finally {
      setLoading(false);
    }
  };

  // UPDATED: Reverse Touchpoint with Real API support
  const reverseTouchpoint = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/upg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'touchpointReversal',
          useRealAPI: useRealAPI,
          data: {
            orderId: paymentData.orderId,
            amount: paymentData.amount
          }
        })
      });

      const result = await response.json();
      
      setResponses(prev => ({
        ...prev,
        touchpoint: {
          ...result,
          mode: useRealAPI ? 'REAL API' : 'MOCK'
        }
      }));
    } catch (error: any) {
      setError(`Touchpoint Reversal Failed: ${error.message}`);
      setResponses(prev => ({
        ...prev,
        touchpoint: { status: 'FAILURE', error_message: error.message }
      }));
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8 space-x-2">
      {[1, 2, 3, 4].map((s) => (
        <React.Fragment key={s}>
          <div className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold ${
            step >= s ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
          }`}>
            {s}
          </div>
          {s < 4 && <div className={`w-12 h-1 ${step > s ? 'bg-blue-600' : 'bg-gray-300'}`} />}
        </React.Fragment>
      ))}
    </div>
  );

  

  const renderRedirectFlow = () => (
    <div className="space-y-6">
      {step >= 1 && (
        <div className="bg-white rounded-lg shadow p-6 border-2 border-blue-100">
          <h3 className="text-lg font-semibold mb-4 flex items-center text-blue-700">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center mr-3 text-sm">1</div>
            Generate JWT Token
          </h3>
          
          <div className="mb-4 p-4 bg-gray-50 rounded">
            <p className="text-sm text-gray-600 mb-2"><strong>API Key:</strong> {config.apiKey}</p>
            <p className="text-sm text-gray-600"><strong>App Key:</strong> {config.appKey}</p>
          </div>
          
          <button
            onClick={generateToken}
            disabled={loading || step > 1}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium flex items-center transition-colors"
          >
            {loading ? 'Generating...' : 'Generate Token'}
            {!loading && step === 1 && <ArrowRight className="ml-2" size={20} />}
          </button>
          
          {responses.token && (
            <div className="mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-green-700">✓ Token Generated Successfully!</p>
                {responses.token.mode && (
                  <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">
                    {responses.token.mode}
                  </span>
                )}
              </div>
              <pre className="text-xs overflow-auto bg-white p-3 rounded border max-h-40">
                {JSON.stringify(responses.token, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {step >= 2 && (
        <div className="bg-white rounded-lg shadow p-6 border-2 border-green-100">
          <h3 className="text-lg font-semibold mb-4 flex items-center text-green-700">
            <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center mr-3 text-sm">2</div>
            Initiate Payment (Redirect Flow)
          </h3>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Order ID</label>
              <input
                type="text"
                value={paymentData.orderId}
                onChange={(e) => setPaymentData({...paymentData, orderId: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Amount (AED)</label>
              <input
                type="text"
                value={paymentData.amount}
                onChange={(e) => setPaymentData({...paymentData, amount: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Payment Type</label>
              <select
                value={paymentData.paymentType}
                onChange={(e) => setPaymentData({...paymentData, paymentType: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option>PROPERTY_FEES</option>
                <option>UTILITY_BILL_PAYMENT</option>
                <option>SERVICE_FEES</option>
                <option>ADMIN FEES</option>
              </select>
            </div>
          </div>
          
          <button
            onClick={initiateRedirectPayment}
            disabled={loading || step > 2}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium flex items-center transition-colors"
          >
            {loading ? 'Processing...' : 'Initiate Payment'}
            {!loading && step === 2 && <ArrowRight className="ml-2" size={20} />}
          </button>
          
          {responses.initiate && (
            <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-blue-700">✓ Payment URL Generated!</p>
                {responses.initiate.mode && (
                  <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                    {responses.initiate.mode}
                  </span>
                )}
              </div>
              <pre className="text-xs overflow-auto bg-white p-3 rounded border mb-3 max-h-40">
                {JSON.stringify(responses.initiate, null, 2)}
              </pre>
              {responses.initiate.paymentUrl && (
                <a 
                  href={responses.initiate.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                >
                  → Open Payment Page
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {step >= 3 && (
        <div className="bg-white rounded-lg shadow p-6 border-2 border-purple-100">
          <h3 className="text-lg font-semibold mb-4 flex items-center text-purple-700">
            <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center mr-3 text-sm">3</div>
            Check Payment Status
          </h3>
          
          <p className="text-sm text-gray-600 mb-4">
            After customer completes payment on UPG page, verify the transaction status.
          </p>
          
          <button
            onClick={checkPaymentStatus}
            disabled={loading || step > 3}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 font-medium flex items-center transition-colors"
          >
            {loading ? 'Checking...' : 'Check Payment Status'}
            {!loading && step === 3 && <ArrowRight className="ml-2" size={20} />}
          </button>
          
          {responses.status && (
            <div className="mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-green-700">✓ Payment Status Retrieved!</p>
                {responses.status.mode && (
                  <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">
                    {responses.status.mode}
                  </span>
                )}
              </div>
              <pre className="text-xs overflow-auto bg-white p-3 rounded border max-h-40">
                {JSON.stringify(responses.status, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {step >= 4 && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg shadow-lg p-8 border-2 border-green-300 text-center">
          <CheckCircle className="mx-auto text-green-600 mb-4" size={64} />
          <h3 className="text-2xl font-bold mb-2 text-green-700">
            Payment Flow Complete! 🎉
          </h3>
          <p className="text-gray-600 mb-6">
            All steps of the redirect flow have been successfully executed.
          </p>
          <button
            onClick={() => {
              setStep(1);
              setResponses({ token: null, initiate: null, status: null, touchpoint: null });
              setPaymentData({...paymentData, orderId: `ORD-${Date.now()}`});
            }}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            Start New Transaction
          </button>
        </div>
      )}
    </div>
  );

  const renderSeamlessFlow = () => (
    <div className="space-y-6">
      {step >= 1 && (
        <div className="bg-white rounded-lg shadow p-6 border-2 border-blue-100">
          <h3 className="text-lg font-semibold mb-4 flex items-center text-blue-700">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center mr-3 text-sm">1</div>
            Generate JWT Token
          </h3>
          <button
            onClick={generateToken}
            disabled={loading || step > 1}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium transition-colors"
          >
            {loading ? 'Generating...' : 'Generate Token'}
          </button>
          {responses.token && (
            <div className="mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
              <p className="font-semibold text-green-700">✓ Token Generated!</p>
            </div>
          )}
        </div>
      )}

      {step >= 2 && (
        <div className="bg-white rounded-lg shadow p-6 border-2 border-green-100">
          <h3 className="text-lg font-semibold mb-4 flex items-center text-green-700">
            <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center mr-3 text-sm">2</div>
            Process Card Payment
          </h3>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Card Number</label>
              <input
                type="text"
                value={cardData.cardNumber}
                onChange={(e) => setCardData({...cardData, cardNumber: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Card Holder</label>
              <input
                type="text"
                value={cardData.cardHolder}
                onChange={(e) => setCardData({...cardData, cardHolder: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Expiry (MM)</label>
              <input
                type="text"
                value={cardData.expiryMonth}
                onChange={(e) => setCardData({...cardData, expiryMonth: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                maxLength={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Year (YYYY)</label>
              <input
                type="text"
                value={cardData.expiryYear}
                onChange={(e) => setCardData({...cardData, expiryYear: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                maxLength={4}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">CVV</label>
              <input
                type="text"
                value={cardData.cvv}
                onChange={(e) => setCardData({...cardData, cvv: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                maxLength={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Amount (AED)</label>
              <input
                type="text"
                value={paymentData.amount}
                onChange={(e) => setPaymentData({...paymentData, amount: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
          
          <button
            onClick={initiateSeamlessPayment}
            disabled={loading || step > 2}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium transition-colors"
          >
            {loading ? 'Processing...' : 'Process Payment'}
          </button>
          
          {responses.initiate && (
            <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <p className="font-semibold text-blue-700 mb-2">✓ Payment Initiated!</p>
              <pre className="text-xs overflow-auto bg-white p-3 rounded border mb-3 max-h-40">
                {JSON.stringify(responses.initiate, null, 2)}
              </pre>
              {responses.initiate.auth_url && (
                <a 
                  href={responses.initiate.auth_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                >
                  → Complete 3DS Authentication
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {step >= 3 && (
        <div className="bg-white rounded-lg shadow p-6 border-2 border-purple-100">
          <h3 className="text-lg font-semibold mb-4 flex items-center text-purple-700">
            <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center mr-3 text-sm">3</div>
            Verify Payment
          </h3>
          <button
            onClick={checkPaymentStatus}
            disabled={loading || step > 3}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 font-medium transition-colors"
          >
            {loading ? 'Verifying...' : 'Verify Status'}
          </button>
          {responses.status && (
            <div className="mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
              <p className="font-semibold text-green-700">✓ Payment Verified!</p>
              <pre className="text-xs overflow-auto bg-white p-3 rounded border mt-2 max-h-40">
                {JSON.stringify(responses.status, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {step >= 4 && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg shadow-lg p-8 border-2 border-green-300 text-center">
          <CheckCircle className="mx-auto text-green-600 mb-4" size={64} />
          <h3 className="text-2xl font-bold mb-2 text-green-700">Payment Complete! 🎉</h3>
          <button
            onClick={() => {
              setStep(1);
              setResponses({ token: null, initiate: null, status: null, touchpoint: null });
              setPaymentData({...paymentData, orderId: `ORD-${Date.now()}`});
            }}
            className="mt-4 bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            New Transaction
          </button>
        </div>
      )}
    </div>
  );

  const renderTouchpoints = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6 border-2 border-orange-100">
        <h3 className="text-lg font-semibold mb-4 text-orange-700">ADCB Touchpoint Balance</h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-2">Card Number</label>
            <input
              type="text"
              value={touchpointData.cardNumber}
              onChange={(e) => setTouchpointData({...touchpointData, cardNumber: e.target.value})}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-2">Card Holder</label>
            <input
              type="text"
              value={touchpointData.cardHolder}
              onChange={(e) => setTouchpointData({...touchpointData, cardHolder: e.target.value})}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Expiry Month</label>
            <input
              type="text"
              value={touchpointData.expiryMonth}
              onChange={(e) => setTouchpointData({...touchpointData, expiryMonth: e.target.value})}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
              maxLength={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Expiry Year</label>
            <input
              type="text"
              value={touchpointData.expiryYear}
              onChange={(e) => setTouchpointData({...touchpointData, expiryYear: e.target.value})}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
              maxLength={4}
            />
          </div>
        </div>
        
        <div className="flex gap-4">
          <button
            onClick={checkTouchpointBalance}
            disabled={loading}
            className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 disabled:bg-gray-400 font-medium transition-colors"
          >
            {loading ? 'Checking...' : 'Check Balance'}
          </button>
          
          <button
            onClick={reverseTouchpoint}
            disabled={loading}
            className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 disabled:bg-gray-400 font-medium transition-colors"
          >
            {loading ? 'Reversing...' : 'Reverse Points'}
          </button>
        </div>
        
        {responses.touchpoint && (
          <div className="mt-4 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
            <pre className="text-xs overflow-auto bg-white p-3 rounded border max-h-40">
              {JSON.stringify(responses.touchpoint, null, 2)}
            </pre>
            {responses.touchpoint.status === 'SUCCESS' && responses.touchpoint.total_points && (
              <div className="mt-3 p-4 bg-green-100 rounded-lg border-2 border-green-300">
                <p className="font-bold text-green-800 text-lg">💰 Points: {responses.touchpoint.total_points}</p>
                <p className="font-bold text-green-800 text-lg">💵 Amount: AED {responses.touchpoint.equivalent_amount}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
        <h4 className="font-semibold mb-3 text-blue-800">Touchpoint Features:</h4>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start">
            <span className="text-blue-600 mr-2">✓</span>
            <span><strong>Full Redemption:</strong> Use only touchpoints for entire payment</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 mr-2">✓</span>
            <span><strong>Partial Redemption:</strong> Combine touchpoints with card payment</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 mr-2">✓</span>
            <span><strong>Reversal:</strong> Refund touchpoints for cancelled transactions</span>
          </li>
        </ul>
      </div>
    </div>
  );

  const renderDocs = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border-2 border-blue-200">
        <h3 className="text-2xl font-bold mb-4 text-blue-800">📚 API Documentation</h3>
        
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg border-l-4 border-blue-500">
            <h4 className="font-bold text-lg mb-2">1. Generate Token</h4>
            <code className="text-sm bg-gray-100 px-3 py-1 rounded block mb-2">
              POST {getBaseUrl()}/pgs/generate/jwt
            </code>
            <p className="text-sm text-gray-600">Headers: x-api-key, AppKey, Language, Country</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg border-l-4 border-green-500">
            <h4 className="font-bold text-lg mb-2">2. Payment Initiate (Redirect)</h4>
            <code className="text-sm bg-gray-100 px-3 py-1 rounded block mb-2">
              POST {getBaseUrl()}/pgs/payment/initiate
            </code>
            <p className="text-sm text-gray-600">Returns: paymentUrl for user redirect</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg border-l-4 border-green-500">
            <h4 className="font-bold text-lg mb-2">3. Payment Initiate (Seamless)</h4>
            <code className="text-sm bg-gray-100 px-3 py-1 rounded block mb-2">
              POST {getBaseUrl()}/pgs/paymentapi/initiate
            </code>
            <p className="text-sm text-gray-600">Returns: auth_url for 3DS authentication</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg border-l-4 border-purple-500">
            <h4 className="font-bold text-lg mb-2">4. Payment Status</h4>
            <code className="text-sm bg-gray-100 px-3 py-1 rounded block mb-2">
              POST {getBaseUrl()}/pgs/payment/status
            </code>
            <p className="text-sm text-gray-600">Body: OrderId, AppKey</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg border-l-4 border-orange-500">
            <h4 className="font-bold text-lg mb-2">5. Touchpoint Balance</h4>
            <code className="text-sm bg-gray-100 px-3 py-1 rounded block mb-2">
              POST {getBaseUrl()}/pgs/paymentapi/CheckTouchPointBalance
            </code>
            <p className="text-sm text-gray-600">Returns: total_points, equivalent_amount</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg border-l-4 border-red-500">
            <h4 className="font-bold text-lg mb-2">6. Touchpoint Reversal</h4>
            <code className="text-sm bg-gray-100 px-3 py-1 rounded block mb-2">
              POST {getBaseUrl()}/pgs/paymentapi/TPReversal
            </code>
            <p className="text-sm text-gray-600">Body: order_id, amount</p>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6">
        <h3 className="text-xl font-bold mb-4 text-yellow-800">⚠️ Production Requirements</h3>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start">
            <span className="text-yellow-600 mr-2 font-bold">•</span>
            <span>Replace Base64 encryption with proper RSA/AES encryption</span>
          </li>
          <li className="flex items-start">
            <span className="text-yellow-600 mr-2 font-bold">•</span>
            <span>Implement proper 3DS authentication flow with iframe/redirect</span>
          </li>
          <li className="flex items-start">
            <span className="text-yellow-600 mr-2 font-bold">•</span>
            <span>Setup webhook URLs for payment status callbacks</span>
          </li>
          <li className="flex items-start">
            <span className="text-yellow-600 mr-2 font-bold">•</span>
            <span>Add comprehensive error handling and retry logic</span>
          </li>
          <li className="flex items-start">
            <span className="text-yellow-600 mr-2 font-bold">•</span>
            <span>Implement transaction logging and monitoring</span>
          </li>
          <li className="flex items-start">
            <span className="text-yellow-600 mr-2 font-bold">•</span>
            <span>Never store sensitive card data - use tokenization</span>
          </li>
          <li className="flex items-start">
            <span className="text-yellow-600 mr-2 font-bold">•</span>
            <span>Add rate limiting and fraud detection</span>
          </li>
        </ul>
      </div>

      <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6">
        <h3 className="text-xl font-bold mb-4 text-green-800">✅ Integration Checklist</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center">
              <CheckCircle className="text-green-600 mr-2" size={20} />
              <span className="text-sm">JWT Token Generation</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="text-green-600 mr-2" size={20} />
              <span className="text-sm">Redirect Flow Payment</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="text-green-600 mr-2" size={20} />
              <span className="text-sm">Seamless Flow Payment</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center">
              <CheckCircle className="text-green-600 mr-2" size={20} />
              <span className="text-sm">Payment Status Check</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="text-green-600 mr-2" size={20} />
              <span className="text-sm">Touchpoint Balance</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="text-green-600 mr-2" size={20} />
              <span className="text-sm">Touchpoint Reversal</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-6">
        <h3 className="text-xl font-bold mb-4 text-blue-800">🔐 Security Best Practices</h3>
        <div className="space-y-3 text-sm">
          <div className="bg-white p-3 rounded border-l-4 border-blue-500">
            <strong>Encryption:</strong> Use RSA-2048 or higher for sensitive data encryption
          </div>
          <div className="bg-white p-3 rounded border-l-4 border-blue-500">
            <strong>Storage:</strong> Never store CVV or full card numbers
          </div>
          <div className="bg-white p-3 rounded border-l-4 border-blue-500">
            <strong>Transport:</strong> Always use HTTPS/TLS 1.2+
          </div>
          <div className="bg-white p-3 rounded border-l-4 border-blue-500">
            <strong>Validation:</strong> Implement server-side validation for all inputs
          </div>
          <div className="bg-white p-3 rounded border-l-4 border-blue-500">
            <strong>Logging:</strong> Log all transactions with masked sensitive data
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      {/* API Mode Banner */}
      {useRealAPI ? (
        <div className="bg-gradient-to-r from-green-500 to-teal-500 text-white p-4 mb-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-center gap-3">
            <CheckCircle size={24} />
            <div>
              <p className="font-bold text-lg">🔥 REAL API MODE - Connected to Emaar UPG</p>
              <p className="text-sm">Using live API credentials. Transactions are real!</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 mb-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-center gap-3">
            <AlertCircle size={24} />
            <div>
              <p className="font-bold text-lg">🎭 DEMO MODE - Mock Responses</p>
              <p className="text-sm">Using simulated data. Switch to Real API to test actual integration.</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border-2 border-red-300 rounded-lg flex items-start">
            <AlertCircle className="text-red-600 mr-3 flex-shrink-0 mt-1" size={24} />
            <div>
              <p className="font-semibold text-red-800">Error</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-xl p-8 mb-6 border-t-4 border-blue-600">
          <h1 className="text-4xl font-bold text-gray-800 mb-3">
            🏦 UPG Payment Gateway - Complete POC
          </h1>
          <p className="text-gray-600 text-lg">
            Unified Payment Gateway - Full Integration Demo with All Flows
          </p>
          
          <div className="mt-6 flex items-center gap-4 flex-wrap">
            {/* API Mode Toggle */}
            <div className="flex items-center gap-4 border-r-2 pr-4">
              <span className="font-medium text-gray-700">API Mode:</span>
              <button
                onClick={() => {
                  setUseRealAPI(false);
                  setStep(1);
                  setResponses({ token: null, initiate: null, status: null, touchpoint: null });
                  setError(null);
                }}
                className={`px-6 py-2 rounded-lg font-medium transition-all ${
                  !useRealAPI 
                    ? 'bg-orange-600 text-white shadow-lg' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🎭 Mock/Demo
              </button>
              <button
                onClick={() => {
                  setUseRealAPI(true);
                  setStep(1);
                  setResponses({ token: null, initiate: null, status: null, touchpoint: null });
                  setError(null);
                }}
                className={`px-6 py-2 rounded-lg font-medium transition-all ${
                  useRealAPI 
                    ? 'bg-green-600 text-white shadow-lg' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🔥 Real API
              </button>
            </div>

            {/* Environment Toggle */}
            <span className="font-medium text-gray-700">Environment:</span>
            <button
              onClick={() => setEnvironment('dev')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                environment === 'dev' 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Development
            </button>
            <button
              onClick={() => setEnvironment('prod')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                environment === 'prod' 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Production
            </button>
            <span className="text-sm text-gray-500 ml-2">
              Base URL: {getBaseUrl()}
            </span>
          </div>

          {/* Show API Config when using Real API */}
          {useRealAPI && (
            <div className="mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
              <p className="text-sm font-semibold text-green-800 mb-2">🔐 Active API Configuration:</p>
              <p className="text-xs font-mono text-gray-700"><strong>API Key:</strong> {config.apiKey}</p>
              <p className="text-xs font-mono text-gray-700"><strong>App Key:</strong> {config.appKey}</p>
              <p className="text-xs font-mono text-gray-700"><strong>Base URL:</strong> {process.env.NEXT_PUBLIC_UPG_BASE_URL}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-xl mb-6 overflow-hidden">
          <div className="flex border-b-2 overflow-x-auto">
            <button
              onClick={() => {setActiveTab('redirect'); setStep(1); setResponses({ token: null, initiate: null, status: null, touchpoint: null }); setError(null);}}
              className={`flex-1 min-w-fit px-6 py-4 font-semibold transition-all ${
                activeTab === 'redirect'
                  ? 'bg-blue-600 text-white border-b-4 border-blue-800'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Smartphone className="inline mr-2" size={20} />
              Redirect Flow
            </button>
            <button
              onClick={() => {setActiveTab('seamless'); setStep(1); setResponses({ token: null, initiate: null, status: null, touchpoint: null }); setError(null);}}
              className={`flex-1 min-w-fit px-6 py-4 font-semibold transition-all ${
                activeTab === 'seamless'
                  ? 'bg-green-600 text-white border-b-4 border-green-800'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <CreditCard className="inline mr-2" size={20} />
              Seamless Flow
            </button>
            <button
              onClick={() => {setActiveTab('touchpoints'); setStep(1); setResponses({ token: null, initiate: null, status: null, touchpoint: null }); setError(null);}}
              className={`flex-1 min-w-fit px-6 py-4 font-semibold transition-all ${
                activeTab === 'touchpoints'
                  ? 'bg-orange-600 text-white border-b-4 border-orange-800'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <AlertCircle className="inline mr-2" size={20} />
              ADCB Touchpoints
            </button>
            <button
              onClick={() => {setActiveTab('docs'); setStep(1); setResponses({ token: null, initiate: null, status: null, touchpoint: null }); setError(null);}}
              className={`flex-1 min-w-fit px-6 py-4 font-semibold transition-all ${
                activeTab === 'docs'
                  ? 'bg-purple-600 text-white border-b-4 border-purple-800'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Code className="inline mr-2" size={20} />
              Documentation
            </button>
          </div>

          <div className="p-8">
            {activeTab !== 'docs' && activeTab !== 'touchpoints' && renderStepIndicator()}
            
            {activeTab === 'redirect' && renderRedirectFlow()}
            {activeTab === 'seamless' && renderSeamlessFlow()}
            {activeTab === 'touchpoints' && renderTouchpoints()}
            {activeTab === 'docs' && renderDocs()}
          </div>
        </div>
        
        {/* Transaction History */}
        {transactionHistory.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h3 className="text-xl font-bold mb-4">📋 Transaction History</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3 text-left">Order ID</th>
                    <th className="p-3 text-left">Amount</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {transactionHistory.map((tx) => (
                    <tr key={tx.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-mono text-xs">{tx.orderId}</td>
                      <td className="p-3">AED {tx.amount}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          tx.status === 'Success' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="p-3 text-xs">{tx.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-6 text-center">
          <p className="text-gray-600 text-sm">
            🎯 This POC demonstrates all UPG integration flows with {useRealAPI ? 'real API' : 'mock responses'}
          </p>
          <p className="text-gray-500 text-xs mt-2">
            {useRealAPI 
              ? 'Connected to Emaar UPG Development API. Check browser console (F12) for detailed logs.'
              : 'For production use, switch to Real API mode and replace mock encryption with proper RSA.'}
          </p>
        </div>
      </div>
    </div>
  );
}