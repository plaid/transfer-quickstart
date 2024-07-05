import { callMyServer } from "./utils.js";

/**
 * Start Link and define the callbacks we will call if a user completes the
 * flow or exits early
 */
export const startLink = async function (linkToken, asyncCustomSuccessHandler) {
  const handler = Plaid.create({
    token: linkToken,
    onSuccess: async (publicToken, metadata) => {
      console.log(`Finished with Link! ${JSON.stringify(metadata)}`);
      await asyncCustomSuccessHandler(publicToken, metadata);
    },
    onExit: async (err, metadata) => {
      console.log(
        `Exited early. Error: ${JSON.stringify(err)} Metadata: ${JSON.stringify(
          metadata
        )}`
      );
    },
    onEvent: (eventName, metadata) => {
      console.log(`Event ${eventName}, Metadata: ${JSON.stringify(metadata)}`);
    },
  });
  handler.open();
};

export const startEmbeddedLink = async function (linkToken, asyncCustomSuccessHandler, targetDiv) {
  const handler = Plaid.createEmbedded({
    token: linkToken,
    onSuccess: async (publicToken, metadata) => {
      console.log(`Finished with Link! ${JSON.stringify(metadata)}`);
      await asyncCustomSuccessHandler(publicToken, metadata);
    },
    onExit: async (err, metadata) => {
      console.log(
        `Exited early. Error: ${JSON.stringify(err)} Metadata: ${JSON.stringify(
          metadata
        )}`
      );
    },
    onEvent: (eventName, metadata) => {
      console.log(`Event ${eventName}, Metadata: ${JSON.stringify(metadata)}`);
    },
  },
  targetDiv);
};


/**
 * Exchange our Link token data for an access token
 */
export const exchangePublicToken = async (
  publicToken,
  getAccountId = false
) => {
  const { status, accountId } = await callMyServer(
    "/server/tokens/exchange_public_token",
    true,
    {
      publicToken: publicToken,
      returnAccountId: getAccountId,
    }
  );
  console.log("Done exchanging our token.");
  return accountId;
};
