"""Data encryption for Project OMNI."""

import base64
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


class DataEncryption:
    """
    Data encryption utilities.
    
    Features:
    - String encryption/decryption
    - Dictionary encryption
    - Key management
    """
    
    def __init__(self, key: str = None):
        """
        Initialize encryption.
        
        Args:
            key: Encryption key (32 bytes)
        """
        try:
            from cryptography.fernet import Fernet
            
            if key:
                # Ensure key is 32 bytes
                key_bytes = key.encode()[:32].ljust(32, b'0')
                self.key = base64.urlsafe_b64encode(key_bytes)
            else:
                self.key = Fernet.generate_key()
            
            self.cipher = Fernet(self.key)
            self.available = True
            logger.info("Encryption initialized")
            
        except ImportError:
            logger.warning("cryptography not installed, encryption disabled")
            self.available = False
        except Exception as e:
            logger.error(f"Encryption initialization failed: {e}")
            self.available = False
    
    def encrypt(self, data: str) -> str:
        """
        Encrypt data.
        
        Args:
            data: Plain text data
            
        Returns:
            Encrypted data
        """
        if not self.available:
            return data
        
        try:
            return self.cipher.encrypt(data.encode()).decode()
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            return data
    
    def decrypt(self, encrypted_data: str) -> str:
        """
        Decrypt data.
        
        Args:
            encrypted_data: Encrypted data
            
        Returns:
            Decrypted data
        """
        if not self.available:
            return encrypted_data
        
        try:
            return self.cipher.decrypt(encrypted_data.encode()).decode()
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            return encrypted_data
    
    def encrypt_dict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Encrypt dictionary values.
        
        Args:
            data: Input dictionary
            
        Returns:
            Dictionary with encrypted values
        """
        encrypted = {}
        for key, value in data.items():
            if isinstance(value, str):
                encrypted[key] = self.encrypt(value)
            else:
                encrypted[key] = value
        return encrypted
    
    def decrypt_dict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Decrypt dictionary values.
        
        Args:
            data: Dictionary with encrypted values
            
        Returns:
            Dictionary with decrypted values
        """
        decrypted = {}
        for key, value in data.items():
            if isinstance(value, str):
                try:
                    decrypted[key] = self.decrypt(value)
                except:
                    decrypted[key] = value
            else:
                decrypted[key] = value
        return decrypted
