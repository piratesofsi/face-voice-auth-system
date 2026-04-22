from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Request, Header
from database.db import get_db
from services.face_service import register_face, verify_face
from services.voice_service import register_voice, verify_voice
from core.security import create_access_token, decode_token
from core.limiter import limiter
from core.email_service import send_failed_login_alert
from passlib.hash import pbkdf2_sha256

router = APIRouter(prefix="/auth", tags=["auth"])
MAX_FAILED_ATTEMPTS = 8
FAILED_ATTEMPT_WINDOW_MINUTES = 5

def get_user_enabled_methods(db, user_id: int):
    rows = db.execute(
        "SELECT method FROM user_auth_methods WHERE user_id=?",
        (user_id,)
    ).fetchall()
    methods = [r["method"] for r in rows]
    if methods:
        return methods
    # backward compatibility for older rows before migration
    fallback = db.execute("SELECT auth_method FROM users WHERE id=?", (user_id,)).fetchone()
    return [fallback["auth_method"]] if fallback and fallback["auth_method"] else []


def enable_method(db, user_id: int, method: str):
    db.execute(
        "INSERT OR IGNORE INTO user_auth_methods (user_id, method) VALUES (?, ?)",
        (user_id, method)
    )


@router.post("/register")
@limiter.limit("5/minute")
async def register(
    request: Request,
    name: str = Form(...),
    email: str = Form(...),
    auth_method: str = Form(...),
    password: str = Form(None),
    file: UploadFile = File(None),
):
    db = get_db()
    existing = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if existing:
        if not existing["is_active"]:
            db.close()
            raise HTTPException(403, "Account disabled by admin")

        user_id = existing["id"]

        if auth_method == "none":
            if not password:
                db.close()
                raise HTTPException(400, "Password is required for password method")
            db.execute("UPDATE users SET password_hash=? WHERE id=?", (pbkdf2_sha256.hash(password), user_id))
        elif auth_method == "face":
            if not file:
                db.close()
                raise HTTPException(400, "Face sample required")
            data = await file.read()
            if not register_face(user_id, data):
                db.close()
                raise HTTPException(400, "No face detected — try a clearer photo")
        elif auth_method == "voice":
            if not file:
                db.close()
                raise HTTPException(400, "Voice sample required")
            data = await file.read()
            if not register_voice(user_id, data):
                db.close()
                raise HTTPException(400, "No voice profile detected — speak clearly and try again")
        else:
            db.close()
            raise HTTPException(400, "Unsupported auth method")

        enable_method(db, user_id, auth_method)
        db.execute(
            "INSERT INTO access_logs (user_id, user_name, email, method, status) VALUES (?,?,?,?,?)",
            (user_id, existing["name"], email, auth_method, "registered")
        )
        db.commit()
        enabled_methods = get_user_enabled_methods(db, user_id)
        db.close()

        token = create_access_token({"sub": str(user_id), "email": email, "role": existing["role"]})
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user_id,
                "name": existing["name"],
                "email": email,
                "role": existing["role"],
                "auth_method": existing["auth_method"],
                "auth_methods": enabled_methods
            }
        }

    # first user ever = admin
    count = db.execute("SELECT COUNT(*) as c FROM users").fetchone()["c"]
    role = "admin" if count == 0 else "user"

    password_hash = pbkdf2_sha256.hash(password) if password else None
    cursor = db.execute(
        "INSERT INTO users (name, email, password_hash, auth_method, role) VALUES (?,?,?,?,?)",
        (name, email, password_hash, auth_method, role)
    )
    db.commit()
    user_id = cursor.lastrowid
    enable_method(db, user_id, auth_method)

    if auth_method in ("face", "voice") and not file:
        db.close()
        raise HTTPException(400, "Biometric sample required for selected method")

    if file and auth_method == "face":
        data = await file.read()
        ok = register_face(user_id, data)
        if not ok:
            db.close()
            raise HTTPException(400, "No face detected — try a clearer photo")
    elif file and auth_method == "voice":
        data = await file.read()
        ok = register_voice(user_id, data)
        if not ok:
            db.close()
            raise HTTPException(400, "No voice profile detected — speak clearly and try again")

    db.execute(
        "INSERT INTO access_logs (user_id, user_name, email, method, status) VALUES (?,?,?,?,?)",
        (user_id, name, email, auth_method, "registered")
    )
    db.commit()
    enabled_methods = get_user_enabled_methods(db, user_id)
    db.close()

    token = create_access_token({"sub": str(user_id), "email": email, "role": role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "name": name,
            "email": email,
            "role": role,
            "auth_method": auth_method,
            "auth_methods": enabled_methods
        }
    }


