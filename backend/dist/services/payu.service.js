"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePayUHash = generatePayUHash;
exports.verifyPayUHash = verifyPayUHash;
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../config/env");
function generatePayUHash({ txnid, amount, productinfo, firstname, email }) {
    const key = env_1.env.PAYU_KEY || 'dev_key';
    const salt = env_1.env.PAYU_SALT || 'dev_salt';
    // Format: key|txnid|amount|productinfo|firstname|email|||||||||||salt
    const hashString = `${key}|${txnid}|${amount.toFixed(2)}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
    return crypto_1.default.createHash('sha512').update(hashString).digest('hex');
}
function verifyPayUHash({ txnid, amount, productinfo, firstname, email, status, postedHash }) {
    const key = env_1.env.PAYU_KEY || 'dev_key';
    const salt = env_1.env.PAYU_SALT || 'dev_salt';
    // PayU response hash format: salt|status||||||additionalParams|email|firstname|productinfo|amount|txnid|key
    // In reverse order, we compute it like:
    const hashString = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount.toFixed(2)}|${txnid}|${key}`;
    const computedHash = crypto_1.default.createHash('sha512').update(hashString).digest('hex');
    return computedHash === postedHash;
}
