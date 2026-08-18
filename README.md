# HackHive Meeting Scheduler

A full-stack meeting scheduling platform built with React and Node.js. Book meetings, manage time slots, receive real-time notifications, and join video rooms — all in one place.

---

## 🚀 Features

- **User Authentication** — Register, login, and JWT-based session management.
- **Meeting Booking** — Browse available time slots and book meetings instantly.
- **Admin Dashboard** — Manage users, meetings, and available time slots.
- **User Dashboard** — View upcoming and past meetings at a glance.
- **Real-Time Notifications** — Socket.io powered notification bell for instant updates.
- **Video Room** — Join meetings via an integrated video conferencing room.
- **Email Notifications** — Automated email confirmations and reminders via Nodemailer.

---

## 🛠️ Tech Stack

| Layer      | Technology                          |
| ---------- | ----------------------------------- |
| Frontend   | React 18, Vite, React Router v6    |
| Backend    | Node.js, Express.js                |
| Database   | MongoDB, Mongoose                  |
| Auth       | JWT, bcryptjs                      |
| Realtime   | Socket.io                          |
| Email      | Nodemailer                         |

---

## 📦 Getting Started

### Prerequisites

- Node.js ≥ 18
- MongoDB (local or Atlas)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/hackhive-meeting-scheduler.git
cd hackhive-meeting-scheduler
```

### 2. Backend Setup

```bash
cd backend
npm install
# Configure .env (see .env.example)
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
npm install
# Configure .env (see .env.example)
npm run dev
```

The frontend runs on `http://localhost:5173` and the backend API on `http://localhost:5000`.

---

## 📁 Project Structure

```
hackhive-meeting-scheduler/
├── frontend/          # React + Vite client
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── utils/
│   └── ...
├── backend/           # Express API server
│   ├── config/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   └── utils/
└── README.md
```

---

## 📄 License

MIT © HackHive Team
