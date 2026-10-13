'use strict';

const PRICES = Object.freeze({ donut: 50, chai: 20, coffee: 40, pasta: 120 });
const ORDER_FIELDS = new Set(['name', 'phone', 'isParcel', 'paymentMethod', 'items', 'totalPrice']);
const PAYMENT_METHODS = new Set(['UPI', 'Card', 'Cash']);

function isPlainRecord(value) {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateOrder(payload) {
  if (!isPlainRecord(payload)) {
    return { message: 'Please provide a valid order.' };
  }
  if (Object.keys(payload).some((key) => !ORDER_FIELDS.has(key))) {
    return { message: 'The order contains an unknown field.' };
  }

  if (typeof payload.name !== 'string' || !payload.name.trim() || payload.name.trim().length > 100) {
    return { message: 'Name must be between 1 and 100 characters.' };
  }
  const name = payload.name.trim();

  if (typeof payload.phone !== 'string' || !/^\d{10,15}$/.test(payload.phone.trim())) {
    return { message: 'Phone must contain 10 to 15 digits.' };
  }
  const phone = payload.phone.trim();

  if (typeof payload.isParcel !== 'boolean') {
    return { message: 'Parcel selection must be true or false.' };
  }
  if (!PAYMENT_METHODS.has(payload.paymentMethod)) {
    return { message: 'Please select a valid payment method.' };
  }

  if (!isPlainRecord(payload.items)) {
    return { message: 'Please provide valid items.' };
  }
  const itemKeys = Object.keys(payload.items);
  if (itemKeys.length === 0) {
    return { message: 'Your cart is empty.' };
  }

  const items = {};
  let totalPrice = 0;
  for (const key of itemKeys) {
    if (!Object.hasOwn(PRICES, key)) {
      return { message: 'The cart contains an unknown item.' };
    }
    const quantity = payload.items[key];
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return { message: 'Item quantities must be whole numbers between 1 and 99.' };
    }
    items[key] = quantity;
    totalPrice += PRICES[key] * quantity;
  }

  if (typeof payload.totalPrice !== 'number' || !Number.isFinite(payload.totalPrice) || payload.totalPrice !== totalPrice) {
    return { message: 'Order total does not match the selected items.' };
  }

  return {
    order: {
      name,
      phone,
      isParcel: payload.isParcel,
      paymentMethod: payload.paymentMethod,
      items,
      totalPrice,
      currency: 'INR',
      status: 'pending',
      paymentStatus: 'pending',
      createdAt: new Date(),
    },
  };
}

module.exports = { validateOrder };
