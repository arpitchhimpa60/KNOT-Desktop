
const API_URL = "http://localhost:5001/api";

export async function loginUser(email, password) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Login failed");
  }

  return data;
}

export async function signupUser(username, email, password) {
  const response = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Signup failed");
  }

  return data;
}

export async function getCurrentUser(token) {
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch user");
  }

  return data.user;
}


export async function searchUsers(token, query) {
  const response = await fetch(
    `${API_URL}/users/search?q=${encodeURIComponent(query)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to search users");
  }

  // Adjust this if your controller returns a different response shape.
  return data.users;
}


export async function getChatHistory(token, userId) {
  const response = await fetch(
    `${API_URL}/messages/${encodeURIComponent(userId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to load chat history");
  }

  return data.messages;
}



export async function sendChatMessage(
  token,
  recipientId,
  text,
  replyTo = null
) {
  const response = await fetch(`${API_URL}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      recipientId,
      text,
      ...(replyTo ? { replyTo } : {}),
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not send message");
  }

  return data.data;
}




export async function markMessageDelivered(token, messageId) {
  const response = await fetch(
    `${API_URL}/messages/${messageId}/delivered`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not update delivery status");
  }

  return data.data;
}

export async function markMessagesRead(token, senderId, messageIds) {
  const response = await fetch(`${API_URL}/messages/read`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ senderId, messageIds }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not mark messages as read");
  }

  return data;
}
