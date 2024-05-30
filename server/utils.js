const db = require("./db");

/**
 * Get the user ID of the currently logged-in user, which we do by looking
 * at the value of the `signedInUser` cookie.
 */
const getLoggedInUserId = function (req) {
  return req.cookies["signedInUser"];
};

/**
 * Fetch information about the currently signed-in user.
 */
const getUserObject = async function (userId) {
  const result = await db.getUserRecord(userId);
  return result;
};

module.exports = { getLoggedInUserId, getUserObject };
