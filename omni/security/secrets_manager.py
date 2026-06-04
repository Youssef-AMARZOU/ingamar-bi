"""Secrets management for Project OMNI."""

import os
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class SecretsManager:
    """
    Manage secrets securely.
    
    Features:
    - Environment variable loading
    - Secret validation
    - Secure access patterns
    """
    
    def __init__(self):
        """Initialize secrets manager."""
        self.secrets: Dict[str, str] = {}
        self._load_secrets()
    
    def _load_secrets(self):
        """Load secrets from environment."""
        secret_keys = [
            'OPENAI_API_KEY',
            'GROQ_API_KEY',
            'ANTHROPIC_API_KEY',
            'POSTGRES_PASSWORD',
            'MONGODB_PASSWORD',
            'ENCRYPTION_KEY',
            'JIRA_API_TOKEN',
            'NOTION_API_KEY',
            'HF_TOKEN'
        ]
        
        for key in secret_keys:
            value = os.environ.get(key)
            if value:
                self.secrets[key] = value
                logger.debug(f"Loaded secret: {key}")
    
    def get(self, key: str) -> Optional[str]:
        """
        Get secret value.
        
        Args:
            key: Secret key
            
        Returns:
            Secret value or None
        """
        return self.secrets.get(key)
    
    def get_required(self, key: str) -> str:
        """
        Get required secret value.
        
        Args:
            key: Secret key
            
        Returns:
            Secret value
            
        Raises:
            ValueError: If secret not found
        """
        value = self.get(key)
        if value is None:
            raise ValueError(f"Missing required secret: {key}")
        return value
    
    def validate(self) -> bool:
        """
        Validate all required secrets exist.
        
        Returns:
            True if all required secrets present
            
        Raises:
            ValueError: If required secret missing
        """
        required = [
            'GROQ_API_KEY',
            'JIRA_API_TOKEN',
            'NOTION_API_KEY'
        ]
        
        for key in required:
            if key not in self.secrets:
                raise ValueError(f"Missing required secret: {key}")
        
        logger.info("All required secrets validated")
        return True
    
    def list_keys(self) -> list:
        """List available secret keys (without values)."""
        return list(self.secrets.keys())
    
    def has_key(self, key: str) -> bool:
        """Check if secret key exists."""
        return key in self.secrets
