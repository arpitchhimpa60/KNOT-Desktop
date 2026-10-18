import { io } from "socket.io-client";

const senderToken = process.env.SENDER_TOKEN;
const receiverToken = process.env.RECEIVER_TOKEN;
const recipientId = process.env.RECIPIENT_ID;

if (!senderToken || !receiverToken || !recipientId) {
  throw new Error("Missing test credentials");
}

const sender = io("http://localhost:5001", {
  auth: { token: senderToken },
});

const receiver = io("http://localhost:5001", {
  auth: { token: receiverToken },
});

let senderConnected = false;
let receiverConnected = false;
let sent = false;

receiver.on("new-message", (message) => {
  console.log("Rahul received:", message.text);
  sender.disconnect();
  receiver.disconnect();
});

sender.on("connect", () => {
  console.log("Arpit connected");
  senderConnected = true;
  sendWhenReady();
});

receiver.on("connect", () => {
  console.log("Rahul connected");
  receiverConnected = true;
  sendWhenReady();
});

function sendWhenReady() {
  if (!senderConnected || !receiverConnected || sent) return;
  sent = true;

  fetch("http://localhost:5001/api/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${senderToken}`,
    },
    body: JSON.stringify({
      recipientId,
      text: "Real-time test from KNOT!",
    }),
  })
    .then(async (response) => {
      const data = await response.json();
      console.log("API response:", response.status, data.message);
    })
    .catch(console.error);
}

sender.on("connect_error", (err) =>
  console.error("Arpit connection error:", err.message)
);

receiver.on("connect_error", (err) =>
  console.error("Rahul connection error:", err.message)
);