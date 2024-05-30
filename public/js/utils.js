/**
 * A function to simplify the process of calling our server with a GET or POST
 * request. We also parse the JSON response and log it to the console, so 
 * you can see what's happening. 
 */
export const callMyServer = async function (
  endpoint,
  isPost = false,
  postData = null
) {
  const optionsObj = isPost ? { method: "POST" } : {};
  if (isPost && postData !== null) {
    optionsObj.headers = { "Content-type": "application/json" };
    optionsObj.body = JSON.stringify(postData);
  }
  const response = await fetch(endpoint, optionsObj);
  if (response.status === 500) {
    await handleServerError(response);
    return;
  }
  const data = await response.json();
  console.log(`Result from calling ${endpoint}: ${JSON.stringify(data)}`);
  return data;
};

/**
 * Hide an item by their selector
 */
export const hideSelector = function (selector) {
  document.querySelector(selector).classList.add("d-none");
};

/**
 * Show an item by their selector
 */
export const showSelector = function (selector) {
  document.querySelector(selector).classList.remove("d-none");
};

/**
 * Print out a date in a user-friendly format
 */
export const prettyDate = function (isoString) {
  const date = new Date(isoString);

  const userFriendlyDateTime = date.toLocaleString("en-US", {
    weekday: "short", // "Tue"
    month: "short", // "Mar"
    day: "numeric", // "12"
    hour: "2-digit", // "02"
    minute: "2-digit", // "03"
    hour12: true, // Use AM/PM
  });

  return userFriendlyDateTime;
};

/**
 * Capitalize the first letter of every word in a string
 */
export const capitalizeEveryWord = function (str) {
  return str.replace(/\b[a-z]/g, function (char) {
    return char.toUpperCase();
  });
};

/**
 * Convert a snake_case string to normal looking text
 */
export const snakeToEnglish = function (str) {
  return capitalizeEveryWord(str.replace(/_/g, " "));
};


/**
 * Display some text in our #debugOutput area 
 */
export const showOutput = function (textToShow) {
  if (textToShow == null) return;
  const output = document.querySelector("#debugOutput");
  output.textContent = textToShow;
};


/**
 * Used to populate our tooltips
 */
export const getDetailsAboutStatus = function (status, failure_reason = "") {
  switch (status) {
    case "new":
      return "This payment row was created and there's probably a 'Pending' event waiting to be synced.";
    case "waiting_for_auth":
      return "Transfer finished before the auth step was complete. You may have quit the UI early, or authorization failed for some reason.";
    case "pending":
      return "This payment is bundled up at Plaid and is waiting to be sent to the ACH network.";
    case "posted":
      return "This payment has been sent to the ACH network and is typically settled within a day.";
    case "settled":
      return "The withdrawal has shown up on the user's bank statement. Funds will be placed in your Ledger's `pending` balance for 5 business days.";
    case "failed":
      return failure_reason;
    case "cancelled":
      return "This payment was cancelled by the user -- typically within a short window of sending it.";
    case "returned":
      return "The payment was returned. Possibly due to insufficient funds or the user disputed the charge.";
    default:
      return status;
  }
};

const formatters = {
  USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
};

/**
 * Display a number in a proper currency format
 */
export const currencyAmount = function (amount, currencyCode) {
  try {
    // Create a new formatter if this doesn't exist
    if (formatters[currencyCode] == null) {
      formatters[currencyCode] = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
      });
    }
    return formatters[currencyCode].format(amount);
  } catch (error) {
    console.log(error);
    return amount;
  }
};

/**
 * Did we get an error from the server? Let's handle it.
 */
const handleServerError = async function (responseObject) {
  const error = await responseObject.json();
  console.error("I received an error ", error);
  if (error.hasOwnProperty("error_message")) {
    showOutput(`Error: ${error.error_message} -- See console for more`);
  }
};
