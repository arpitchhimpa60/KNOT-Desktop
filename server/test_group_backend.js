const ioClient = require("../client/node_modules/socket.io-client");
const mongoose = require("mongoose");

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

async function runTests() {
  console.log("=== STARTING PHASE 2 GROUP CHAT BACKEND TESTS ===");
  const ts = Date.now();
  let passedCount = 0;
  let failedCount = 0;

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

  // 1. Signup test users
  console.log("\n1. Creating test users...");
  const userARes = await postJSON("/api/auth/signup", {
    username: `alice_${ts}`,
    email: `alice_${ts}@test.com`,
    password: "Password123!",
  });
  assert(userARes.status === 201 && userARes.data.token, "User A (Alice) signed up successfully");
  const tokenA = userARes.data.token;
  const userA = userARes.data.user;

  const userBRes = await postJSON("/api/auth/signup", {
    username: `bob_${ts}`,
    email: `bob_${ts}@test.com`,
    password: "Password123!",
  });
  assert(userBRes.status === 201 && userBRes.data.token, "User B (Bob) signed up successfully");
  const tokenB = userBRes.data.token;
  const userB = userBRes.data.user;

  const userCRes = await postJSON("/api/auth/signup", {
    username: `charlie_${ts}`,
    email: `charlie_${ts}@test.com`,
    password: "Password123!",
  });
  assert(userCRes.status === 201 && userCRes.data.token, "User C (Charlie) signed up successfully");
  const tokenC = userCRes.data.token;
  const userC = userCRes.data.user;

  // 2. User Search check (existing feature)
  console.log("\n2. Verifying existing user search...");
  const searchRes = await getJSON(`/api/users/search?q=alice_${ts}`, tokenB);
  assert(searchRes.status === 200 && searchRes.data.users.length > 0, "User search works as expected");

  // 3. User A creates a group
  console.log("\n3. Testing Group Creation (POST /api/groups)...");
  const createInvalidRes = await postJSON("/api/groups", { name: "" }, tokenA);
  assert(createInvalidRes.status === 400, "Rejects empty group name with 400");

  const createGroupRes = await postJSON("/api/groups", {
    name: "Engineering Core",
    description: "Core team discussions",
  }, tokenA);
  assert(createGroupRes.status === 201, "Group created with 201 status");
  const group = createGroupRes.data.group;
  assert(group.name === "Engineering Core", "Group name matches input");
  assert(String(group.creator._id || group.creator) === String(userA.id), "Creator is set to User A");
  assert(group.members.some(m => String(m._id || m) === String(userA.id)), "Creator is automatically in members");
  assert(group.admins.some(a => String(a._id || a) === String(userA.id)), "Creator is automatically in admins");

  const groupId = group._id;

  // 4. List groups for authenticated user
  console.log("\n4. Testing List Groups (GET /api/groups)...");
  const listGroupsA = await getJSON("/api/groups", tokenA);
  assert(listGroupsA.status === 200 && listGroupsA.data.groups.some(g => String(g._id) === String(groupId)), "User A can list their group");

  const listGroupsB = await getJSON("/api/groups", tokenB);
  assert(listGroupsB.status === 200 && !listGroupsB.data.groups.some(g => String(g._id) === String(groupId)), "User B cannot see group they are not a member of");

  // 5. Access group details
  console.log("\n5. Testing Group Details by ID (GET /api/groups/:groupId)...");
  const getGroupB = await getJSON(`/api/groups/${groupId}`, tokenB);
  assert(getGroupB.status === 403, "Non-member User B cannot view group details (403)");

  const getGroupA = await getJSON(`/api/groups/${groupId}`, tokenA);
  assert(getGroupA.status === 200 && getGroupA.data.group.name === "Engineering Core", "Member User A can view group details");

  // 6. Membership Management: Add members
  console.log("\n6. Testing Membership Management (POST /api/groups/:groupId/members)...");
  const nonAdminAdd = await postJSON(`/api/groups/${groupId}/members`, { memberIds: [userC.id] }, tokenB);
  assert(nonAdminAdd.status === 403, "Non-admin cannot add members (403)");

  const adminAddRes = await postJSON(`/api/groups/${groupId}/members`, { memberIds: [userB.id] }, tokenA);
  assert(adminAddRes.status === 200 && adminAddRes.data.addedCount === 1, "Admin adds User B successfully (200)");

  // 7. Duplicate member addition (idempotence)
  console.log("\n7. Testing Idempotent / Duplicate Member Addition...");
  const dupAddRes = await postJSON(`/api/groups/${groupId}/members`, { memberIds: [userB.id] }, tokenA);
  assert(dupAddRes.status === 200 && dupAddRes.data.addedCount === 0, "Duplicate member addition handled idempotently (addedCount 0)");

  // 8. Add User C as well
  const addCRes = await postJSON(`/api/groups/${groupId}/members`, { memberIds: [userC.id] }, tokenA);
  assert(addCRes.status === 200 && addCRes.data.addedCount === 1, "Admin adds User C successfully");

  // Verify User B can now get group details
  const getGroupBAfter = await getJSON(`/api/groups/${groupId}`, tokenB);
  assert(getGroupBAfter.status === 200, "User B is now member and can access group details");

  // 9. Real-time Group Chat & Sockets test
  console.log("\n8. Testing Real-time Group Chat with Socket.IO...");
  const socketA = createSocket(tokenA);
  const socketB = createSocket(tokenB);
  const socketC = createSocket(tokenC);

  await new Promise((resolve) => {
    let connected = 0;
    const check = () => { if (++connected === 3) resolve(); };
    socketA.on("connect", check);
    socketB.on("connect", check);
    socketC.on("connect", check);
  });
  console.log("  Sockets A, B, and C connected successfully");

  // Wait a moment for room joins on connection
  await sleep(300);

  // Set up listeners for socket events
  let bReceivedMessage = null;
  let cReceivedMessage = null;
  socketB.on("group:message:new", (msg) => { bReceivedMessage = msg; });
  socketC.on("group:message:new", (msg) => { cReceivedMessage = msg; });

  // 10. Send group message
  console.log("\n9. Testing Send Group Message (POST /api/groups/:groupId/messages)...");
  const sendRes = await postJSON(`/api/groups/${groupId}/messages`, {
    text: "Welcome to the Engineering Core group!",
  }, tokenA);
  assert(sendRes.status === 201, "Message sent successfully with status 201");
  const messageA1 = sendRes.data.data;
  assert(messageA1.text === "Welcome to the Engineering Core group!", "Message text matches");

  // Wait for sockets to receive
  await sleep(300);
  assert(bReceivedMessage && String(bReceivedMessage._id) === String(messageA1._id), "User B received new message via socket in real-time");
  assert(cReceivedMessage && String(cReceivedMessage._id) === String(messageA1._id), "User C received new message via socket in real-time");

  // 11. Reply to group message
  console.log("\n10. Testing Reply to Group Message...");
  const replyRes = await postJSON(`/api/groups/${groupId}/messages`, {
    text: "Thanks Alice! Glad to be here.",
    replyTo: messageA1._id,
  }, tokenB);
  assert(replyRes.status === 201, "Reply message sent successfully");
  const replyMsg = replyRes.data.data;
  assert(replyMsg.replyTo && String(replyMsg.replyTo._id || replyMsg.replyTo) === String(messageA1._id), "Reply reference preserved correctly");

  // 12. Edit group message
  console.log("\n11. Testing Edit Group Message (PATCH /api/groups/:groupId/messages/:messageId)...");
  let bEditedNotice = null;
  socketB.on("group:message:edited", (data) => { bEditedNotice = data; });

  const unauthorizedEdit = await patchJSON(`/api/groups/${groupId}/messages/${messageA1._id}`, {
    text: "Hacked by Bob",
  }, tokenB);
  assert(unauthorizedEdit.status === 403, "Non-sender User B cannot edit User A's message (403)");

  const validEdit = await patchJSON(`/api/groups/${groupId}/messages/${messageA1._id}`, {
    text: "Welcome to the Engineering Core group! (Updated announcement)",
  }, tokenA);
  assert(validEdit.status === 200 && validEdit.data.data.isEdited === true, "Sender User A edits message (200, isEdited=true)");

  await sleep(300);
  assert(bEditedNotice && bEditedNotice.text.includes("Updated announcement"), "User B received group:message:edited socket event");

  // 13. Delete group message (soft delete)
  console.log("\n12. Testing Delete Group Message (DELETE /api/groups/:groupId/messages/:messageId)...");
  let bDeletedNotice = null;
  socketB.on("group:message:deleted", (data) => { bDeletedNotice = data; });

  const unauthorizedDelete = await deleteJSON(`/api/groups/${groupId}/messages/${messageA1._id}`, tokenC);
  assert(unauthorizedDelete.status === 403, "Non-sender non-admin User C cannot delete message (403)");

  const validDelete = await deleteJSON(`/api/groups/${groupId}/messages/${messageA1._id}`, tokenA);
  assert(validDelete.status === 200 && validDelete.data.data.deleted === true, "Sender deletes message (soft delete 200)");
  assert(validDelete.data.data.text === "This message was deleted", "Deleted message text masked");

  await sleep(300);
  assert(bDeletedNotice && bDeletedNotice.deleted === true, "User B received group:message:deleted socket event");

  // 14. Message history pagination
  console.log("\n13. Testing Paginated Group Messages (GET /api/groups/:groupId/messages)...");
  const historyRes = await getJSON(`/api/groups/${groupId}/messages?limit=10&page=1`, tokenB);
  assert(historyRes.status === 200, "Message history retrieved with 200 status");
  assert(historyRes.data.messages.length >= 2, "Returned at least 2 messages");
  assert(historyRes.data.total >= 2, "Total message count matches");

  // Non-member cannot retrieve messages
  const userDRes = await postJSON("/api/auth/signup", {
    username: `outsider_${ts}`,
    email: `outsider_${ts}@test.com`,
    password: "Password123!",
  });
  const tokenD = userDRes.data.token;
  const outsiderMessages = await getJSON(`/api/groups/${groupId}/messages`, tokenD);
  assert(outsiderMessages.status === 403, "Non-member outsider cannot retrieve group messages (403)");

  // 15. Group Typing Indicator
  console.log("\n14. Testing Group Typing Indicator...");
  let bTypingUpdate = null;
  let aTypingUpdate = null;
  socketB.on("group:typing:update", (t) => { bTypingUpdate = t; });
  socketA.on("group:typing:update", (t) => { aTypingUpdate = t; });

  socketA.emit("group:typing", { groupId, isTyping: true });
  await sleep(300);
  assert(bTypingUpdate && bTypingUpdate.isTyping === true && String(bTypingUpdate.userId) === String(userA.id), "User B received typing indicator for User A");
  assert(aTypingUpdate === null, "Originating sender User A does NOT receive own typing event");

  // 16. Update group name/description
  console.log("\n15. Testing Group Details Update (PATCH /api/groups/:groupId)...");
  let groupUpdatedNotice = null;
  socketB.on("group:updated", (u) => { groupUpdatedNotice = u; });

  const updateNonAdmin = await patchJSON(`/api/groups/${groupId}`, { name: "New Name" }, tokenB);
  assert(updateNonAdmin.status === 403, "Non-admin User B cannot update group (403)");

  const updateAdmin = await patchJSON(`/api/groups/${groupId}`, {
    name: "Engineering Core - Renamed",
    description: "Updated description",
  }, tokenA);
  assert(updateAdmin.status === 200 && updateAdmin.data.group.name === "Engineering Core - Renamed", "Admin User A updates group successfully");

  await sleep(300);
  assert(groupUpdatedNotice && groupUpdatedNotice.group.name === "Engineering Core - Renamed", "Group update broadcast to room");

  // 17. Member removal and room access revocation
  console.log("\n16. Testing Member Removal & Real-time Room Eviction...");
  let cRemovedNotice = null;
  socketC.on("group:member:removed", (r) => { cRemovedNotice = r; });

  const removeCRes = await deleteJSON(`/api/groups/${groupId}/members/${userC.id}`, tokenA);
  assert(removeCRes.status === 200, "Admin removed User C from group");

  await sleep(300);
  assert(cRemovedNotice && String(cRemovedNotice.removedUserId) === String(userC.id), "User C received group:member:removed notice");

  // Now verify User C is evicted from room: User A sends another message
  let cReceivedPostRemoval = null;
  socketC.on("group:message:new", (msg) => { cReceivedPostRemoval = msg; });

  await postJSON(`/api/groups/${groupId}/messages`, { text: "Message after Charlie was removed" }, tokenA);
  await sleep(300);
  assert(cReceivedPostRemoval === null, "Removed User C did NOT receive message in room");

  const cHistoryAfter = await getJSON(`/api/groups/${groupId}/messages`, tokenC);
  assert(cHistoryAfter.status === 403, "Removed User C cannot retrieve message history (403)");

  // 18. Safe Admin Leaving & Promotion
  console.log("\n17. Testing Admin Role Safety on Leave...");
  const prematureLeave = await deleteJSON(`/api/groups/${groupId}/leave`, tokenA);
  assert(prematureLeave.status === 400, "Sole admin User A cannot leave without assigning another admin (400)");

  // Promote User B to admin
  const promoteB = await postJSON(`/api/groups/${groupId}/admins`, { userId: userB.id }, tokenA);
  assert(promoteB.status === 200, "User B promoted to admin");

  // User A leaves
  const leaveA = await deleteJSON(`/api/groups/${groupId}/leave`, tokenA);
  assert(leaveA.status === 200, "User A leaves group safely now that User B is admin");

  // 19. Group Deletion
  console.log("\n18. Testing Group Deletion (DELETE /api/groups/:groupId)...");
  let bDeletedGroupNotice = null;
  socketB.on("group:deleted", (d) => { bDeletedGroupNotice = d; });

  const deleteGroupRes = await deleteJSON(`/api/groups/${groupId}`, tokenB);
  assert(deleteGroupRes.status === 200, "Admin User B deletes group successfully");

  await sleep(300);
  assert(bDeletedGroupNotice && String(bDeletedGroupNotice.groupId) === String(groupId), "Broadcast group:deleted received by members");

  const getDeletedGroup = await getJSON(`/api/groups/${groupId}`, tokenB);
  assert(getDeletedGroup.status === 404, "Deleted group returns 404");

  // 20. Backward Compatibility Test: Direct 1-to-1 Messaging
  console.log("\n19. Testing Backward Compatibility (Direct 1:1 Messages)...");
  let bReceivedDirectMsg = null;
  socketB.on("new-message", (msg) => { bReceivedDirectMsg = msg; });

  const dmSend = await postJSON("/api/messages", {
    recipientId: userB.id,
    text: "Hello Bob! Direct message check.",
  }, tokenA);
  assert(dmSend.status === 201, "Direct message sent with 201");
  const dm = dmSend.data.data;

  await sleep(300);
  assert(bReceivedDirectMsg && String(bReceivedDirectMsg._id) === String(dm._id), "Direct message received via socket 'new-message' in real-time");

  // Direct message delivered status
  const deliverRes = await patchJSON(`/api/messages/${dm._id}/delivered`, {}, tokenB);
  assert(deliverRes.status === 200, "Direct message marked delivered");

  // Direct message read status
  const readRes = await patchJSON("/api/messages/read", {
    senderId: userA.id,
    messageIds: [dm._id],
  }, tokenB);
  assert(readRes.status === 200, "Direct message marked read");

  // Direct message edit
  const editDm = await patchJSON(`/api/messages/${dm._id}`, {
    text: "Hello Bob! Direct message check. (Edited)",
  }, tokenA);
  assert(editDm.status === 200 && editDm.data.data.isEdited === true, "Direct message edited successfully");

  // Direct message delete
  const deleteDm = await deleteJSON(`/api/messages/${dm._id}`, tokenA);
  assert(deleteDm.status === 200 && deleteDm.data.data.deleted === true, "Direct message deleted successfully");

  // Direct message chat history
  const dmHistory = await getJSON(`/api/messages/${userB.id}`, tokenA);
  assert(dmHistory.status === 200 && dmHistory.data.messages.length > 0, "Direct message chat history works");

  // Direct 1:1 typing indicator
  let bDirectTyping = null;
  socketB.on("typing-update", (t) => { bDirectTyping = t; });
  socketA.emit("typing", { recipientId: userB.id, isTyping: true });
  await sleep(300);
  assert(bDirectTyping && bDirectTyping.isTyping === true && String(bDirectTyping.userId) === String(userA.id), "Direct typing indicator works");

  // Cleanup sockets
  socketA.disconnect();
  socketB.disconnect();
  socketC.disconnect();

  console.log(`\n========================================`);
  console.log(`ALL TESTS COMPLETED SUCCESSFULLY!`);
  console.log(`Total assertions passed: ${passedCount}`);
  console.log(`Total assertions failed: ${failedCount}`);
  console.log(`========================================`);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
