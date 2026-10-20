
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


export async function getChatHistory(token, userId, options = {}) {
  const query = new URLSearchParams();
  if (options.targetMessageId) {
    query.set("targetMessageId", options.targetMessageId);
  }
  const qs = query.toString() ? `?${query.toString()}` : "";
  const response = await fetch(
    `${API_URL}/messages/${encodeURIComponent(userId)}${qs}`,
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



export async function editChatMessage(token, messageId, text) {
  const response = await fetch(`${API_URL}/messages/${messageId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not edit message");
  }

  return data.data;
}

export async function deleteChatMessage(token, messageId) {
  const response = await fetch(`${API_URL}/messages/${messageId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not delete message");
  }

  return data.data;
}

// ---------------------------------------------------------------------------
// Recent Conversations & Requests API Helpers
// ---------------------------------------------------------------------------

export async function fetchConversations(token) {
  const response = await fetch(`${API_URL}/conversations`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch conversations");
  }

  return data;
}

export async function fetchConversationRequests(token) {
  const response = await fetch(`${API_URL}/conversations/requests`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch conversation requests");
  }

  return data.requests;
}

export async function acceptConversation(token, userId) {
  const response = await fetch(`${API_URL}/conversations/${encodeURIComponent(userId)}/accept`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not accept conversation");
  }

  return data;
}

export async function declineConversation(token, userId) {
  const response = await fetch(`${API_URL}/conversations/${encodeURIComponent(userId)}/decline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not decline conversation");
  }

  return data;
}

// ---------------------------------------------------------------------------
// Group Chat API Helpers
// ---------------------------------------------------------------------------

export async function fetchGroups(token) {
  const response = await fetch(`${API_URL}/groups`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch groups");
  }

  return data.groups;
}

export async function createGroup(token, { name, description, memberIds }) {
  const response = await fetch(`${API_URL}/groups`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name, description, memberIds }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to create group");
  }

  return data.group;
}

export async function getGroupDetails(token, groupId) {
  const response = await fetch(`${API_URL}/groups/${encodeURIComponent(groupId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to load group details");
  }

  return data.group;
}

export async function updateGroupDetails(token, groupId, { name, description }) {
  const response = await fetch(`${API_URL}/groups/${encodeURIComponent(groupId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name, description }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to update group");
  }

  return data.group;
}

export async function addGroupMembers(token, groupId, memberIds) {
  const response = await fetch(`${API_URL}/groups/${encodeURIComponent(groupId)}/members`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ memberIds }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to add members");
  }

  return data;
}

export async function removeGroupMember(token, groupId, userId) {
  const response = await fetch(
    `${API_URL}/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to remove member");
  }

  return data;
}

export async function leaveGroup(token, groupId) {
  const response = await fetch(`${API_URL}/groups/${encodeURIComponent(groupId)}/leave`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to leave group");
  }

  return data;
}

export async function deleteGroup(token, groupId) {
  const response = await fetch(`${API_URL}/groups/${encodeURIComponent(groupId)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to delete group");
  }

  return data;
}

export async function getGroupMessages(
  token,
  groupId,
  page = 1,
  limit = 50,
  options = {}
) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (options.targetMessageId) {
    query.set("targetMessageId", options.targetMessageId);
  }
  const response = await fetch(
    `${API_URL}/groups/${encodeURIComponent(groupId)}/messages?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to load group messages");
  }

  return data;
}

export async function sendGroupMessage(token, groupId, text, replyTo = null) {
  const response = await fetch(`${API_URL}/groups/${encodeURIComponent(groupId)}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      text,
      ...(replyTo ? { replyTo } : {}),
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not send group message");
  }

  return data.data;
}

export async function editGroupMessage(token, groupId, messageId, text) {
  const response = await fetch(
    `${API_URL}/groups/${encodeURIComponent(groupId)}/messages/${encodeURIComponent(messageId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not edit group message");
  }

  return data.data;
}

export async function deleteGroupMessage(token, groupId, messageId) {
  const response = await fetch(
    `${API_URL}/groups/${encodeURIComponent(groupId)}/messages/${encodeURIComponent(messageId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not delete group message");
  }

  return data.data;
}

// ---------------------------------------------------------------------------
// Attachment Upload & Download API Helpers
// ---------------------------------------------------------------------------

export async function uploadChatMessage(
  token,
  recipientId,
  fileBlob,
  fileName,
  text,
  replyToId
) {
  const formData = new FormData();
  if (fileBlob) {
    formData.append(
      "file",
      fileBlob,
      fileName || fileBlob.name || "attachment"
    );
  }
  formData.append("recipientId", recipientId);
  if (text) formData.append("text", text);
  if (replyToId) formData.append("replyTo", replyToId);

  const response = await fetch(`${API_URL}/messages/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to upload file");
  }
  return data.data;
}

export async function uploadGroupChatMessage(
  token,
  groupId,
  fileBlob,
  fileName,
  text,
  replyToId
) {
  const formData = new FormData();
  if (fileBlob) {
    formData.append(
      "file",
      fileBlob,
      fileName || fileBlob.name || "attachment"
    );
  }
  if (text) formData.append("text", text);
  if (replyToId) formData.append("replyTo", replyToId);

  const response = await fetch(
    `${API_URL}/groups/${encodeURIComponent(groupId)}/messages/upload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to upload file to group");
  }
  return data.data;
}

export async function downloadMessageAttachment(
  token,
  messageId,
  originalName
) {
  const response = await fetch(
    `${API_URL}/messages/${encodeURIComponent(messageId)}/attachment`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Failed to download attachment");
  }

  const blob = await response.blob();
  return await saveBlobWithDialog(blob, originalName);
}

export async function downloadGroupMessageAttachment(
  token,
  groupId,
  messageId,
  originalName
) {
  const response = await fetch(
    `${API_URL}/groups/${encodeURIComponent(groupId)}/messages/${encodeURIComponent(
      messageId
    )}/attachment`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Failed to download group attachment");
  }

  const blob = await response.blob();
  return await saveBlobWithDialog(blob, originalName);
}

/**
 * Helper to prompt user with a Save Dialog to select download path and save the file
 */
async function saveBlobWithDialog(blob, defaultName) {
  const originalName = defaultName || "download";

  // 1. Electron Native Save Dialog via IPC
  if (window.knotDesktop?.saveFile) {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const result = await window.knotDesktop.saveFile({
        defaultPath: originalName,
        data: new Uint8Array(arrayBuffer),
      });

      if (result && !result.error) {
        return result;
      }
      console.warn("Electron native saveFile returned error:", result?.error);
    } catch (ipcErr) {
      console.warn("Electron saveFile IPC failed, falling back to showSaveFilePicker:", ipcErr);
    }
  }

  // 2. Web File System Access API (Native OS Save Dialog in Chromium & modern browsers)
  if (typeof window.showSaveFilePicker === "function") {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: originalName,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { canceled: false };
    } catch (pickerErr) {
      if (pickerErr.name === "AbortError") {
        // User clicked Cancel in the Save As dialog
        return { canceled: true };
      }
      console.warn("showSaveFilePicker failed, falling back to browser download:", pickerErr);
    }
  }

  // 3. Fallback: browser download anchor
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = originalName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
  return { canceled: false };
}

export function getAttachmentViewUrl(
  token,
  messageId,
  isGroup = false,
  groupId = null
) {
  if (isGroup && groupId) {
    return `${API_URL}/groups/${encodeURIComponent(
      groupId
    )}/messages/${encodeURIComponent(messageId)}/view?token=${encodeURIComponent(
      token
    )}`;
  }
  return `${API_URL}/messages/${encodeURIComponent(
    messageId
  )}/view?token=${encodeURIComponent(token)}`;
}

export function getAvatarUrl(profilePhoto) {
  if (!profilePhoto) return null;
  if (
    profilePhoto.startsWith("http://") ||
    profilePhoto.startsWith("https://") ||
    profilePhoto.startsWith("data:")
  ) {
    return profilePhoto;
  }
  const serverBase = API_URL.replace(/\/api$/, "");
  return `${serverBase}${profilePhoto.startsWith("/") ? "" : "/"}${profilePhoto}`;
}

export async function getUserProfile(token, userId) {
  const response = await fetch(
    `${API_URL}/users/profile/${encodeURIComponent(userId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch user profile");
  }
  return data.user;
}

export async function updateProfile(token, { username, bio, profilePhoto }) {
  const response = await fetch(`${API_URL}/users/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ username, bio, profilePhoto }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to update profile");
  }
  return data.user;
}

export async function uploadAvatar(token, file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/users/avatar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to upload profile photo");
  }
  return data.user;
}

export async function removeAvatar(token) {
  const response = await fetch(`${API_URL}/users/avatar`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to remove profile photo");
  }
  return data.user;
}

