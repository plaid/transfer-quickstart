import { refreshSignInStatus, signOut } from "./signin.js";
import {
  callMyServer,
  currencyAmount,
  capitalizeEveryWord,
  prettyDate,
  snakeToEnglish,
} from "./utils.js";

/**
 * Create a new bill for the user.
 */
const createNewBill = async () => {
  await callMyServer("/server/bills/create", true);
  await billsRefresh();
};

/**
 * Grab the list of bills from the server and display them on the page
 */
export const billsRefresh = async () => {
  const billsJSON = await callMyServer("/server/bills/list");
  // Let's add this to our table!
  const accountTable = document.querySelector("#reportTable");
  if (billsJSON == null || billsJSON.length === 0) {
    accountTable.innerHTML = `<tr><td colspan="4">No bills yet! Click the button below to create one!</td></tr>`;
    return;
  }

  accountTable.innerHTML = billsJSON
    .map((bill) => {
      const billActionLink = `<a href="bill-details.html?billId=${bill.id}">${bill.status === "unpaid" ? "Pay" : "View"
        }</a>`;
      return `<tr><td>${bill.description}</td><td>${prettyDate(
        bill.created_date
      )}</td><td class="text-end">${currencyAmount(
        (bill.original_amount_cents -
          bill.paid_total_cents -
          bill.pending_total_cents) /
        100,
        "USD"
      )}</td><td>${snakeToEnglish(
        bill.status
      )}</td><td>${billActionLink}</td></tr>`;
    })
    .join("\n");
};

/**
 * If we're signed out, redirect to the home page
 */
const signedOutCallBack = () => {
  window.location.href = "/index.html";
};

/**
 * If we're signed in, update the welcome message and refresh the table of bills
 */
const signedInCallBack = (userInfo) => {
  console.log(userInfo);
  document.querySelector(
    "#welcomeMessage"
  ).textContent = `Hi there, ${userInfo.firstName} ${userInfo.lastName}! Feel free to view or pay any of your bills!`;
  billsRefresh();
};

/**
 * Connects the buttons on the page to the functions above.
 */
const selectorsAndFunctions = {
  "#signOut": () => signOut(signedOutCallBack),
  "#newBill": createNewBill,
};

Object.entries(selectorsAndFunctions).forEach(([sel, fun]) => {
  if (document.querySelector(sel) == null) {
    console.warn(`Hmm... couldn't find ${sel}`);
  } else {
    document.querySelector(sel)?.addEventListener("click", fun);
  }
});

await refreshSignInStatus(signedInCallBack, signedOutCallBack);
