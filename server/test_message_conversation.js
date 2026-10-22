const ioClient = require("../client/node_modules/socket.io-client");
const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:5001";

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

async function patchJSON(url, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${url}`, {
    method: "PATCH",
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

function createSocket(token) {
  return ioClient(BASE_URL, {
    auth: { token },
    transports: ["websocket"],
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failedCount++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log("=== STARTING MESSAGE & CONVERSATION CONTROLLER TESTS ===");
  const ts = Date.now();

  // 1. Setup Users: User A (Alice), User B (Bob), User C (Charlie)
  console.log("\n1. Creating test users...");
  const uARes = await postJSON("/api/auth/signup", {
    username: `alice_msg_${ts}`,
    email: `alice_msg_${ts}@test.com`,
    password: "Password123!",
  });
  const tokenA = uARes.data.token;
  const userA = uARes.data.user;

  const uBRes = await postJSON("/api/auth/signup", {
    username: `bob_msg_${ts}`,
    email: `bob_msg_${ts}@test.com`,
    password: "Password123!",
  });
  const tokenB = uBRes.data.token;
  const userB = uBRes.data.user;

  const uCRes = await postJSON("/api/auth/signup", {
    username: `charlie_msg_${ts}`,
    email: `charlie_msg_${ts}@test.com`,
    password: "Password123!",
  });
  const tokenC = uCRes.data.token;
  const userC = uCRes.data.user;

  assert(tokenA && tokenB && tokenC, "All 3 test users created with tokens");

  // Connect sockets for Alice and Bob
  const socketA = createSocket(tokenA);
  const socketB = createSocket(tokenB);
  await sleep(400);

  // 2. Direct message sending & First Contact / Request detection
  console.log("\n2. Testing Send Direct Message & Conversation Request...");
  let bReceivedNewMessage = null;
  let bReceivedRequest = null;
  let bConversationUpdated = null;

  socketB.on("new-message", (m) => { bReceivedNewMessage = m; });
  socketB.on("conversation:request", (r) => { bReceivedRequest = r; });
  socketB.on("conversation:updated", (u) => { bConversationUpdated = u; });

  const sendRes = await postJSON("/api/messages", {
    recipientId: userB.id,
    text: "Hello Bob! First contact message.",
  }, tokenA);

  assert(sendRes.status === 201, "Message created with status 201");
  const msg1 = sendRes.data.data;
  assert(msg1.text === "Hello Bob! First contact message.", "Message text matches");
  assert(String(msg1.sender) === String(userA.id), "Sender matches Alice");
  assert(String(msg1.recipient) === String(userB.id), "Recipient matches Bob");

  await sleep(400);
  assert(bReceivedNewMessage && String(bReceivedNewMessage._id) === String(msg1._id), "Bob received new-message socket event");
  assert(bReceivedRequest && String(bReceivedRequest.message._id) === String(msg1._id), "Bob received conversation:request socket event on first contact");
  assert(bConversationUpdated && String(bConversationUpdated.userId) === String(userA.id), "Bob received conversation:updated socket event");

  // 3. Conversation list & requests endpoints
  console.log("\n3. Testing Conversation List & Requests...");
  const bRequestsRes = await getJSON("/api/conversations/requests", tokenB);
  assert(bRequestsRes.status === 200, "Bob gets conversation requests with 200");
  assert(bRequestsRes.data.requests.length >= 1, "Bob has at least 1 pending request");
  assert(String(bRequestsRes.data.requests[0].user._id) === String(userA.id), "Pending request is from Alice");

  const bConvsRes = await getJSON("/api/conversations", tokenB);
  assert(bConvsRes.status === 200, "Bob gets conversation list with 200");
  assert(bConvsRes.data.requestCount >= 1, "requestCount in conversation list is accurate");

  // 4. Accept Conversation Request
  console.log("\n4. Testing Accept Conversation Request...");
  const acceptRes = await patchJSON(`/api/conversations/${userA.id}/accept`, {}, tokenB);
  assert(acceptRes.status === 200, "Bob accepted conversation request from Alice (200)");

  // Check requests list again - should now be active conversation, not request
  const bRequestsAfter = await getJSON("/api/conversations/requests", tokenB);
  assert(bRequestsAfter.data.requests.length === 0, "Bob has 0 pending requests after accepting");

  const bConvsAfter = await getJSON("/api/conversations", tokenB);
  assert(bConvsAfter.data.conversations.some((c) => String(c.user._id) === String(userA.id)), "Alice is now in Bob's active conversations list");

  // 5. Reply to Message
  console.log("\n5. Testing Reply to Message...");
  const replyRes = await postJSON("/api/messages", {
    recipientId: userA.id,
    text: "Hey Alice! Great to hear from you.",
    replyTo: msg1._id,
  }, tokenB);
  assert(replyRes.status === 201, "Reply message created with status 201");
  const msg2 = replyRes.data.data;
  assert(String(msg2.replyTo) === String(msg1._id), "Reply references original message");

  // Invalid replyTo validation
  const invalidReply = await postJSON("/api/messages", {
    recipientId: userA.id,
    text: "Invalid reply",
    replyTo: "not-an-id",
  }, tokenB);
  assert(invalidReply.status === 400, "Rejects invalid replyTo with 400");

  // Cannot send to self validation
  const selfSend = await postJSON("/api/messages", {
    recipientId: userB.id,
    text: "Talking to myself",
  }, tokenB);
  assert(selfSend.status === 400, "Rejects sending message to oneself with 400");

  // 6. Chat History & Target Message Pagination
  console.log("\n6. Testing Chat History & Target Message Pagination...");
  const historyRes = await getJSON(`/api/messages/${userB.id}`, tokenA);
  assert(historyRes.status === 200, "Chat history retrieved with 200");
  assert(historyRes.data.count >= 2, "Returned at least 2 messages");

  const targetHistoryRes = await getJSON(`/api/messages/${userB.id}?targetMessageId=${msg1._id}`, tokenA);
  assert(targetHistoryRes.status === 200, "Chat history with targetMessageId retrieved with 200");
  assert(targetHistoryRes.data.messages.some((m) => String(m._id) === String(msg1._id)), "Target message is included");

  // 7. Delivery and Read Status Receipts
  console.log("\n7. Testing Delivery and Read Status Receipts...");
  // Send a fresh message from Alice to Bob
  const sendFresh = await postJSON("/api/messages", {
    recipientId: userB.id,
    text: "Status receipt test message",
  }, tokenA);
  const msg3 = sendFresh.data.data;

  let aReceivedStatus = null;
  socketA.on("message-status", (s) => { aReceivedStatus = s; });

  const deliveredRes = await patchJSON(`/api/messages/${msg3._id}/delivered`, {}, tokenB);
  assert(deliveredRes.status === 200, "Mark message delivered returns 200");
  await sleep(300);
  assert(aReceivedStatus && aReceivedStatus.status === "delivered", "Alice received message-status socket event for delivery");

  // Already acknowledged check
  const redeliverRes = await patchJSON(`/api/messages/${msg3._id}/delivered`, {}, tokenB);
  assert(redeliverRes.status === 200 && redeliverRes.data.message === "Message already acknowledged", "Gracefully handles already delivered status");

  let aReceivedReadNotice = null;
  socketA.on("messages-read", (r) => { aReceivedReadNotice = r; });

  const readRes = await patchJSON("/api/messages/read", {
    senderId: userA.id,
    messageIds: [msg3._id],
  }, tokenB);
  assert(readRes.status === 200, "Mark messages read returns 200");
  await sleep(300);
  assert(aReceivedReadNotice && aReceivedReadNotice.messageIds.includes(String(msg3._id)), "Alice received messages-read socket notification");

  // 8. Edit and Delete Message
  console.log("\n8. Testing Edit and Delete Message...");
  let bReceivedEdit = null;
  socketB.on("message-edited", (e) => { bReceivedEdit = e; });

  const editRes = await patchJSON(`/api/messages/${msg1._id}`, {
    text: "Hello Bob! First contact message (Edited).",
  }, tokenA);
  assert(editRes.status === 200 && editRes.data.data.isEdited === true, "Sender edited message successfully");
  await sleep(300);
  assert(bReceivedEdit && bReceivedEdit.isEdited === true, "Bob received message-edited socket notification");

  // Non-sender cannot edit
  const unauthorizedEdit = await patchJSON(`/api/messages/${msg1._id}`, { text: "Hacked!" }, tokenB);
  assert(unauthorizedEdit.status === 404, "Non-sender cannot edit message (404)");

  let bReceivedDelete = null;
  socketB.on("message-deleted", (d) => { bReceivedDelete = d; });

  const deleteRes = await deleteJSON(`/api/messages/${msg1._id}`, tokenA);
  assert(deleteRes.status === 200 && deleteRes.data.data.deleted === true, "Sender soft-deleted message successfully");
  assert(deleteRes.data.data.text === "This message was deleted", "Soft-deleted message text masked");
  await sleep(300);
  assert(bReceivedDelete && bReceivedDelete.deleted === true, "Bob received message-deleted socket notification");

  // 9. Multipart File Upload & Attachment Streaming
  console.log("\n9. Testing File Upload & Attachment Streaming...");
  const boundary = "---------------------------" + Date.now();
  const fileContent = "Hello from KNOT attachment test!";
  const postData = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="recipientId"`,
    ``,
    userB.id,
    `--${boundary}`,
    `Content-Disposition: form-data; name="text"`,
    ``,
    "Here is an attached file",
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="test.txt"`,
    `Content-Type: text/plain`,
    ``,
    fileContent,
    `--${boundary}--`,
  ].join("\r\n");

  const uploadRes = await fetch(`${BASE_URL}/api/messages/upload`, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      Authorization: `Bearer ${tokenA}`,
    },
    body: postData,
  });
  const uploadData = await uploadRes.json();
  assert(uploadRes.status === 201, "Uploaded file and sent message with status 201");
  const uploadMsg = uploadData.data;
  assert(uploadMsg.attachment && uploadMsg.attachment.originalName === "test.txt", "Attachment metadata saved");

  // Download attachment
  const downloadRes = await fetch(`${BASE_URL}/api/messages/${uploadMsg._id}/attachment`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const downloadedText = await downloadRes.text();
  assert(downloadRes.status === 200, "Attachment downloaded with 200");
  assert(downloadedText === fileContent, "Downloaded attachment content matches uploaded file");

  // Unauthorized third party User C cannot download attachment
  const unauthorizedDownload = await fetch(`${BASE_URL}/api/messages/${uploadMsg._id}/attachment`, {
    headers: { Authorization: `Bearer ${tokenC}` },
  });
  assert(unauthorizedDownload.status === 403, "Non-participant Charlie cannot download attachment (403)");

  // Inline view attachment with query token (for img tags)
  const viewRes = await fetch(`${BASE_URL}/api/messages/${uploadMsg._id}/view?token=${tokenB}`);
  const viewedText = await viewRes.text();
  assert(viewRes.status === 200, "View attachment inline with query token returns 200");
  assert(viewedText === fileContent, "Viewed attachment content matches");

  // 10. Decline Conversation Request
  console.log("\n10. Testing Decline Conversation Request...");
  // Charlie sends a first-contact message to Alice
  const cSendRes = await postJSON("/api/messages", {
    recipientId: userA.id,
    text: "Hi Alice, I am Charlie!",
  }, tokenC);
  assert(cSendRes.status === 201, "Charlie sent first contact message to Alice");

  const aRequests = await getJSON("/api/conversations/requests", tokenA);
  assert(aRequests.data.requests.some((r) => String(r.user._id) === String(userC.id)), "Alice has pending request from Charlie");

  // Alice declines Charlie's request
  const declineRes = await postJSON(`/api/conversations/${userC.id}/decline`, {}, tokenA);
  assert(declineRes.status === 200, "Alice declined Charlie's request (200)");

  const aRequestsAfter = await getJSON("/api/conversations/requests", tokenA);
  assert(!aRequestsAfter.data.requests.some((r) => String(r.user._id) === String(userC.id)), "Charlie is cleared from Alice's requests");

  // Cleanup sockets
  socketA.disconnect();
  socketB.disconnect();

  console.log(`\n========================================`);
  console.log(`ALL MESSAGE & CONVERSATION TESTS PASSED!`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log(`========================================`);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
