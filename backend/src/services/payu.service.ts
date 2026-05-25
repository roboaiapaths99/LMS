import crypto from 'crypto';
import { env } from '../config/env';

export function generatePayUHash({
  txnid,
  amount,
  productinfo,
  firstname,
  email
}: {
  txnid: string;
  amount: number;
  productinfo: string;
  firstname: string;
  email: string;
}) {
  const key = env.PAYU_KEY || 'dev_key';
  const salt = env.PAYU_SALT || 'dev_salt';
  
  // Format: key|txnid|amount|productinfo|firstname|email|||||||||||salt
  const hashString = `${key}|${txnid}|${amount.toFixed(2)}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
  
  return crypto.createHash('sha512').update(hashString).digest('hex');
}

export function verifyPayUHash({
  txnid,
  amount,
  productinfo,
  firstname,
  email,
  status,
  postedHash
}: {
  txnid: string;
  amount: number;
  productinfo: string;
  firstname: string;
  email: string;
  status: string;
  postedHash: string;
}) {
  const key = env.PAYU_KEY || 'dev_key';
  const salt = env.PAYU_SALT || 'dev_salt';
  
  // PayU response hash format: salt|status||||||additionalParams|email|firstname|productinfo|amount|txnid|key
  // In reverse order, we compute it like:
  const hashString = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount.toFixed(2)}|${txnid}|${key}`;
  
  const computedHash = crypto.createHash('sha512').update(hashString).digest('hex');
  return computedHash === postedHash;
}

export async function processRefund(txnid: string, amount: number) {
  const key = env.PAYU_KEY || 'dev_key';
  const salt = env.PAYU_SALT || 'dev_salt';
  const command = 'cancel_refund_transaction';
  
  // Hash sequence for cancel_refund_transaction: key|command|var1|salt
  const hashString = `${key}|${command}|${txnid}|${salt}`;
  const hash = crypto.createHash('sha512').update(hashString).digest('hex');

  const params = new URLSearchParams();
  params.append('key', key);
  params.append('command', command);
  params.append('var1', txnid);
  params.append('var2', amount.toFixed(2));
  params.append('hash', hash);

  const url = env.PAYU_ENV === 'live' 
    ? 'https://info.payu.in/merchant/postservice.php?form=2'
    : 'https://test.payu.in/merchant/postservice.php?form=2';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString()
  });

  const data = await response.json();
  if (data.status !== 1) {
    throw new Error(data.msg || 'PayU refund failed');
  }

  return data;
}
