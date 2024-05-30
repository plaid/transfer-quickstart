const express = require("express");
const db = require("../db");
const { plaidClient } = require("../plaid");
const authenticate = require("../middleware/authenticate");

const router = express.Router();
router.use(authenticate);

/**
 * List all the banks (by name) that the user has connected to so far.
 */
router.get("/list", async (req, res, next) => {
  try {
    const userId = req.userId;
    const result = await db.getBankNamesForUser(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * List all the accounts that the user has connected to so far. 
 */
router.get("/accounts/list", async (req, res, next) => {
  try {
    const userId = req.userId;
    const result = await db.getItemsAndAccountsForUser(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});


/**
 * Deactivate a bank account for the user.
 * We don't actually call this endpoint in our app, but it's good to have
 * around. 
 */
router.post("/deactivate", async (req, res, next) => {
  try {
    const itemId = req.body.itemId;
    const userId = req.userId;
    console.log("Deactivating item", itemId, "for user", userId);
    const accessToken = await db.getAccessTokenForUserAndItem(userId, itemId);
    console.log("Access token:", accessToken);
    await plaidClient.itemRemove({
      access_token: accessToken,
    });
    await db.deactivateItem(itemId);
    res.json({ removed: itemId });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
