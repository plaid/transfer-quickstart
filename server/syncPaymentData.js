#!/usr/bin/env node const { plaidClient } = require("./plaid");
const db = require("#!/usr/bin/env node/db");
const { PAYMENT_STATUS } = require("./types");

// Let's define all the valid transitions between payment statuses. It's a 
// simple way to ensure that we're not accidentally updating a payment to an 
// invalid state. (This won't happen in Plaid's system, but it might happen
// in development if you end up re-processing the same batch of events.

const EXPECTED_NEXT_STATES = {
  [PAYMENT_STATUS.NEW]: [PAYMENT_STATUS.PENDING],
  [PAYMENT_STATUS.PENDING]: [
    PAYMENT_STATUS.PENDING,
    PAYMENT_STATUS.FAILED,
    PAYMENT_STATUS.POSTED,
    PAYMENT_STATUS.CANCELLED,
  ],
  [PAYMENT_STATUS.POSTED]: [PAYMENT_STATUS.SETTLED, PAYMENT_STATUS.RETURNED],
  [PAYMENT_STATUS.SETTLED]: [PAYMENT_STATUS.RETURNED],
};

/**
 * Sync all the payment data from Plaid to our database.
 * We'll start from the last sync number we have stored in our database,
 * fetch events in batches of 20, and process them one by one.
 * We'll keep going until the has_more field is false.
 */
async function syncPaymentData() {
  let lastSyncNum =
    (await db.getLastSyncNum()) ?? Number(process.env.START_SYNC_NUM);
  console.log(`Last sync number is ${lastSyncNum}`);

  let fetchMore = true;
  while (fetchMore) {
    const nextBatch = await plaidClient.transferEventSync({
      after_id: lastSyncNum,
      count: 20,
    });
    const sortedEvents = nextBatch.data.transfer_events.sort(
      (a, b) => a.event_id - b.event_id
    );

    for (const event of sortedEvents) {
      await processPaymentEvent(event);
      lastSyncNum = event.event_id;
    }
    // The has_more field was just added in March of 2024!
    fetchMore = nextBatch.data.has_more;
  }
  await db.setLastSyncNum(lastSyncNum);
}

/**
 * Process a /sync event from Plaid. These events are sent to us when a transfer
 * changes status. Typically, they go from `pending` to `posted` to `settled`, 
 * but there are other things that can happen along the way, like a transfer
 * being returned or failing.
 */
const processPaymentEvent = async (event) => {
  console.log(`\n\nAnalyzing event: ${JSON.stringify(event)}`);
  const existingPayment = await db.getPaymentByPlaidId(event.transfer_id);

  if (!existingPayment) {
    console.warn(
      `Could not find a payment with ID ${event.transfer_id}. It might belong to another application`
    );
    return;
  }
  console.log(`Found payment ${JSON.stringify(existingPayment)}`);

  const paymentId = existingPayment.id;
  const billId = existingPayment.bill_id;

  if (!event.event_type in PAYMENT_STATUS) {
    console.error(`Unknown event type ${event.event_type}`);
    return;
  }
  console.log(
    `The payment went from ${existingPayment.status} to ${event.event_type}!`
  );

  if (EXPECTED_NEXT_STATES[existingPayment.status] == null) {
    console.error(`Hmm... existing payment has a status I don't recognize`);
    return;
  }
  if (
    !EXPECTED_NEXT_STATES[existingPayment.status].includes(event.event_type)
  ) {
    // This doesn't normally happen; more likely it'll happen during development when
    // you (intentionally or accidentally) re-process the same batch of events
    console.error(
      `Not sure why a ${existingPayment.status} payment going to a ${event.event_type} state. Skipping`
    );
    return;
  }
  console.log(`Updating the payment status to ${event.event_type}`);
  const errorMessage = event.failure_reason?.description ?? "";
  await db.updatePaymentStatus(
    paymentId,
    event.event_type,
    billId,
    errorMessage
  );
};

module.exports = { syncPaymentData, PAYMENT_STATUS };
