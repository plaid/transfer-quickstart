const express = require("express");
const { getUserObject } = require("../utils");
const db = require("../db");
const authenticate = require("../middleware/authenticate");

const router = express.Router();
router.use(authenticate);

/**
 * Generate a new utility bill for our user.
 */
router.post("/create", async (req, res, next) => {
  try {
    const userId = req.userId;
    const result = await db.createNewBill(userId);
    console.log(`Bill creation result is ${JSON.stringify(result)}`);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * List all the bills for the current signed-in user.
 */
router.get("/list", async (req, res, next) => {
  try {
    const userId = req.userId;
    const result = await db.getBillsForUser(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Get the details of a specific bill for the current signed-in user.
 */
router.post("/get", async (req, res, next) => {
  try {
    const userId = req.userId;
    const { billId } = req.body;
    const result = await db.getBillDetailsForUser(userId, billId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
