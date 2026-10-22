const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const ioClient = require("../client/node_modules/socket.io-client");

dotenv.config({ path: path.join(__dirname, ".env") });

const BASE_URL = `http://localhost:${process.env.PORT || 5001}`;
const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_knot_key";
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/knot";

// Import User model for direct database inspection
const User = require("./models/user");

async function postJSON(url, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${url}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function getJSON(url, token) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${url}`, {
    method: "GET",
    headers,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function putJSON(url, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${url}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function deleteJSON(url, token) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${url}`, {
    method: "DELETE",
    headers,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function createMultipartBody(boundary, fieldName, filename, contentType, content) {
  const fileBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return Buffer.concat([head, fileBuffer, tail]);
}

function createSocket(token) {
  return ioClient(BASE_URL, {
    auth: { token },
    transports: ["websocket"],
  });
}

function waitForEvent(socket, eventName, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(null);
    }, timeoutMs);
    socket.once(eventName, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log("=== STARTING AUTH & USER CONTROLLER BASELINE TESTS ===\n");
  const ts = Date.now();
  let passedCount = 0;
  let failedCount = 0;
  const createdUploadFiles = [];

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passedCount++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failedCount++;
      throw new Error(`Test assertion failed: ${message}`);
    }
  }

  // Connect to DB for internal verification (e.g. password hash checks)
  await mongoose.connect(MONGO_URI);

  let socketB = null;

  try {
    // =========================================================================
    // 1. SIGNUP TESTS
    // =========================================================================
    console.log("1. Testing Registration (POST /api/auth/signup)...");

    // 1a. Missing fields validation
    const missingUsername = await postJSON("/api/auth/signup", {
      email: `test_${ts}@test.com`,
      password: "Password123!",
    });
    assert(missingUsername.status === 400, "Rejects signup without username (400)");
    assert(
      missingUsername.data.message === "All fields are required",
      "Returns 'All fields are required' when username is missing"
    );

    const missingEmail = await postJSON("/api/auth/signup", {
      username: `testuser_${ts}`,
      password: "Password123!",
    });
    assert(missingEmail.status === 400, "Rejects signup without email (400)");

    const missingPassword = await postJSON("/api/auth/signup", {
      username: `testuser_${ts}`,
      email: `test_${ts}@test.com`,
    });
    assert(missingPassword.status === 400, "Rejects signup without password (400)");

    // 1b. Successful registration: User A (Alice)
    const aliceData = {
      username: `alice_${ts}`,
      email: `alice_${ts}@test.com`,
      password: "PasswordAlice123!",
    };
    const regAlice = await postJSON("/api/auth/signup", aliceData);
    assert(regAlice.status === 201, "User Alice registered successfully (201)");
    assert(typeof regAlice.data.token === "string" && regAlice.data.token.length > 0, "JWT token returned for Alice");
    assert(regAlice.data.user && regAlice.data.user.username === aliceData.username, "Alice username matches in response");
    assert(regAlice.data.user.email === aliceData.email, "Alice email matches in response");
    assert(regAlice.data.user.id && regAlice.data.user._id, "Alice user object has both id and _id");
    assert(regAlice.data.user.password === undefined, "Password hash is NOT exposed in signup response");

    const tokenAlice = regAlice.data.token;
    const userAlice = regAlice.data.user;

    // 1c. Password hashing verification in DB
    const aliceDbDoc = await User.findById(userAlice._id);
    assert(aliceDbDoc !== null, "Alice user record exists in database");
    assert(aliceDbDoc.password !== aliceData.password, "Password is NOT stored in plain text");
    assert(
      aliceDbDoc.password.startsWith("$2a$") || aliceDbDoc.password.startsWith("$2b$"),
      "Password is encrypted with bcrypt format ($2a$/$2b$)"
    );

    // 1d. Successful registration: User B (Bob) & User C (Charlie)
    const bobData = {
      username: `bob_${ts}`,
      email: `bob_${ts}@test.com`,
      password: "PasswordBob123!",
    };
    const regBob = await postJSON("/api/auth/signup", bobData);
    assert(regBob.status === 201, "User Bob registered successfully (201)");
    const tokenBob = regBob.data.token;
    const userBob = regBob.data.user;

    const charlieData = {
      username: `charlie_${ts}`,
      email: `charlie_${ts}@test.com`,
      password: "PasswordCharlie123!",
    };
    const regCharlie = await postJSON("/api/auth/signup", charlieData);
    assert(regCharlie.status === 201, "User Charlie registered successfully (201)");
    const tokenCharlie = regCharlie.data.token;
    const userCharlie = regCharlie.data.user;

    // 1e. Duplicate username collision
    const dupUsernameRes = await postJSON("/api/auth/signup", {
      username: aliceData.username,
      email: `different_email_${ts}@test.com`,
      password: "Password123!",
    });
    assert(dupUsernameRes.status === 409, "Rejects duplicate username with 409 Conflict");
    assert(
      dupUsernameRes.data.message === "Username or email already exists",
      "Returns expected collision message"
    );

    // 1f. Duplicate email collision
    const dupEmailRes = await postJSON("/api/auth/signup", {
      username: `different_user_${ts}`,
      email: aliceData.email,
      password: "Password123!",
    });
    assert(dupEmailRes.status === 409, "Rejects duplicate email with 409 Conflict");

    // =========================================================================
    // 2. LOGIN TESTS
    // =========================================================================
    console.log("\n2. Testing Authentication (POST /api/auth/login)...");

    // 2a. Missing fields validation
    const loginMissingEmail = await postJSON("/api/auth/login", {
      password: "PasswordAlice123!",
    });
    assert(loginMissingEmail.status === 400, "Rejects login without email (400)");
    assert(
      loginMissingEmail.data.message === "Email and password are required",
      "Returns 'Email and password are required'"
    );

    const loginMissingPass = await postJSON("/api/auth/login", {
      email: aliceData.email,
    });
    assert(loginMissingPass.status === 400, "Rejects login without password (400)");

    // 2b. Non-existent email
    const loginNonExistent = await postJSON("/api/auth/login", {
      email: `nonexistent_${ts}@test.com`,
      password: "PasswordAlice123!",
    });
    assert(loginNonExistent.status === 401, "Rejects non-existent email with 401 Unauthorized");
    assert(
      loginNonExistent.data.message === "Invalid email or password",
      "Masks non-existent email with generic 'Invalid email or password' (prevents enumeration)"
    );

    // 2c. Incorrect password
    const loginWrongPass = await postJSON("/api/auth/login", {
      email: aliceData.email,
      password: "WrongPassword999!",
    });
    assert(loginWrongPass.status === 401, "Rejects incorrect password with 401 Unauthorized");
    assert(
      loginWrongPass.data.message === "Invalid email or password",
      "Returns identical 'Invalid email or password' message for incorrect password"
    );

    // 2d. Successful login
    const loginSuccess = await postJSON("/api/auth/login", {
      email: aliceData.email,
      password: aliceData.password,
    });
    assert(loginSuccess.status === 200, "Successful login returns 200 OK");
    assert(typeof loginSuccess.data.token === "string" && loginSuccess.data.token.length > 0, "Returns valid JWT token");
    assert(loginSuccess.data.user && loginSuccess.data.user.username === aliceData.username, "Returned user matches Alice");
    assert(loginSuccess.data.user.password === undefined, "Password hash is NOT exposed in login response");

    // =========================================================================
    // 3. GET CURRENT USER (GET /api/auth/me)
    // =========================================================================
    console.log("\n3. Testing Current User (GET /api/auth/me)...");

    // 3a. Valid token
    const meRes = await getJSON("/api/auth/me", tokenAlice);
    assert(meRes.status === 200, "GET /api/auth/me returns 200 with valid token");
    assert(meRes.data.user && meRes.data.user.username === aliceData.username, "Returns correct user profile for Alice");
    assert(meRes.data.user.password === undefined, "Password is excluded from getMe response");

    // 3b. Missing token
    const meNoToken = await getJSON("/api/auth/me");
    assert(meNoToken.status === 401, "Rejects request without Authorization header (401)");

    // 3c. Invalid token format or signature
    const meInvalidToken = await getJSON("/api/auth/me", "invalid.jwt.token");
    assert(meInvalidToken.status === 401, "Rejects invalid JWT token with 401");

    // 3d. Non-existent user with valid JWT
    const fakeUserId = new mongoose.Types.ObjectId();
    const fakeToken = jwt.sign({ userId: fakeUserId }, JWT_SECRET, { expiresIn: "1h" });
    const meNonExistent = await getJSON("/api/auth/me", fakeToken);
    assert(meNonExistent.status === 404, "Returns 404 when token user no longer exists in database");

    // =========================================================================
    // 4. USER SEARCH (GET /api/users/search?q=...)
    // =========================================================================
    console.log("\n4. Testing User Search (GET /api/users/search)...");

    // 4a. Query too short
    const searchShort = await getJSON("/api/users/search?q=a", tokenAlice);
    assert(searchShort.status === 400, "Rejects search query shorter than 2 characters (400)");
    assert(
      searchShort.data.message === "Search query must contain at least 2 characters",
      "Returns expected min-length error message"
    );

    // 4b. Username match
    const searchBobName = await getJSON(`/api/users/search?q=bob_${ts}`, tokenAlice);
    assert(searchBobName.status === 200, "Search by username returns 200");
    assert(searchBobName.data.count >= 1, "Returns at least 1 match for Bob");
    const foundBob = searchBobName.data.users.find((u) => u.username === bobData.username);
    assert(foundBob !== undefined, "Found Bob in search results by username");
    assert(foundBob.password === undefined, "Password is not exposed in search results");

    // 4c. Email match
    const searchCharlieEmail = await getJSON(`/api/users/search?q=charlie_${ts}@test.com`, tokenAlice);
    assert(searchCharlieEmail.status === 200, "Search by email returns 200");
    const foundCharlie = searchCharlieEmail.data.users.find((u) => u.email === charlieData.email);
    assert(foundCharlie !== undefined, "Found Charlie in search results by email");

    // 4d. Case-insensitive matching
    const searchUpperBob = await getJSON(`/api/users/search?q=BOB_${ts}`, tokenAlice);
    assert(searchUpperBob.status === 200, "Case-insensitive search returns 200");
    const foundUpperBob = searchUpperBob.data.users.find((u) => u.username === bobData.username);
    assert(foundUpperBob !== undefined, "Found lowercase user using uppercase query");

    // 4e. Self-exclusion
    const searchSelf = await getJSON(`/api/users/search?q=alice_${ts}`, tokenAlice);
    assert(searchSelf.status === 200, "Self-search returns 200");
    const foundSelf = searchSelf.data.users.find((u) => u.username === aliceData.username);
    assert(foundSelf === undefined, "Searching user is excluded from their own search results");

    // 4f. Result limit (max 20)
    const searchBroad = await getJSON(`/api/users/search?q=test`, tokenAlice);
    assert(searchBroad.status === 200, "Broad search returns 200");
    assert(searchBroad.data.users.length <= 20, "Search results do not exceed limit of 20");

    // 4g. Regex special character safety (prevent ReDoS / crash)
    const specialQuery = "alice.*+?^${}()|[]\\";
    const searchRegex = await getJSON(`/api/users/search?q=${encodeURIComponent(specialQuery)}`, tokenAlice);
    assert(searchRegex.status === 200, "Regex special characters are escaped safely and do not crash the server");

    // =========================================================================
    // 5. USER PROFILE RETRIEVAL (GET /api/users/profile/:userId)
    // =========================================================================
    console.log("\n5. Testing Profile Retrieval (GET /api/users/profile/:userId)...");

    // 5a. Invalid ObjectId
    const profileInvalidId = await getJSON("/api/users/profile/notAnObjectId", tokenAlice);
    assert(profileInvalidId.status === 400, "Rejects invalid ObjectId with 400");
    assert(profileInvalidId.data.message === "Invalid user ID", "Returns 'Invalid user ID'");

    // 5b. Non-existent user ID
    const randomObjectId = new mongoose.Types.ObjectId();
    const profileNotFound = await getJSON(`/api/users/profile/${randomObjectId}`, tokenAlice);
    assert(profileNotFound.status === 404, "Returns 404 for non-existent user profile");

    // 5c. Successful profile retrieval
    const profileSuccess = await getJSON(`/api/users/profile/${userBob._id}`, tokenAlice);
    assert(profileSuccess.status === 200, "Retrieves other user's profile successfully (200)");
    assert(profileSuccess.data.user && profileSuccess.data.user.username === bobData.username, "Profile username matches");
    assert(profileSuccess.data.user.password === undefined, "Password is excluded from user profile");

    // =========================================================================
    // 6. PROFILE UPDATE & REAL-TIME NOTIFICATION (PUT /api/users/profile)
    // =========================================================================
    console.log("\n6. Testing Profile Update (PUT /api/users/profile)...");

    // Connect Bob's socket to listen for real-time profile broadcasts
    socketB = createSocket(tokenBob);
    await new Promise((resolve) => socketB.on("connect", resolve));

    // 6a. Username too short (< 2 chars)
    const updateShortName = await putJSON(
      "/api/users/profile",
      { username: "x" },
      tokenAlice
    );
    assert(updateShortName.status === 400, "Rejects username shorter than 2 characters (400)");

    // 6b. Username collision with existing user
    const updateCollision = await putJSON(
      "/api/users/profile",
      { username: bobData.username },
      tokenAlice
    );
    assert(updateCollision.status === 409, "Rejects changing username to an already taken username (409)");
    assert(
      updateCollision.data.message === "Username is already taken",
      "Returns 'Username is already taken'"
    );

    // 6c. Successful profile update & Socket broadcast verification
    const newAliceName = `alice_viva_${ts}`;
    const newAliceBio = "Preparing for university viva presentation!";

    const eventPromise = waitForEvent(socketB, "user:profile-updated");

    const updateSuccess = await putJSON(
      "/api/users/profile",
      {
        username: newAliceName,
        bio: newAliceBio,
      },
      tokenAlice
    );

    assert(updateSuccess.status === 200, "Profile updated successfully (200)");
    assert(updateSuccess.data.user.username === newAliceName, "Updated username reflected in response");
    assert(updateSuccess.data.user.bio === newAliceBio, "Updated bio reflected in response");
    assert(updateSuccess.data.user.password === undefined, "Password is not exposed in update response");

    const broadcastPayload = await eventPromise;
    assert(broadcastPayload !== null, "Bob received 'user:profile-updated' socket event");
    assert(
      broadcastPayload.user && String(broadcastPayload.user._id) === String(userAlice._id),
      "Socket payload identifies Alice as the updated user"
    );
    assert(broadcastPayload.user.username === newAliceName, "Socket payload contains updated username");

    // =========================================================================
    // 7. AVATAR UPLOAD, STATIC ACCESS & REMOVAL
    // =========================================================================
    console.log("\n7. Testing Avatar Upload & Removal (POST/DELETE /api/users/avatar)...");

    // 7a. Missing file on upload
    const avatarNoFileRes = await fetch(`${BASE_URL}/api/users/avatar`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenAlice}`,
      },
    });
    const avatarNoFileData = await avatarNoFileRes.json().catch(() => ({}));
    assert(avatarNoFileRes.status === 400, "Rejects avatar upload when no file is uploaded (400)");
    assert(
      avatarNoFileData.message === "No image file uploaded",
      "Returns 'No image file uploaded'"
    );

    // 7b. Successful avatar upload
    const boundary = "----TestBoundary" + crypto.randomBytes(6).toString("hex");
    const sampleAvatarContent = "Fake-PNG-Binary-Data-For-KNOT-Avatar-Test";
    const multipartBody = createMultipartBody(
      boundary,
      "file",
      "avatar_test.png",
      "image/png",
      sampleAvatarContent
    );

    const avatarUploadPromise = waitForEvent(socketB, "user:profile-updated");

    const uploadRes = await fetch(`${BASE_URL}/api/users/avatar`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${tokenAlice}`,
      },
      body: multipartBody,
    });
    const uploadData = await uploadRes.json().catch(() => ({}));

    assert(uploadRes.status === 200, "Avatar uploaded successfully (200)");
    assert(typeof uploadData.profilePhoto === "string", "Returns profilePhoto relative URL");
    assert(uploadData.profilePhoto.startsWith("/uploads/attachment-"), "Photo path follows /uploads/attachment- convention");
    assert(uploadData.user && uploadData.user.profilePhoto === uploadData.profilePhoto, "User document updated with new photo URL");

    // Track file for cleanup
    const uploadedFileName = path.basename(uploadData.profilePhoto);
    createdUploadFiles.push(path.join(__dirname, "uploads", uploadedFileName));

    // 7c. Static file access
    const staticRes = await fetch(`${BASE_URL}${uploadData.profilePhoto}`);
    assert(staticRes.status === 200, "Uploaded avatar is accessible via static server endpoint (/uploads/...)");
    const staticContent = await staticRes.text();
    assert(staticContent === sampleAvatarContent, "Static file content matches uploaded data");

    // 7d. Socket notification on avatar upload
    const uploadSocketPayload = await avatarUploadPromise;
    assert(uploadSocketPayload !== null, "Bob received 'user:profile-updated' on avatar upload");
    assert(
      uploadSocketPayload.user.profilePhoto === uploadData.profilePhoto,
      "Socket broadcast carries the new profile photo path"
    );

    // 7e. Avatar removal
    const removeAvatarPromise = waitForEvent(socketB, "user:profile-updated");

    const removeRes = await deleteJSON("/api/users/avatar", tokenAlice);
    assert(removeRes.status === 200, "Avatar removed successfully (200)");
    assert(removeRes.data.user && removeRes.data.user.profilePhoto === "", "profilePhoto reset to empty string");

    // 7f. Socket notification on avatar removal
    const removeSocketPayload = await removeAvatarPromise;
    assert(removeSocketPayload !== null, "Bob received 'user:profile-updated' on avatar removal");
    assert(
      removeSocketPayload.user && removeSocketPayload.user.profilePhoto === "",
      "Socket broadcast carries empty profilePhoto on removal"
    );

    console.log("\n========================================");
    console.log("ALL AUTH & USER BASELINE TESTS PASSED!");
    console.log(`Passed: ${passedCount}`);
    console.log(`Failed: ${failedCount}`);
    console.log("========================================\n");
  } finally {
    // Clean up only the specific avatar file created during this test
    for (const filePath of createdUploadFiles) {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.warn(`Failed to cleanup test file ${filePath}:`, e.message);
        }
      }
    }

    if (socketB) {
      socketB.disconnect();
    }
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error("Test execution aborted due to error:", err);
  process.exit(1);
});
