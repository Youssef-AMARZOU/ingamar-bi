# Project OMNI - Security & Governance

## 1. Data Sanitization

### PII Masking

The Agent Extracteur must mask or remove all sensitive data (PII - Personally Identifiable Information) before sending to external LLM APIs.

```python
# omni/security/pii_masker.py
import re
from typing import Dict, Any

class PIIMasker:
    """Mask personally identifiable information."""
    
    # PII patterns
    PATTERNS = {
        'email': r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
        'phone': r'[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}',
        'ssn': r'\d{3}[-]?\d{2}[-]?\d{4}',
        'credit_card': r'\d{4}[-]?\d{4}[-]?\d{4}[-]?\d{4}',
        'ip_address': r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}',
    }
    
    # Fields to mask
    PII_FIELDS = [
        'email', 'phone', 'ssn', 'credit_card',
        'password', 'token', 'secret', 'api_key'
    ]
    
    def mask(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Mask PII in data."""
        masked = data.copy()
        
        # Mask known PII fields
        for field in self.PII_FIELDS:
            if field in masked:
                masked[field] = self._mask_value(str(masked[field]))
        
        # Mask string values with PII patterns
        for key, value in masked.items():
            if isinstance(value, str):
                masked[key] = self._mask_patterns(value)
        
        return masked
    
    def _mask_value(self, value: str) -> str:
        """Mask a single value."""
        if not value or len(value) < 4:
            return "***"
        return value[:2] + "***" + value[-2:]
    
    def _mask_patterns(self, text: str) -> str:
        """Mask PII patterns in text."""
        masked = text
        for pii_type, pattern in self.PATTERNS.items():
            masked = re.sub(pattern, f'[{pii_type.upper()}_MASKED]', masked)
        return masked
    
    def detect_pii(self, data: Dict[str, Any]) -> Dict[str, list]:
        """Detect PII in data."""
        detected = {}
        
        for key, value in data.items():
            if isinstance(value, str):
                for pii_type, pattern in self.PATTERNS.items():
                    if re.search(pattern, value):
                        if key not in detected:
                            detected[key] = []
                        detected[key].append(pii_type)
        
        return detected
```

### Data Classification

```python
# omni/security/classifier.py
from enum import Enum

class DataClassification(Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"

class DataClassifier:
    """Classify data sensitivity level."""
    
    CLASSIFICATION_RULES = {
        DataClassification.RESTRICTED: [
            'ssn', 'credit_card', 'password', 'api_key'
        ],
        DataClassification.CONFIDENTIAL: [
            'email', 'phone', 'address', 'salary'
        ],
        DataClassification.INTERNAL: [
            'employee_id', 'department', 'project'
        ],
        DataClassification.PUBLIC: [
            'name', 'title', 'description'
        ]
    }
    
    def classify(self, data: dict) -> DataClassification:
        """Classify data sensitivity level."""
        max_classification = DataClassification.PUBLIC
        
        for field in data.keys():
            for classification, fields in self.CLASSIFICATION_RULES.items():
                if field in fields:
                    if classification.value > max_classification.value:
                        max_classification = classification
        
        return max_classification
    
    def should_mask(self, classification: DataClassification) -> bool:
        """Check if data should be masked."""
        return classification in [
            DataClassification.CONFIDENTIAL,
            DataClassification.RESTRICTED
        ]
```

## 2. Secrets Management

### Environment Variables

Never store secrets in code or orchestrator. Use encrypted environment variables.

```python
# omni/security/secrets.py
import os
from typing import Optional

class SecretsManager:
    """Manage secrets securely."""
    
    def __init__(self):
        self.secrets = {}
        self._load_secrets()
    
    def _load_secrets(self):
        """Load secrets from environment."""
        secret_keys = [
            'OPENAI_API_KEY',
            'GROQ_API_KEY',
            'ANTHROPIC_API_KEY',
            'POSTGRES_PASSWORD',
            'MONGODB_PASSWORD',
            'ENCRYPTION_KEY'
        ]
        
        for key in secret_keys:
            value = os.environ.get(key)
            if value:
                self.secrets[key] = value
    
    def get(self, key: str) -> Optional[str]:
        """Get secret value."""
        return self.secrets.get(key)
    
    def validate(self) -> bool:
        """Validate all required secrets exist."""
        required = [
            'OPENAI_API_KEY',
            'GROQ_API_KEY',
            'POSTGRES_PASSWORD'
        ]
        
        for key in required:
            if key not in self.secrets:
                raise ValueError(f"Missing required secret: {key}")
        
        return True
```

### AWS Secrets Manager Integration

```python
# omni/security/aws_secrets.py
import boto3
import json

class AWSSecretsManager:
    """AWS Secrets Manager integration."""
    
    def __init__(self, region_name: str = 'us-east-1'):
        self.client = boto3.client(
            'secretsmanager',
            region_name=region_name
        )
    
    def get_secret(self, secret_name: str) -> dict:
        """Get secret from AWS Secrets Manager."""
        try:
            response = self.client.get_secret_value(
                SecretId=secret_name
            )
            return json.loads(response['SecretString'])
        except Exception as e:
            raise ValueError(f"Failed to get secret: {e}")
    
    def rotate_secret(self, secret_name: str, new_value: dict):
        """Rotate secret value."""
        self.client.put_secret_value(
            SecretId=secret_name,
            SecretString=json.dumps(new_value)
        )
```

