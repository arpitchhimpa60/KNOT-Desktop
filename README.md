### Desktop Messaging Application

KNOT is a lightweight, real-time desktop messaging application inspired by modern messaging platforms.

The application is being built specifically for desktop using **Electron and React**, with a **Node.js + Express backend**, **MongoDB** for data storage, and **Socket.IO** for real-time communication.

The goal of KNOT is to build a focused messaging application while understanding how authentication, real-time communication, database operations, and desktop applications work together.

---

## Features

KNOT will initially focus on these 8 core features:

### 1. Login / Signup
- User registration
- User login
- Secure password handling
- Authentication using JWT

### 2. User Search
- Search for registered users
- Search by name or username
- Open a conversation with a selected user

### 3. One-to-One Chat
- Private conversations between two users
- Real-time text messaging
- Store and retrieve previous messages
- Display message timestamp

### 4. Online Status
- Show whether a user is online or offline
- Real-time presence updates

### 5. Typing Indicator
- Show when another user is typing
- Real-time typing events
- Automatically remove the indicator when typing stops

### 6. Message Status
Messages will have three basic states:

- **Sent**
- **Delivered**
- **Read**

### 7. Simple Groups
- Create a group
- Add multiple users
- Send messages inside the group
- Display the sender of each message

### 8. Reply to Message
- Reply to a specific message
- Show the original message as a preview
- Maintain a reference between the reply and original message

---

## Tech Stack

### Desktop Application
- **Electron**
- **React**

### Backend
- **Node.js**
- **Express.js**

### Real-Time Communication
- **Socket.IO**

### Database
- **MongoDB**

### Authentication & Security
- **JWT**
- **bcrypt**

---

## Basic Architecture

```text
┌──────────────────────────────┐
│       KNOT Desktop App       │
│                              │
│       Electron + React       │
└──────────────┬───────────────┘
               │
        HTTP / Socket.IO
               │
               ▼
┌──────────────────────────────┐
│        Backend Server        │
│                              │
│       Node.js + Express      │
│          + Socket.IO         │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│           MongoDB            │
│                              │
│ Users                        │
│ Conversations                │
│ Messages                     │
│ Groups                       │
└──────────────────────────────┘
