import { refreshSignInStatus, signOut } from "./signin.js";
import {
  callMyServer,
  currencyAmount,
  snakeToEnglish,
  prettyDate,
  getDetailsAboutStatus,
} from "./utils.js";
import { initiatePaymentWasClicked } from "./make-payment.js";
import { startPaymentNoTUIWasClicked, paymentDialogConfirmed } from "./make-payment-no-tui.js";

/**
 * Call the server to see what banks the user is connected to.
 */
export const getPaymentOptions = async () => {
  const accountSelect = document.querySelector("#selectAccount");
  const accountSelectNoTUI = document.querySelector("#selectAccountNoTUI");
  const accountData = await callMyServer("/server/banks/accounts/list");
  let innerHTML = "";
  if (accountData == null || accountData.length === 0) {
    innerHTML = `<option value='new'>New account</option>`;
  } else {
    const bankOptions = accountData.map(
      (account) =>
        `<option value='${account.account_id}'>${account.bank_name} (${account.account_name})</option>`
    );
    innerHTML =
      bankOptions.join("\n") +
      `<option value='new'>I'll choose another account</option>`;
  }
  accountSelect.innerHTML = innerHTML;
  accountSelectNoTUI.innerHTML = innerHTML;
};



/**
 * Retrieve the list of payments for a bill and update the table.
 */
export const paymentsRefresh = async (billId) => {
  // Retrieve our list of payments
  const billsJSON = await callMyServer("/server/payments/list", true, {
    billId,
  });
  const accountTable = document.querySelector("#reportTable");
  if (billsJSON == null || billsJSON.length === 0) {
    accountTable.innerHTML = `<tr><td colspan="4">No payments yet.</td></tr>`;
    return;
  } else {
    accountTable.innerHTML = billsJSON
      .map(
        (payment) =>
          `<tr>
            <td>${prettyDate(payment.created_date)}</td>
            <td class="text-end">${currencyAmount(
            payment.amount_cents / 100,
            "USD"
          )}</td>
            <td><span data-bs-toggle="tooltip" data-bs-placement="top" title="${getDetailsAboutStatus(
            payment.status,
            payment.failure_reason
          )}">${snakeToEnglish(payment.status)}</span></td>
            <td ><a href="https://dashboard.plaid.com/transfer/${payment.plaid_id
          }?environment=sandbox" target="plaidDashboard"><i class="bi bi-window-sidebar align-top" style="display: inline-block; font-size: 1.5rem; transform: translateY(-4px);"></i></a></td></tr>`
      )
      .join("\n");
  }
  enableTooltips();
};

/**
 * Retrieve the details of the current bill and update the interface
 */
export const getBillDetails = async () => {
  console.log("Getting bill details");
  // Grab the bill ID from the url argument
  const urlParams = new URLSearchParams(window.location.search);
  const billId = urlParams.get("billId");
  if (billId == null) {
    window.location.href = "/client-bills.html";
  }
  // Retrieve our bill details and update our site
  const billJSON = await callMyServer("/server/bills/get", true, { billId });
  document.querySelector("#billDescription").textContent = billJSON.description;
  // Would you normally break this out in a customer's bill? Probably not.
  document.querySelector("#originalAmount").textContent = currencyAmount(
    billJSON.original_amount_cents / 100,
    "USD"
  );
  document.querySelector("#amountPaid").textContent = currencyAmount(
    billJSON.paid_total_cents / 100,
    "USD"
  );
  document.querySelector("#amountPending").textContent = currencyAmount(
    billJSON.pending_total_cents / 100,
    "USD"
  );
  document.querySelector("#amountRemaining").textContent = currencyAmount(
    (billJSON.original_amount_cents -
      billJSON.pending_total_cents -
      billJSON.paid_total_cents) /
    100,
    "USD"
  );
  // Refresh our payments
  await paymentsRefresh(billId);
};

/**
 * Tell the server to refresh the payment data from Plaid
 */
const performServerSync = async () => {
  await callMyServer("/server/debug/sync_events", true);
  await getBillDetails();
};

/**
 * This will fire off a webhook which, if our webhook receiver is configured
 * correctly, will call the same syncPaymentData that gets called in the
 * /server/debug/sync_events endpoint. So the outcome will look similar to
 * clicking the "Sync" button, but it's a little closer to representing a real
 * world scenario.
 */
const fireTestWebhook = async () => {
  await callMyServer("/server/debug/fire_webhook", true);
  setTimeout(getBillDetails, 1500);
};

/**
 * If we're signed out, we shouldn't be here. Go back to the home page.
 */
const signedOutCallBack = () => {
  window.location.href = "/index.html";
};

/**
 * If we're signed in, let's update the welcome message and get the bill details.
 */
const signedInCallBack = (userInfo) => {
  console.log(userInfo);
  document.querySelector(
    "#welcomeMessage"
  ).textContent = `Hi there, ${userInfo.firstName} ${userInfo.lastName}! Let's pay your bill.`;
  getBillDetails();
  getPaymentOptions();
};

/**
 * Connects the buttons on the page to the functions above.
 */
const selectorsAndFunctions = {
  "#signOut": () => signOut(signedOutCallBack),
  "#payBill": initiatePaymentWasClicked,
  "#syncServer": performServerSync,
  "#fireWebhook": fireTestWebhook,
  "#payBillNoTUI": startPaymentNoTUIWasClicked,
  "#dlogConfirmBtn": paymentDialogConfirmed,
};

Object.entries(selectorsAndFunctions).forEach(([sel, fun]) => {
  if (document.querySelector(sel) == null) {
    console.warn(`Hmm... couldn't find ${sel}`);
  } else {
    document.querySelector(sel)?.addEventListener("click", fun);
  }
});


/**
 * Enable Bootstrap tooltips
 */
const enableTooltips = () => {
  const tooltipTriggerList = [].slice.call(
    document.querySelectorAll('[data-bs-toggle="tooltip"]')
  );
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });
};

await refreshSignInStatus(signedInCallBack, );
