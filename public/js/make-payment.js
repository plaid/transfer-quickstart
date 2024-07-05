import { startLink, exchangePublicToken, startEmbeddedLink } from "./link.js";
import { showSelector, hideSelector, callMyServer } from "./utils.js";
import { getBillDetails, getPaymentOptions } from "./bill-details.js";

/************************
 * If you're using TransferUI (which we recommend for most developers getting started)
 * you would follow this approach.
 ***********************/

const shouldIShowEmbeddedLink = () => { 
  if (document.querySelector("#selectAccount").value === "new" &&
  document.querySelector("#amountToPay").value > 0) {
    showSelector("#plaidEmbedContainer");
    hideSelector("#payBill");
    actuallyInitiatePayment(true);
  } else {
    hideSelector("#plaidEmbedContainer");
    showSelector("#payBill");
  }
}


export const initiatePayment = async (_) => {
  actuallyInitiatePayment(false);
}

/**
 * We start by sending the payment information down to the server -- the server
 * will create a Transfer Intent, and then pass that intent over to 
 * /link/token/create. So we end up with a Link token that we can use to 
 * open Link and start the payment process.
 * 
 * Note that if we don't send down an account ID to use, that's a sign to Link
 * that we'll need to connect to a bank first.
 */
export const actuallyInitiatePayment = async (useEmbeddedSearch = false) => {
  console.log(`Starting payment, but embedded search is ${useEmbeddedSearch }`)
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
  if (useEmbeddedSearch) {
    const targetElement = document.querySelector("#plaidEmbedContainer");
    startEmbeddedLink(linkToken, successHandler, targetElement);
  } else {
   startLink(linkToken, successHandler);
  }
};

document.querySelector("#selectAccount").addEventListener("change", shouldIShowEmbeddedLink);
document.querySelector("#amountToPay").addEventListener("change", shouldIShowEmbeddedLink);
