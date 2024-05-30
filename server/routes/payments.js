const express = require("express");
const { plaidClient } = require("../plaid");
const db = require("../db");
const authenticate = require("../middleware/authenticate");

const router = express.Router();
router.use(authenticate);

const WEBHOOK_URL =
  process.env.WEBHOOK_URL || "https://www.example.com/server/receive_webhook";

/**
 * Initiates a transfer payment using Plaid Transfer.
 * This function creates a transfer intent, records the payment attempt in the
 * database,and then passes that transfer intent ID along to /link/token/create
 * to get a link token.
 */
router.post("/initiate", async (req, res, next) => {
  try {
    const userId = req.userId;
    const { billId, accountId, amount } = req.body;
    // Grab our user's legal name
    const userObject = await db.getUserRecord(userId);
    const legalName = `${userObject.first_name} ${userObject.last_name}`;
    const amountAsString = Number.parseFloat(amount).toFixed(2);
    const amountAsCents = Math.round(amount * 100);
    // Let's just make sure we normalize the accountID.
    const accountIdOrNull =
      accountId != null && accountId !== "new" && accountId !== ""
        ? accountId
        : null;

    // Call transferIntentCreate to invoke the transfer UI
    const transferIntentId = await getTransferIntentId(
      legalName,
      amountAsString,
      billId,
      accountIdOrNull
    );

    // Save this attempted payment in the database
    await db.createPaymentForUser(
      userId,
      billId,
      transferIntentId,
      accountIdOrNull,
      amountAsCents
    );

    // Now create a link token
    const linkToken = await createLinkTokenForTransferUI(
      userId,
      legalName,
      transferIntentId,
      accountIdOrNull
    );

    res.json({ linkToken, transferIntentId });
  } catch (error) {
    next(error);
  }
});

/**
 * Performs post-transfer actions. At this point, the transfer has already been
 * completed, but we need to make sure our app knows about it.
 *
 * This function retrieves the transfer intent details, updates the payment
 * record in the database, and fetches account details if a new
 * account was connected during the transfer process.
 */
router.post("/transfer_ui_complete", async (req, res, next) => {
  const { transferIntentId } = req.body;
  const userId = req.userId;
  try {
    const response = await plaidClient.transferIntentGet({
      transfer_intent_id: transferIntentId,
    });
    const intentData = response.data.transfer_intent;
    console.dir(intentData, { depth: null });

    await db.updatePaymentWithTransferIntent(
      userId,
      transferIntentId,
      intentData.transfer_id,
      intentData.account_id,
      intentData.authorization_decision,
      intentData.authorization_decision_rationale
        ? intentData.authorization_decision_rationale.description
        : null,
      intentData.status
    );

    if (intentData.account_id == null) {
      console.log(
        "No account ID from the transfer intent, which means the user connected to a new one. Let's fetch that detail from the transfer"
      );
      const transferResponse = await plaidClient.transferGet({
        transfer_id: intentData.transfer_id,
      });
      console.dir(transferResponse.data, { depth: null });
      await db.updatePaymentWithAccountId(
        userId,
        intentData.transfer_id,
        transferResponse.data.transfer.account_id
      );
    }

    res.json({ status: "success" });
  } catch (error) {
    next(error);
  }
});

/**
 * Lists payments for a specific bill.
 */
router.post("/list", async (req, res, next) => {
  try {
    const userId = req.userId;
    const billId = req.body.billId;
    const payments = await db.getPaymentsForUserBill(userId, billId);
    res.json(payments);
  } catch (error) {
    next(error);
  }
});

/**
 * Creates a Transfer Intent using the Plaid API, and returns the transfer
 * intent ID.
 */
async function getTransferIntentId(
  legalName,
  amountAsString,
  billId,
  accountIdOrNull
) {
  const intentCreateObject = {
    mode: "PAYMENT", // Used for transfer going from the end-user to you
    user: {
      legal_name: legalName,
    },
    amount: amountAsString,
    description: "BillPay",
    ach_class: "ppd", // Refer to the documentation, or talk to your Plaid representative to see which class is right for you.
    iso_currency_code: "USD",
    network: "same-day-ach", // This is the default value, but I like to make it explicit
    metadata: {
      bill_id: billId,
    },
  };
  if (accountIdOrNull != null) {
    intentCreateObject.account_id = accountIdOrNull;
  }

  console.log(intentCreateObject);
  const response = await plaidClient.transferIntentCreate(intentCreateObject);
  console.log(response.data);
  // We'll return the transfer intent ID to the client so they can start
  // transfer UI
  return response.data.transfer_intent.id;
}

/**
 * Creates a link token to be used for initiating transfer. By passing along
 * the transfer intent ID that we created in an earlier step, Link will know all
 * about the transfer that we want to make.
 */
async function createLinkTokenForTransferUI(
  userId,
  legalName,
  transferIntentId,
  accountIdOrNull
) {
  const linkTokenCreateObject = {
    user: {
      client_user_id: userId,
      legal_name: legalName,
    },
    products: ["transfer"],
    transfer: {
      intent_id: transferIntentId,
    },
    client_name: "Pay My Utility Bill",
    language: "en",
    country_codes: ["US"],
    webhook: WEBHOOK_URL,
  };
  if (accountIdOrNull != null) {
    const accessToken = await db.getAccessTokenForUserAndAccount(
      userId,
      accountIdOrNull
    );
    console.log(`Access token for account ${accountIdOrNull}: ${accessToken}`);

    linkTokenCreateObject.access_token = accessToken;
  }
  console.log(linkTokenCreateObject);

  const response = await plaidClient.linkTokenCreate(linkTokenCreateObject);
  console.log(response.data);

  return response.data.link_token;
}

module.exports = router;
