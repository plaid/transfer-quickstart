const express = require("express");
const escape = require("escape-html");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const authenticate = require("../middleware/authenticate");

const router = express.Router();

/******************************************
 * Methods and endpoints for signing in, signing out, and creating new users.
 * For the purpose of this sample, we're simply setting / fetching a cookie that
 * contains the userID as our way of getting the ID of our signed-in user.
 ******************************************/


/**
 * Create a new user! Then, we can set a cookie to remember that user.
 */
router.post("/create", async (req, res, next) => {
  try {
    const username = escape(req.body.username);
    const firstName = escape(req.body.firstName);
    const lastName = escape(req.body.lastName);
    const userId = uuidv4();
    const result = await db.addUser(userId, username, firstName, lastName);
    console.log(`User creation result is ${JSON.stringify(result)}`);
    if (result["lastID"] != null) {
      res.cookie("signedInUser", userId, {
        maxAge: 1000 * 60 * 60 * 24 * 30,
        httpOnly: true,
      });
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});


/**
 * List all the users in our database.
 */
router.get("/list", async (req, res, next) => {
  try {
    const result = await db.getUserList();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Sign in as an existing user. 
 */
router.post("/sign_in", async (req, res, next) => {
  try {
    const userId = escape(req.body.userId);
    res.cookie("signedInUser", userId, {
      maxAge: 1000 * 60 * 60 * 24 * 30,
      httpOnly: true,
    });
    res.json({ signedIn: true });
  } catch (error) {
    next(error);
  }
});

/**
 * Sign out the current user from our app. This is as simple as clearing the 
 * cookie.
 */
router.post("/sign_out", async (req, res, next) => {
  try {
    res.clearCookie("signedInUser");
    res.json({ signedOut: true });
  } catch (error) {
    next(error);
  }
});

/**
 * Get some information about our currently logged-in user (if there is one).
 */
router.get("/get_my_info", authenticate, async (req, res, next) => {
  try {
    const userId = req.userId;
    console.log(`Your userID is ${userId}`);
    let result;
    if (userId != null) {
      const userObject = await db.getUserRecord(userId);
      if (userObject == null) {
        // This probably means your cookies are messed up.
        res.clearCookie("signedInUser");
        res.json({ userInfo: null });
        return;
      } else {
        result = {
          id: userObject.id,
          username: userObject.username,
          firstName: userObject.first_name,
          lastName: userObject.last_name,
        };
      }
    } else {
      result = null;
    }
    res.json({ userInfo: result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
