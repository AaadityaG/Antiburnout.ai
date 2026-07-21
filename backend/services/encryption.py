from cryptography.fernet import Fernet
import base64
import hashlib


def get_encryption_key(device_id: str) -> bytes:
    key_hash = hashlib.sha256(device_id.encode()).digest()
    return base64.urlsafe_b64encode(key_hash)


def encrypt_api_key(api_key: str, device_id: str) -> str:
    fernet = Fernet(get_encryption_key(device_id))
    return fernet.encrypt(api_key.encode()).decode()


def decrypt_api_key(encrypted_key: str, device_id: str) -> str:
    fernet = Fernet(get_encryption_key(device_id))
    return fernet.decrypt(encrypted_key.encode()).decode()
