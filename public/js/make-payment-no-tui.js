
import { startLink, exchangePublicToken, startEmbeddedLink } from "./link.js";
import { showSelector, hideSelector, callMyServer, currencyAmount, prettyDate } from "./utils.js";
import { getBillDetails, getPaymentOptions } from "./bill-details.js";


/************************
 *
 * Not interested in using TransferUI? You would use these functions instead.
 *
 ***********************/

let pendingPaymentObject = {};



/**
 * We can show the embedded link UI if the user wants to connect to a new account. 
 */
const shouldIShowEmbeddedLinkNoTUI = () => {
  if (document.querySelector("#selectAccountNoTUI").value === "new" &&
    document.querySelector("#amountToPayNoTUI").value > 0) {
    showSelector("#plaidEmbedContainerNoTUI");
    hideSelector("#payBillNoTUI");
    addNewAccountThenStartPayment();
  } else {
    hideSelector("#plaidEmbedContainerNoTUI");
    showSelector("#payBillNoTUI");
  }
}

/**
 * This function is called when the "Pay Bill" button is clicked. With the 
 * embedded Link flow, this button is only displayed if you're asking to connect
 * to an existing account. So we can skip right to the "Show the payment
 * confirmation" dialog
 */
export const startPaymentNoTUIWasClicked = async () => {
  const accountId = document.querySelector("#selectAccountNoTUI").value;
  await preparePaymentDialog(accountId);
};


/**
 * If our user decides to add a new account, we can create a link
 * token like normal. In the success handler, we ask our server to return an 
 * account ID from the item that was just created, so we can then kick off the 
 * actual payment. (Ideally, this works best if you've customized your link 
 * flow so that your user selects a single account)
 */
const addNewAccountThenStartPayment = async () => {
  const linkTokenData = await callMyServer(
    "/server/tokens/create_link_token",
    true
  );
  const successHandler = async (publicToken, metadata) => {
    console.log("Finished with Link!");
    console.log(metadata);
    const newAccountId = await exchangePublicToken(publicToken, true);
    await getPaymentOptions();
    // A little hacky, but let's change the value of our drop-down so we
    // can grab the account name later.
    document.querySelector("#selectAccountNoTUI").value = newAccountId;
    preparePaymentDialog(newAccountId);
  }

  // In the non-Transfer UI flow, Link is only used when we're connecting
  // to a new account. So we'll always use embedded Link here.
  const targetElement = document.querySelector("#plaidEmbedContainerNoTUI");
  startEmbeddedLink(linkTokenData.link_token, successHandler, targetElement);
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
export const paymentDialogConfirmed = async () => {
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

// Let's also set up the embedded link container logic
document.querySelector("#selectAccountNoTUI").addEventListener("change", shouldIShowEmbeddedLinkNoTUI);
document.querySelector("#amountToPayNoTUI").addEventListener("change", shouldIShowEmbeddedLinkNoTUI);
