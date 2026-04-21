from fastapi import APIRouter, HTTPException, Header
from database.db import get_db
from core.security import decode_token
from core.email_service import send_account_disabled_alert

router = APIRouter(prefix="/admin", tags=["admin"])

def get_token_payload(authorization: str = Header(...)):
    try:
        token = authorization.replace("Bearer ", "")
        return decode_token(token)
    except Exception:
        raise HTTPException(401, "Invalid token")

def get_user_from_token(authorization: str = Header(...)):
    payload = get_token_payload(authorization)
    db = get_db()
    user = db.execute(
        "SELECT id, name, email, auth_method, role, is_active FROM users WHERE id=?",
        (payload.get("sub"),)
    ).fetchone()
    db.close()

    if not user or not user["is_active"]:
        raise HTTPException(401, "Invalid or disabled user")

    return user

def require_admin(authorization: str = Header(...)):
    user = get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(403, "Admin access required")
    return user

def require_manager(authorization: str = Header(...)):
    user = get_user_from_token(authorization)
    if user["role"] not in ("admin", "supervisor"):
        raise HTTPException(403, "Manager access required")
    return user

def require_auth(authorization: str = Header(...)):
    return get_user_from_token(authorization)

@router.get("/users")
def get_users(authorization: str = Header(...)):
    require_admin(authorization)
    db = get_db()
    users = db.execute(
        "SELECT id, name, email, auth_method, role, is_active, created_at FROM users ORDER BY created_at DESC"
    ).fetchall()
    db.close()
    return [dict(u) for u in users]

@router.get("/logs")
def get_logs(authorization: str = Header(...)):
    require_manager(authorization)
    db = get_db()
    logs = db.execute(
        "SELECT * FROM access_logs ORDER BY logged_at DESC LIMIT 100"
    ).fetchall()
    db.close()
    return [dict(l) for l in logs]

@router.get("/my-logs")
def my_logs(authorization: str = Header(...)):
    payload = require_auth(authorization)
    email = payload.get("email")
    db = get_db()
    logs = db.execute(
        "SELECT * FROM access_logs WHERE email=? ORDER BY logged_at DESC",
        (email,)
    ).fetchall()
    db.close()
    return [dict(l) for l in logs]

@router.patch("/users/{user_id}/toggle")
async def toggle_user(user_id: int, authorization: str = Header(...)):
    require_admin(authorization)
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    if not user:
        db.close()
        raise HTTPException(404, "User not found")
    new_status = 0 if user["is_active"] else 1
    db.execute("UPDATE users SET is_active=? WHERE id=?", (new_status, user_id))
    db.commit()
    db.close()

    # send email when account is disabled
    if new_status == 0:
        try:
            await send_account_disabled_alert(user["email"], user["name"])
        except Exception as e:
            print(f"Email error: {e}")

    return {"id": user_id, "is_active": new_status}

@router.patch("/users/{user_id}/role")
def change_role(user_id: int, role: str, authorization: str = Header(...)):
    require_admin(authorization)
    if role not in ("admin", "supervisor", "user"):
        raise HTTPException(400, "Role must be admin, supervisor, or user")
    db = get_db()
    db.execute("UPDATE users SET role=? WHERE id=?", (role, user_id))
    db.commit()
    db.close()
    return {"id": user_id, "role": role}