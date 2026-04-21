# 🔐 Multiple Access Control System

A biometric authentication system with face recognition, role-based access control, and a real-time admin dashboard. Built with React + FastAPI.

![Python](https://img.shields.io/badge/Python-3.11-blue)
![React](https://img.shields.io/badge/React-19-61DAFB)
![FastAPI](https://img.shields.io/badge/FastAPI-0.135-009688)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

- **Face Recognition** — register and login using your webcam
- **Password Auth** — traditional email + password fallback
- **Role-Based Access** — admin and user dashboards with different permissions
- **Admin Dashboard** — manage users, view access logs, enable/disable accounts, change roles
- **User Dashboard** — view own profile and personal login history
- **Rate Limiting** — blocks IPs after too many failed attempts
- **Email Alerts** — notifies users on 3 failed login attempts or account disable
- **JWT Authentication** — secure token-based sessions
- **SQLite Database** — zero-config persistent storage

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS |
| Backend | Python 3.11, FastAPI, Uvicorn |
| Face Recognition | face-recognition, dlib, OpenCV |
| Database | SQLite |
| Auth | JWT (python-jose), bcrypt |
| Email | fastapi-mail, Gmail SMTP |
| Rate Limiting | slowapi |

---

## 📁 Project Structure

```
multiple-access-control-system/
├── src/                          # React frontend
│   ├── App.jsx                   # Root — routes between auth/dashboards
│   └── pages/
│       ├── Auth.jsx              # Login + Register page
│       ├── AdminDashboard.jsx    # Admin panel
│       └── UserDashboard.jsx     # User panel
├── pages/                        # (legacy pages folder)
├── backend/                      # FastAPI backend
│   ├── main.py                   # App entry point
│   ├── core/
│   │   ├── security.py           # JWT create/decode
│   │   ├── limiter.py            # Rate limiter instance
│   │   └── email_service.py      # Email notifications
│   ├── routes/
│   │   ├── auth.py               # /auth/register, /auth/login
│   │   └── admin.py              # /admin/users, /admin/logs, etc.
│   ├── services/
│   │   └── face_service.py       # Face registration + verification
│   ├── database/
│   │   └── db.py                 # SQLite init + connection
│   └── embeddings/
│       └── faces/                # Stored face vectors (.pkl files)
├── package.json
└── vite.config.js
```

---

## ⚙️ Prerequisites

Before running this project make sure you have:

- **Python 3.11** — [download here](https://www.python.org/downloads/release/python-3119/)
- **Node.js 18+** — [download here](https://nodejs.org/)
- **dlib prebuilt wheel** for Windows — [download here](https://github.com/z-mahmud22/Dlib_Windows_Python3.x) (get `dlib-19.24.1-cp311-cp311-win_amd64.whl`)
- **Gmail account** with 2-Step Verification enabled and an App Password created

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/multiple-access-control-system.git
cd multiple-access-control-system
```

### 2. Frontend setup

```bash
npm install
```

### 3. Backend setup

```bash
cd backend

# Create virtual environment with Python 3.11
py -3.11 -m venv venv311
venv311\Scripts\activate      # Windows
# source venv311/bin/activate  # Mac/Linux

# Install dlib (Windows only — use prebuilt wheel)
pip install path/to/dlib-19.24.1-cp311-cp311-win_amd64.whl

# Install all other dependencies
pip install fastapi uvicorn python-multipart opencv-python==4.8.0.76 "numpy<2.0" face-recognition python-jose[cryptography] passlib[bcrypt] slowapi python-dotenv fastapi-mail
```

### 4. Environment variables

Create a `.env` file inside the `backend/` folder:

```env
MAIL_USERNAME=your_gmail@gmail.com
MAIL_PASSWORD=your_16_char_app_password
MAIL_FROM=your_gmail@gmail.com
```

> To get a Gmail App Password: Google Account → Security → 2-Step Verification → App Passwords → Create

### 5. Run the backend

```bash
# inside backend/ with venv311 active
uvicorn main:app --reload
```

Backend runs on `http://localhost:8000`
API docs available at `http://localhost:8000/docs`

### 6. Run the frontend

```bash
# in a separate terminal, in project root
npm run dev
```

Frontend runs on `http://localhost:5173`

---

## 👤 First Run

1. Open `http://localhost:5173`
2. Go to **Register** tab
3. Select **Face ID**, enter your name and email
4. Look at the camera and click **Register Identity**
5. The first registered user is automatically set as **Admin**
6. Register more users — they get **User** role by default

---

## 🔑 Auth Methods

| Method | How it works |
|--------|-------------|
| Face ID | Webcam captures a frame → sent to backend → compared against stored face embedding |
| Password | Standard email + bcrypt hashed password |
| Voice ID | UI ready — backend integration coming soon |

---

## 🛡 Security Features

- Face embeddings stored as NumPy vectors — not raw photos
- JWT tokens expire after 60 minutes
- Accounts locked after **3 failed login attempts** in 15 minutes
- Email alert sent to user on 3rd failed attempt
- Admin can disable/enable any user account
- Email alert sent when account is disabled
- Rate limiting: 5 requests/min on register, 10 requests/min on login
- CORS restricted to `localhost:5173`

---

## 📡 API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Register new user | None |
| POST | `/auth/login` | Login with face/password | None |
| GET | `/admin/users` | List all users | Admin JWT |
| GET | `/admin/logs` | All access logs | Admin JWT |
| GET | `/admin/my-logs` | Own login history | Any JWT |
| PATCH | `/admin/users/{id}/toggle` | Enable/disable user | Admin JWT |
| PATCH | `/admin/users/{id}/role` | Change user role | Admin JWT |
| GET | `/health` | Server status | None |

---

## 🖥 Screenshots

> Add screenshots of your auth page, admin dashboard, and user dashboard here

---

## 🐛 Common Issues

**dlib fails to install**
→ Use the prebuilt wheel from [here](https://github.com/z-mahmud22/Dlib_Windows_Python3.x). Make sure to match your Python version.

**Face not detected**
→ Ensure good lighting and face is clearly visible in the camera frame.

**"Too many failed attempts"**
→ Wait 15 minutes or clear failed logs from the database manually.

**Email not sending**
→ Make sure 2-Step Verification is on and you're using an App Password, not your regular Gmail password.

**CORS error**
→ Make sure backend is running on port 8000 and frontend on port 5173.

---

## 🔮 Roadmap

- [ ] Voice recognition login
- [ ] React Router for proper URLs
- [ ] Dashboard charts (login activity over time)
- [ ] Multiple face angles per user
- [ ] Profile photo upload
- [ ] Export logs as CSV
- [ ] Docker support

---

## 📄 License

MIT License — feel free to use and modify.

---

## 👨‍💻 Author

Built by **Musab** as a mini project exploring biometric authentication with Python and React.