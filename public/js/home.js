import { createNewUser, refreshSignInStatus, signIn } from "./signin.js";
import { callMyServer, hideSelector, showSelector } from "./utils.js";

/**
 * Let's create a new account! (And then call the signedInCallback when we're done)
 */
export const createAccount = async function (signedInCallback) {
  const newUsername = document.querySelector("#username").value;
  const newFirstName = document.querySelector("#firstName").value;
  const newLastName = document.querySelector("#lastName").value;
  await createNewUser(signedInCallback, newUsername, newFirstName, newLastName);
};

/**
 * Get a list of all of our users on the server.
 */
const getExistingUsers = async function () {
  const usersList = await callMyServer("/server/users/list");
  if (usersList.length === 0) {
    hideSelector("#existingUsers");
  } else {
    showSelector("#existingUsers");
    document.querySelector("#existingUsersSelect").innerHTML = usersList.map(
      (userObj) => `<option value="${userObj.id}">${userObj.username}</option>`
    );
  }
};


/**
 * If we're signed out, show the welcome message and the sign-in options 
 */
const signedOutCallback = () => {
  document.querySelector("#welcomeMessage").textContent =
    "Hi, there! It's your local utility. Please sign in to view and pay your bills";
  getExistingUsers();
};

/**
 * If we're signed in, redirect to the bills page
 */
const signedInCallback = (userInfo) => {
  document.querySelector(
    "#welcomeMessage"
  ).textContent = `Hi there! So great to see you again! You are signed in as ${userInfo.username}!`;
  window.location.href = "/bills.html";
};

document.querySelector("#signIn")?.addEventListener("click", () => {
  signIn(signedInCallback);
});

document.querySelector("#createAccount")?.addEventListener("click", () => {
  createAccount(signedInCallback);
});

await refreshSignInStatus(signedInCallback, signedOutCallback);
