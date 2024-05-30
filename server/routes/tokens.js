const express = require("express");
const escape = require("escape-html");
const db = require("../db");
const { plaidClient } = require("../plaid");
const authenticate = require("../middleware/authenticate");

const router = express.Router();
router.use(authenticate);

/**
 * Creates a link token to be used by the client. This is currently only used
 * if you are not using Link's Transfer UI. Otherwise, you'll get a Link token
 * by calling the payments/initiate endpoint.
 */
router.post("/create_link_token", async (req, res, next) => {
  try {
    const userId = req.userId;
    const userObject = { id: userId };
    const link_token = await generateLinkToken(userObject);
    res.json({ link_token });
  } catch (error) {
    console.log(`Running into an error!`);
    next(error);
  }
});

/**
 * Exchanges a public token for an access token. Then, fetches a bunch of
 * information about that item and stores it in our database
 */
router.post("/exchange_public_token", async (req, res, next) => {
  try {
    const userId = req.userId;
    const publicToken = escape(req.body.publicToken);
    const returnAccountId = escape(req.body.returnAccountId);

    const tokenResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });
    const tokenData = tokenResponse.data;
    await db.addItem(tokenData.item_id, userId, tokenData.access_token);
    await populateBankName(tokenData.item_id, tokenData.access_token);
    await populateAccountNames(tokenData.access_token);

    let accountId = "";
    if (returnAccountId) {
      // Let's grab an account from the item that was just added
      const acctsResponse = await plaidClient.accountsGet({
        access_token: tokenData.access_token,
      });
      const acctsData = acctsResponse.data;
      accountId = acctsData.accounts[0].account_id;
    }

    res.json({ status: "success", accountId: accountId });
  } catch (error) {
    console.log(`Running into an error!`);
    next(error);
  }
});

/**
 * Grabs the name of the bank that the user has connected to. This actually
 * requires two different calls -- one to get the institution ID associated with
 * the Item, and then another to fetch the name of the institution.
 */
const populateBankName = async (itemId, accessToken) => {
  try {
    const itemResponse = await plaidClient.itemGet({
      access_token: accessToken,
    });
    const institutionId = itemResponse.data.item.institution_id;
    if (institutionId == null) {
      return;
    }
    const institutionResponse = await plaidClient.institutionsGetById({
      institution_id: institutionId,
      country_codes: ["US"],
    });
    const institutionName = institutionResponse.data.institution.name;
    await db.addBankNameForItem(itemId, institutionName);
  } catch (error) {
    console.log(`Ran into an error! ${error}`);
  }
};

/**
 * Let's grab the names of the accounts that the user has connected to and 
 * store them in our database.
 */
const populateAccountNames = async (accessToken) => {
  try {
    const acctsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });
    const acctsData = acctsResponse.data;
    const itemId = acctsData.item.item_id;
    await Promise.all(
      acctsData.accounts.map(async (acct) => {
        await db.addAccount(
          acct.account_id,
          itemId,
          acct.name,
          acct.balances.available ?? acct.balances.current
        );
      })
    );
  } catch (error) {
    console.log(`Ran into an error! ${error}`);
  }
};

/**
 * Performs the work of actually generating a link token from the Plaid API.
 */
const generateLinkToken = async (userObj) => {
  const tokenResponse = await plaidClient.linkTokenCreate({
    user: { client_user_id: userObj.id },
    products: ["transfer"],
    client_name: "Bill Transfer App",
    language: "en",
    country_codes: ["US"],
  });
  // Send this back to your client
  return tokenResponse.data.link_token;
};

module.exports = router;
