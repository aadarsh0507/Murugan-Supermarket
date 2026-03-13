import Razorpay from 'razorpay';
import crypto from 'crypto';

const getRazorpayInstance = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials not configured (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)');
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

/**
 * Create a Razorpay order for UPI/online payment.
 * Body: { amount: number (in rupees), receipt?: string, notes?: object }
 */
export const createOrder = async (req, res) => {
  try {
    const amountRupees = Number(req.body?.amount);
    if (!Number.isFinite(amountRupees) || amountRupees <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount (in rupees) is required' });
    }
    const amountPaise = Math.round(amountRupees * 100);
    const receipt = (req.body?.receipt && String(req.body.receipt).trim()) || `bill_${Date.now()}`;

    const instance = getRazorpayInstance();
    const order = await instance.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: req.body?.notes || {},
    });

    return res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('Razorpay create order error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to create payment order',
    });
  }
};

/**
 * Verify Razorpay payment signature after successful payment.
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing razorpay_order_id, razorpay_payment_id or razorpay_signature',
      });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return res.status(500).json({ success: false, message: 'Razorpay not configured' });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    return res.json({
      success: true,
      razorpay_payment_id: razorpay_payment_id,
      razorpay_order_id: razorpay_order_id,
    });
  } catch (err) {
    console.error('Razorpay verify error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Verification failed',
    });
  }
};

/**
 * Return the Razorpay key ID for frontend checkout (public key).
 */
export const getKey = (req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  if (!keyId) {
    return res.status(503).json({ success: false, message: 'Razorpay not configured' });
  }
  return res.json({ success: true, keyId });
};
