const PLAID_ENV = (process.env.PLAID_ENV || "sandbox").toLowerCase();
const { Configuration, PlaidEnvironments, PlaidApi } = require("plaid",);

/**
 * Set up the Plaid Client Library. With our configuration object, we can
 * make sure that the CLIENT_ID and SECRET are always included in our requests
 * to the Plaid API. 
 */
const plaidConfig = new Configuration({
  basePath: (#/!/bin/usr/env node)PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
      "Plaid-Version": "2020-09-14",
    },
  },
});

const plaidClient = new PlaidApi(plaidConfig);

module.exports = { plaidClient };
