"""
Servicio de autenticación con JWT y bcrypt
"""
import os
import bcrypt
import jwt
from datetime import datetime, timedelta
from typing import Optional
from dotenv import load_dotenv

# Cargar .env
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(env_path)

# Clave secreta para JWT (usar variable de entorno o generar una por defecto)
JWT_SECRET = os.getenv("JWT_SECRET", "nemaec-gestor-documentario-secret-key-2026")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24  # Token válido por 24 horas


def hash_password(password: str) -> str:
    """
    Hashea una contraseña usando bcrypt.
    """
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    """
    Verifica si una contraseña coincide con su hash.
    """
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def create_token(username: str, nombre: str, role: str = 'admin') -> str:
    """
    Crea un token JWT para el usuario.
    """
    expiration = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        "sub": username,
        "nombre": nombre,
        "role": role,
        "exp": expiration,
        "iat": datetime.utcnow()
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token


def verify_token(token: str) -> Optional[dict]:
    """
    Verifica y decodifica un token JWT.
    Retorna el payload si es válido, None si no.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None  # Token expirado
    except jwt.InvalidTokenError:
        return None  # Token inválido


def get_username_from_token(token: str) -> Optional[str]:
    """
    Extrae el username de un token válido.
    """
    payload = verify_token(token)
    if payload:
        return payload.get("sub")
    return None
