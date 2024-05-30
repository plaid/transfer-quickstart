import { refreshSignInStatus, signOut } from "./signin.js";
import { startLink, exchangePublicToken } from "./link.js";
import {
  callMyServer,
  currencyAmount,
  snakeToEnglish,
  prettyDate,
  getDetailsAboutStatus,
} from "./utils.js";

let pendingPaymentObject = {};

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

/************************
 * If you're using TransferUI (which we recommend for most developers getting started)
 * you would follow this approach.
 ***********************/

/**
 * We start by sending the payment information down to the server -- the server
 * will create a Transfer Intent, and then pass that intent over to 
 * /link/token/create. So we end up with a Link token that we can use to 
 * open Link and start the payment process.
 * 
 * Note that if we don't send down an account ID to use, that's a sign to Link
 * that we'll need to connect to a bank first.
 */
export const initiatePayment = async () => {
  const billId = new URLSearchParams(window.location.search).get("billId");
  const accountId = document.querySelector("#selectAccount").value;
  const amount = document.querySelector("#amountToPay").value;
  console.log(`Paying bill ${billId} from bank ${accountId} for $${amount}`);
  if (billId == null || amount == null) {
    alert("Something went wrong");
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    alert("Please enter a valid amount.");
    return;
  }
  const { linkToken, transferIntentId } = await callMyServer(
    "/server/payments/initiate",
    true,
    {
      billId,
      accountId,
      amount,
    }
  );

  // When we're all done, we're going to send the public token and the
  // original transfer intent ID back to the server so we can gather some
  // information about the payment that was just created.
  const successHandler = async (publicToken, _) => {
    console.log("Finished with Link!");
    if (accountId === "new") {
      console.log(
        "Oh! Looks like you set up a new account. Let's exchange that token!"
      );
      await exchangePublicToken(publicToken);
    }

    await callMyServer("/server/payments/transfer_ui_complete", true, {
      publicToken,
      transferIntentId,
    });
    await Promise.all[(getBillDetails(), getPaymentOptions())];
  };
  startLink(linkToken, successHandler);
};

/************************
 *
 * Not interested in using TransferUI? You would use these functions instead.
 *
 ***********************/

/**
 * First, let's see if our user asked to connect to a new account. If so, we'll
 * create a link token and start the Link flow through the addNewAccount function.
 */
const startPaymentNoTUI = async () => {
  const accountId = document.querySelector("#selectAccountNoTUI").value;
  if (accountId === "new") {
    await addNewAccountThenStartPayment();
  } else {
    await preparePaymentDialog(accountId);
  }
};


/**
 * If a user decides to add a new account, you can create a link
 * token like normal. We ask our server to return an account ID from the
 * item we just created. (Ideally, this works best if you've customized your
 * link flow so that your user selects a single account)
 */
const addNewAccountThenStartPayment = async () => {
  const linkTokenData = await callMyServer(
    "/server/tokens/create_link_token",
    true
  );
  startLink(linkTokenData.link_token, async (publicToken, metadata) => {
    console.log("Finished with Link!");
    console.log(metadata);
    const newAccountId = await exchangePublicToken(publicToken, true);
    await getPaymentOptions();
    // A little hacky, but let's change the value of our drop-down so we
    // can grab the account name later.
    document.querySelector("#selectAccountNoTUI").value = newAccountId;
    preparePaymentDialog(newAccountId);
  });
};

/**
 * Next, we'll start a transfer by gathering up some information about the
 * payment and using that to populate a consent dialog.
 */
const preparePaymentDialog = async (accountId) => {
  const billId = new URLSearchParams(window.location.search).get("billId");
  const amount = document.querySelector("#amountToPayNoTUI").value;
  console.log(`Paying bill ${billId} from bank ${accountId} for $${amount}`);
  if (billId == null || amount == null) {
    alert("Something went wrong");
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    alert("Please enter a valid amount.");
    return;
  }
  if (accountId === "new") {
    alert("Please select an account or click the 'Add new account' button.");
    return;
  }
  pendingPaymentObject = { billId, accountId, amount };
  showDialog(amount);
};

/**
 * And, here's the code to actually display the dialog.
 */
const showDialog = async (amount) => {
  // Set the title and message in the dialog
  document.querySelector(
    "#customDialogLabel"
  ).textContent = `Confirm your ${currencyAmount(amount, "USD")} payment`;
  document.querySelector("#dlogAccount").textContent = document.querySelector(
    "#selectAccountNoTUI"
  ).selectedOptions[0].textContent;

  document.querySelector("#dlogDate").textContent = prettyDate(
    new Date().toLocaleString()
  );
  // Show the modal
  var myModal = new bootstrap.Modal(document.getElementById("customDialog"), {
    keyboard: false,
  });
  myModal.show();
};

/**
 * If the user clicks "Confirm", we're going to store the proof of authorization
 * data necessary for Nacha compliance and then authorize and create the payment.
 *
 * You would do probably this in a single endpoint call, but we'm breaking it 
 * out into two separate calls so you don't overlook this important step.
 */
const paymentDialogConfirmed = async () => {
  await callMyServer(
    "/server/payments/no_transfer_ui/store_proof_of_authorization_necessary_for_nacha_compliance",
    true,
    {
      billId: pendingPaymentObject.billId,
      accountId: pendingPaymentObject.accountId,
      amount: pendingPaymentObject.amount,
    }
  );
  const { status, message } = await callMyServer(
    "/server/payments/no_transfer_ui/authorize_and_create",
    true,
    {
      billId: pendingPaymentObject.billId,
      accountId: pendingPaymentObject.accountId,
      amount: pendingPaymentObject.amount,
    }
  );
  if (status === "success") {
    await getBillDetails();
  } else {
    alert(message);
    await getBillDetails();
  }
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
const getBillDetails = async () => {
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
  "#payBill": initiatePayment,
  "#syncServer": performServerSync,
  "#fireWebhook": fireTestWebhook,
  "#payBillNoTUI": startPaymentNoTUI,
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

await refreshSignInStatus(signedInCallBack, signedOutCallBack);
