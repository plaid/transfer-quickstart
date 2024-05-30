import { callMyServer } from "./utils.js";

const noop = () => { };

/**
 * Methods to handle signing in and signing out. Because this is just
 * a sample, we decided to skip the whole "creating a password" thing.
 */

/**
 * Create a new user and then call the signedInCallback when we're done.
 */
export const createNewUser = async function (
  signedInCallback,
  newUsername,
  newFirstName,
  newLastName
) {
  await callMyServer("/server/users/create", true, {
    username: newUsername,
    firstName: newFirstName,
    lastName: newLastName,
  });
  await refreshSignInStatus(signedInCallback, noop);
};

/**
 * Sign the user in and then call our "refreshSignInStatus" method  
 * with whatever callback function we passed in
 */
export const signIn = async function (signedInCallback) {
  const userId = document.querySelector("#existingUsersSelect").value;
  await callMyServer("/server/users/sign_in", true, { userId: userId });
  await refreshSignInStatus(signedInCallback, noop);
};

/**
 * Sign the user out and then call our "refreshSignInStatus" method  
 * with whatever callback function we passed in
 */
export const signOut = async function (signedOutCallback) {
  await callMyServer("/server/users/sign_out", true);
  await refreshSignInStatus(noop, signedOutCallback);
};

/**
 * This is typically called at the beginning of a page load to determine
 * what to do based on our user's sign-in status. There are two callbacks
 * that we pass in: one for when the user is signed in and one for when
 * the user is signed out.
 */
export const refreshSignInStatus = async function (
  signedInCallback,
  signedOutCallback
) {
  const userInfoObj = await callMyServer("/server/users/get_my_info");
  const userInfo = userInfoObj.userInfo;
  if (userInfo == null) {
    signedOutCallback();
  } else {
    signedInCallback(userInfo);
  }
};
