const express = require("express");
const db = require("../db");
const { plaidClient } = require("../plaid");
const authenticate = require("../middleware/authenticate");
const { syncPaymentData } = require("../syncPaymentData");

const router = express.Router();
router.use(authenticate);
/**
 * Sometimes you wanna run some custom server code. This seemed like the
 * easiest way to do it. Don't do this in a real application.
 */
router.post("/run", async (req, res, next) => {
  try {
    const userId = req.userId;
    res.json({ status: "done" });
  } catch (error) {
    next(error);
  }
});

/**
 * Sync all the payment data from Plaid to our database.
 * Normally, you might run this from a cron job, or in response to a webhook.
 * For the sake of this demo, we'll just expose it as an endpoint.
 * 
 */
router.post("/sync_events", async (req, res, next) => {
  try {
    await syncPaymentData();
    res.json({ status: "done" });
  } catch (error) {
    next(error);
  }
});

/**
 * Fire a webhook to simulate what might happen if a transfer's status changed.
 * Normally, these would happen automatically in response to a transfer's
 * status changing. In Sandbox, you need to call this explicity -- even if
 * you changed the transfer's status in the Plaid Dashboard.
 */
router.post("/fire_webhook", async (req, res, next) => {
  try {
    const webhookUrl = process.env.SANDBOX_WEBHOOK_URL;
    await plaidClient.sandboxTransferFireWebhook({
      webhook: webhookUrl,
    });
    res.json({ status: "done" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
