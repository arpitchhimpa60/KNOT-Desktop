### Desktop Messaging Application

KNOT is a lightweight, real-time desktop messaging application inspired by modern messaging platforms.

The application is being built specifically for desktop using **Electron and React**, with a **Node.js + Express backend**, **MongoDB** for data storage, and **Socket.IO** for real-time communication.

The goal of KNOT is to build a focused messaging application while understanding how authentication, real-time communication, database operations, and desktop applications work together.

---

## 🌐 Try KNOT in Your Browser

You can use KNOT directly in your browser without installing the desktop application.

**[Open KNOT Web App](https://knot-frontend-zk1v.onrender.com/)**

- No desktop installation required
- Access KNOT through your web browser
- Sign up or log in to start chatting

## Download KNOT Desktop

Download the latest macOS build of KNOT here:

**[Download KNOT for macOS (Apple Silicon)](https://drive.google.com/file/d/1NqRakHd4fML2tPL-kjUiQGsqbZ51oSKP/view?usp=sharing)**

### Installation

1. Download the `.dmg` file.
2. Open the DMG and install or copy KNOT to Applications, if offered.
3. Launch KNOT.

**Compatibility:** This build is for Apple Silicon Macs (M1, M2, M3, M4, and later).

**Note:** This is an unsigned test build. macOS may block it from opening because it has not been signed and notarized by Apple.


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

## 🏗️ Architecture

```text
                 KNOT APPLICATION
                         │
             ┌───────────┴───────────┐
             │                       │
             ▼                       ▼
   ┌──────────────────┐   ┌──────────────────┐
   │   KNOT Web App   │   │ KNOT Desktop App │
   │                  │   │                  │
   │      React       │   │ Electron + React │
   │   Browser-based  │   │   macOS (.dmg)   │
   └────────┬─────────┘   └────────┬─────────┘
            │                      │
            └──────────┬───────────┘
                       │
             HTTP REST API / Socket.IO
                       │
                       ▼
           ┌─────────────────────────┐
           │    Hosted Backend       │
           │                         │
           │      Node.js            │
           │      Express.js         │
           │      Socket.IO           │
           │                         │
           │ Authentication (JWT)    │
           │ API Routes & Controllers│
           └────────────┬────────────┘
                        │
                        ▼
              ┌───────────────────┐
              │   MongoDB Atlas   │
              │                   │
              │ Users             │
              │ Conversations     │
              │ Messages          │
              │ Groups            │
              │ Group Messages    │
              └───────────────────┘
```

### Architecture Overview

- **Web Frontend:** React application accessible through a web browser.
- **Desktop Frontend:** Electron wraps the React interface into a macOS desktop application.
- **Backend:** Node.js and Express handle authentication, API requests, and application logic.
- **Real-Time Communication:** Socket.IO supports real-time messaging and communication events.
- **Authentication:** JSON Web Tokens (JWT) are used for authentication.
- **Database:** MongoDB Atlas stores user accounts, conversations, messages, groups, and group messages.
- **Deployment:** The web frontend is hosted on Render, and the backend API is hosted on Render. The desktop application is distributed as a macOS DMG installer.

### Application Links

- **Web App:** https://knot-frontend-zk1v.onrender.com/
- **Desktop Download:** [Download KNOT for macOS](https://drive.google.com/file/d/1NqRakHd4fML2tPL-kjUjQgsqbZ51oSKP/view?usp=sharing)
- **Backend Health Check:** https://knot-desktop.onrender.com/healthz
