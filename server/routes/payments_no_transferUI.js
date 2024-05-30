const express = require("express");
const { plaidClient } = require("../plaid");
const db = require("../db");
const authenticate = require("../middleware/authenticate");

const router = express.Router();
router.use(authenticate);

/**************
 * Want to initialize a payment without Transfer UI? These endpoints here
 * will help you do that.
 *
 * The first part of the process is storing the proof of authorization. This is
 * necessary for Nacha compliance and Plaid may ask you for this data to settle
 * disputes.
 *
 * For more information, see: https://www.nacha.org/system/files/2022-11/WEB_Proof_of_Authorization_Industry_Practices.pdf
 *
 ***************/


/**
 * Store the proof of authorization for a payment. This is necessary for Nacha
 * compliance. This is obviously not a fully functional endpoint, but it should
 * give you an idea of what you need to do if you choose not to use Link's 
 * Transfer UI
 */
router.post(
  "/store_proof_of_authorization_necessary_for_nacha_compliance",
  async (req, res, next) => {
    const userId = req.userId;
    const { billId, accountId, amount } = req.body;
    const { created_time: account_verification_time } =
      await db.getItemInfoForAccountAndUser(accountId, userId);

    const importantDataToStore = {
      accountAuthorizationMethod: `Plaid Auth`,
      accountAuthorizationTime: account_verification_time,
      ipAddress: req.ip,
      howWeVerifiedUserID: "(Sign-in details here)",
      howWeVerifiedUser: "(Details here)",
      timestamp: new Date(),
      userID: req.userId,
      userClickedConsent: true,
      oneTimeOrRecurring: "One time",
      metadata: { billId, accountId, amount },
    };

    await db.storeProofOfAuthorization(importantDataToStore);
    res.json({
      status: "success",
      message: "Ready to submit pamyment",
    });
  }
);

/**
 *
 * We perform two steps here. First, we authorize the transfer, which performs
 * important steps like checking the user's balance to see if they have enough
 * to cover the payment. 
 * 
 * Second, if the authorization is successful, we then create the transfer.
 */

router.post("/authorize_and_create", async (req, res, next) => {
  try {
    const userId = req.userId;
    const { billId, accountId, amount } = req.body;
    const amountAsCents = Math.round(amount * 100);
    const accessToken = await db.getAccessTokenForUserAndAccount(
      userId,
      accountId
    );
    const paymentAsString = Number.parseFloat(amount).toFixed(2);

    // Let's add this to the database first
    const paymentId = await db.createPaymentForUser(
      userId,
      billId,
      null,
      accountId,
      amountAsCents
    );
    const { authStatus, decisionMessage, authId } = await authorizeTransfer(
      accessToken,
      accountId,
      userId,
      paymentAsString,
      paymentId
    );
    if (authStatus === "rejected") {
      res.json({
        status: "rejected",
        message: decisionMessage,
      });
      return;
    } else if (authStatus === "unsure") {
      // How you handle this is up to you. You may want to proceed with the
      // transfer if you decide this user is low-risk
      res.json({ status: "unsure", message: decisionMessage });
      return;
    }

    // Let's create a transfer
    const {
      id: transferId,
      status: transferStatus,
      failureReason,
    } = await createTransferAfterAuthorization(
      accessToken,
      accountId,
      billId,
      paymentId,
      paymentAsString,
      authId
    );

    if (transferStatus === "failed") {
      res.json({ status: "failed", message: failureReason });
      return;
    }

    res.json({ status: "success", message: "Your payment has been submitted" });
  } catch (error) {
    next(error);
  }
});

/**
 * Make a call to Plaid to authorize the transfer -- this checks that the account
 * is valid and that the user has sufficient funds to cover the payment.
 * 
 * Note that when receiving a response from the /transfer/authorization/create
 * endpoint, Plaid will default to "approved" in cases where it can't properly
 * fetch account balance data from the user's bank. You should always check the
 * decision_rationale field to see if there were any issues and then decide
 * for yourself how to proceed.
 * 
 */

async function authorizeTransfer(
  accessToken,
  accountId,
  userId,
  paymentAsString,
  paymentId
) {
  const userInfo = await db.getUserRecord(userId);
  const legalName = `${userInfo.first_name} ${userInfo.last_name}`;

  const response = await plaidClient.transferAuthorizationCreate({
    access_token: accessToken,
    account_id: accountId,
    type: "debit",
    amount: paymentAsString,
    network: "same-day-ach",
    idempotency_key: paymentId,
    ach_class: "ppd", // Refer to the documentation, or talk to your Plaid representative to see which class is right for you.
    user_present: true,
    user: {
      legal_name: legalName,
    },
  });
  console.dir(response.data, { depth: null });
  const authObject = response.data.authorization;
  let authStatus = "";

  if (authObject.decision === "declined") {
    authStatus = "rejected";
  } else if (
    authObject.decision === "approved" &&
    authObject.decision_rationale == null
  ) {
    authStatus = "authorized";
  } else {
    authStatus = "unsure";
  }

  let decisionMessage = authObject.decision_rationale?.description ?? "";

  // Store this in the database
  await db.addPaymentAuthorization(
    paymentId,
    authObject.id,
    authStatus,
    decisionMessage
  );

  return { authStatus, decisionMessage, authId: authObject.id };
}

/**
 * Once the authorization step is complete, we can go ahead and create the
 * transfer in Plaid's system.
 */

async function createTransferAfterAuthorization(
  accessToken,
  accountId,
  billId,
  paymentId,
  paymentAsString,
  authId
) {
  const transferResponse = await plaidClient.transferCreate({
    access_token: accessToken,
    account_id: accountId,
    description: "Payment",
    amount: paymentAsString,
    metadata: {
      bill_id: billId,
    },
    authorization_id: authId,
  });

  console.log(transferResponse.data);
  const transferObject = transferResponse.data.transfer;

  // Let's update the transfer status
  await db.updatePaymentWithTransferInfo(
    paymentId,
    transferObject.id,
    transferObject.status,
    transferObject.failure_reason ?? ""
  );
  return {
    id: transferObject.id,
    status: transferObject.status,
    failureReason: transferObject.failure_reason ?? "",
  };
}
module.exports = router;
