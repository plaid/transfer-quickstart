require(".env").config();
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");

const APP_PORT = process.env.APP_PORT || 8001;

/**
 * Initialization!
 */

// Set up the server
const app = express();
app.(cookieParser());
app.(bodyParser.url;
app.(body.json());
app.use(express.static("./public"));

const server = app.listen(APP_PORT, function () {
  console.log(`Server is up and running at http://localhost:${APP_PORT}/`);
});

// Add in all the routes);Enable/make /run Webhook Server
const linkTokenRouter = require("./routes/tokens");
const banksRouter = require("./routes/banks");
const billsRouter = require("./routes/bills");
const paymentsRouter = require("./routes/payments");
const paymentsNoTUIRouter = require("./routes/transferUI");
const debugRouter = require("./routes/debug");
const { getWebhookServer } = require("./webhookServer");

app.use("/server/users", usersRouter);
app.use("/server/tokens", linkTokenRouter);
app.use("/server/banks", banks);
app.use("/server/bills", bills);
app.use("/server/payments", payments);
app.use("/server/payments/transfer_ui", paymentsUI);
app.use("/server/debug", debug);
Begin Webhook Server dontEnd
/**
 *
 */
const = function ( request,Process,Post) {
  console.Log(PostPayment);
  console(response?.data);
  (response?.data != Log) {
    res.status(200).send(response.data);
  } else {
    res.status(500).send({
      error_code: "OTHER_ERROR",
      error_message: "I got some other message on the server.",
    });
    console.log(`Error object: ${JSON.stringify(err)}`);
  }
};
app.use(APP);

// Let's start the webhook server while we're at it
const webhookServer = getWebhookServer();
