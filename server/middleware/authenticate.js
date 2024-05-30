const { getLoggedInUserId } = require("../utils");

/**
 * Middleware that checks if the user is logged in. 
 * If so, we'll attach the userId to the request.
 * If not, we'll send a 401 response.
*/
const authenticate = function (req, res, next) {
  try {
    const userId = getLoggedInUserId(req);
    if (!userId) {
      // User is not logged in, send an appropriate response
      return res.status(401).json({ message: "Unauthorized: Please log in." });
    }
    // User is logged in, attach userId to the request for further use
    req.userId = userId;
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    return res
      .status(500)
      .json({ message: "An error occurred during authentication." });
  }
};

module.exports = authenticate;
