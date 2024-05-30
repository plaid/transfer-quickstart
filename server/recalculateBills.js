const db = require("./db");
const { PAYMENT_STATUS, BILL_STATUS } = require("./types");

/**
 * Recalculate our bill by looking at all of the payments
 * associated with this bill, adding up what's been paid, what's still
 * pending, and then updating its status accordingly
 */
async function recalculateBill(billId) {
  // 1. Get all payments related to our bill
  const billDetails = await db.adminGetBillDetails(billId);
  const payments = await db.adminGetPaymentsForBill(billId);

  // 2. For any payment that's marked "settled", let's add it to our settled total
  const settledTotal = payments
    .filter((payment) => payment.status == PAYMENT_STATUS.SETTLED)
    .reduce((prev, payment) => prev + payment.amount_cents, 0);

  // 3. For any payment that's marked "pending" or "posted", let's add it to our pending amount

  const pendingTotal = payments
    .filter(
      (payment) =>
        payment.status == PAYMENT_STATUS.PENDING ||
        payment.status == PAYMENT_STATUS.POSTED
    )
    .reduce((prev, payment) => prev + payment.amount_cents, 0);

  console.log(
    `For bill ${billId}, ${settledTotal} has been paid, ${pendingTotal} is pending`
  );

  // How you want to customize bill status to the user is up to you. This is just
  // one example.
  let newBillStatus = BILL_STATUS.UNPAID;
  if (settledTotal >= billDetails.original_amount_cents) {
    newBillStatus = BILL_STATUS.PAID;
  } else if (settledTotal + pendingTotal >= billDetails.original_amount_cents) {
    newBillStatus = BILL_STATUS.PAID_PENDING;
  } else if (settledTotal > 0 || pendingTotal > 0) {
    newBillStatus = BILL_STATUS.PARTIALLY_PAID;
  }
  db.adminUpdateBillStatus(billId, newBillStatus, settledTotal, pendingTotal);
}

module.exports = { recalculateBill };