## 3. Audit Logging

### Log Structure

```python
# omni/security/audit_logger.py
import json
import logging
from datetime import datetime
from typing import Dict, Any

class AuditLogger:
    """Audit logging for AI decisions."""
    
    def __init__(self, mongodb_client):
        self.db = mongodb_client['audit_logs']
        self.collection = self.db['agent_decisions']
    
    def log_decision(
        self,
        agent: str,
        action: str,
        input_data: Dict[str, Any],
        output_data: Dict[str, Any],
        confidence: float,
        prompt: str = None
    ):
        """Log agent decision."""
        log_entry = {
            'timestamp': datetime.utcnow(),
            'agent': agent,
            'action': action,
            'input': self._sanitize(input_data),
            'output': self._sanitize(output_data),
            'confidence': confidence,
            'prompt': prompt,
            'metadata': {
                'version': '1.0',
                'environment': os.environ.get('ENVIRONMENT', 'dev')
            }
        }
        
        self.collection.insert_one(log_entry)
    
    def _sanitize(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize data for logging."""
        sanitized = {}
        for key, value in data.items():
            if isinstance(value, (str, int, float, bool)):
                sanitized[key] = value
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize(value)
            elif isinstance(value, list):
                sanitized[key] = [
                    self._sanitize(item) if isinstance(item, dict) else item
                    for item in value
                ]
        return sanitized
    
    def query_logs(
        self,
        agent: str = None,
        start_date: datetime = None,
        end_date: datetime = None,
        min_confidence: float = None
    ) -> list:
        """Query audit logs."""
        query = {}
        
        if agent:
            query['agent'] = agent
        if start_date or end_date:
            query['timestamp'] = {}
            if start_date:
                query['timestamp']['$gte'] = start_date
            if end_date:
                query['timestamp']['$lte'] = end_date
        if min_confidence:
            query['confidence'] = {'$gte': min_confidence}
        
        return list(self.collection.find(query))
```

## 4. Encryption

### Data Encryption

```python
# omni/security/encryption.py
from cryptography.fernet import Fernet
import base64

class DataEncryption:
    """Data encryption utilities."""
    
    def __init__(self, key: str = None):
        if key:
            self.key = base64.urlsafe_b64encode(key.encode()[:32].ljust(32, b'0'))
        else:
            self.key = Fernet.generate_key()
        self.cipher = Fernet(self.key)
    
    def encrypt(self, data: str) -> str:
        """Encrypt data."""
        return self.cipher.encrypt(data.encode()).decode()
    
    def decrypt(self, encrypted_data: str) -> str:
        """Decrypt data."""
        return self.cipher.decrypt(encrypted_data.encode()).decode()
    
    def encrypt_dict(self, data: dict) -> dict:
        """Encrypt dictionary values."""
        encrypted = {}
        for key, value in data.items():
            if isinstance(value, str):
                encrypted[key] = self.encrypt(value)
            else:
                encrypted[key] = value
        return encrypted
    
    def decrypt_dict(self, data: dict) -> dict:
        """Decrypt dictionary values."""
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
```

## 5. Access Control

### Role-Based Access Control (RBAC)

```python
# omni/security/rbac.py
from enum import Enum
from typing import List

class Role(Enum):
    ADMIN = "admin"
    OPERATOR = "operator"
    VIEWER = "viewer"

class Permission(Enum):
    READ = "read"
    WRITE = "write"
    EXECUTE = "execute"
    DELETE = "delete"

# Role permissions mapping
ROLE_PERMISSIONS = {
    Role.ADMIN: [
        Permission.READ,
        Permission.WRITE,
        Permission.EXECUTE,
        Permission.DELETE
    ],
    Role.OPERATOR: [
        Permission.READ,
        Permission.WRITE,
        Permission.EXECUTE
    ],
    Role.VIEWER: [
        Permission.READ
    ]
}

class RBACManager:
    """Role-based access control manager."""
    
    def __init__(self):
        self.user_roles = {}
    
    def assign_role(self, user_id: str, role: Role):
        """Assign role to user."""
        self.user_roles[user_id] = role
    
    def check_permission(
        self, user_id: str, permission: Permission
    ) -> bool:
        """Check if user has permission."""
        role = self.user_roles.get(user_id)
        if not role:
            return False
        
        return permission in ROLE_PERMISSIONS.get(role, [])
    
    def require_permission(self, permission: Permission):
        """Decorator to require permission."""
        def decorator(func):
            def wrapper(user_id: str, *args, **kwargs):
                if not self.check_permission(user_id, permission):
                    raise PermissionError(
                        f"User {user_id} lacks {permission.value} permission"
                    )
                return func(user_id, *args, **kwargs)
            return wrapper
        return decorator
```