@router.post("/login")
@limiter.limit("10/minute")
async def login(
    request: Request,
    email: str = Form(...),
    auth_method: str = Form(...),
    password: str = Form(None),
    file: UploadFile = File(None),
):
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()

    if not user:
        db.close()
        raise HTTPException(404, "User not found")

    if not user["is_active"]:
        db.close()
        raise HTTPException(403, "Account disabled by admin")

    # check recent failed attempts in rolling window
    recent_fails = db.execute("""
        SELECT COUNT(*) as c FROM access_logs
        WHERE email=? AND status='failed'
        AND logged_at >= datetime('now', ?)
    """, (email, f"-{FAILED_ATTEMPT_WINDOW_MINUTES} minutes")).fetchone()["c"]

    if recent_fails >= MAX_FAILED_ATTEMPTS:
        db.close()
        raise HTTPException(
            429,
            f"Too many failed attempts — wait {FAILED_ATTEMPT_WINDOW_MINUTES} minutes"
        )

    enabled_methods = get_user_enabled_methods(db, user["id"])
    if auth_method not in enabled_methods:
        db.close()
        raise HTTPException(400, f"Method '{auth_method}' is not enabled for this account")

    verified = False
    if auth_method == "face":
        if not file:
            db.close()
            raise HTTPException(400, "Face sample required")
        data = await file.read()
        verified = verify_face(user["id"], data)
    elif auth_method == "voice":
        if not file:
            db.close()
            raise HTTPException(400, "Voice sample required")
        data = await file.read()
        verified = verify_voice(user["id"], data)
    elif auth_method == "none" and password:
        verified = pbkdf2_sha256.verify(password, user["password_hash"])

    status = "success" if verified else "failed"
    db.execute(
        "INSERT INTO access_logs (user_id, user_name, email, method, status) VALUES (?,?,?,?,?)",
        (user["id"], user["name"], email, auth_method, status)
    )
    db.commit()
    db.close()

    if not verified:
        # send email alert when failures hit warning threshold
        if recent_fails + 1 >= 3:
            try:
                await send_failed_login_alert(email, user["name"], recent_fails + 1)
            except Exception as e:
                print(f"Email error: {e}")
        raise HTTPException(401, "Authentication failed")

    token = create_access_token({
        "sub": str(user["id"]),
        "email": email,
        "role": user["role"]
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": email,
            "role": user["role"],
            "auth_method": user["auth_method"],
            "auth_methods": enabled_methods
        }
    }


@router.get("/me")
def me(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(401, "Invalid token")

    db = get_db()
    user = db.execute("SELECT id, name, email, role, auth_method, is_active FROM users WHERE id=?", (payload.get("sub"),)).fetchone()

    if not user or not user["is_active"]:
        db.close()
        raise HTTPException(401, "Invalid or disabled user")

    enabled_methods = get_user_enabled_methods(db, user["id"])

    response = {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "auth_method": user["auth_method"],
        "auth_methods": enabled_methods
    }
    db.close()
    return response


@router.post("/enroll-method")
@limiter.limit("10/minute")
async def enroll_method(
    request: Request,
    authorization: str = Header(...),
    method: str = Form(...),
    password: str = Form(None),
    file: UploadFile = File(None),
):
    token = authorization.replace("Bearer ", "")
    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(401, "Invalid token")

    if method not in ("face", "voice", "none"):
        raise HTTPException(400, "Unsupported method")

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE id=?", (payload.get("sub"),)).fetchone()
    if not user or not user["is_active"]:
        db.close()
        raise HTTPException(401, "Invalid or disabled user")

    if method == "none":
        if not password:
            db.close()
            raise HTTPException(400, "Password is required for password method")
        db.execute("UPDATE users SET password_hash=? WHERE id=?", (pbkdf2_sha256.hash(password), user["id"]))
    elif method == "face":
        if not file:
            db.close()
            raise HTTPException(400, "Face sample required")
        data = await file.read()
        if not register_face(user["id"], data):
            db.close()
            raise HTTPException(400, "No face detected — try a clearer photo")
    elif method == "voice":
        if not file:
            db.close()
            raise HTTPException(400, "Voice sample required")
        data = await file.read()
        if not register_voice(user["id"], data):
            db.close()
            raise HTTPException(400, "No voice profile detected — speak clearly and try again")

    enable_method(db, user["id"], method)
    db.execute(
        "INSERT INTO access_logs (user_id, user_name, email, method, status) VALUES (?,?,?,?,?)",
        (user["id"], user["name"], user["email"], method, "registered")
    )
    db.commit()
    methods = get_user_enabled_methods(db, user["id"])
    db.close()
    return {"message": "Method enrolled", "auth_methods": methods}