"""PII Masking for Project OMNI."""

import re
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)


class PIIMasker:
    """
    Mask personally identifiable information.
    
    Features:
    - Pattern-based PII detection
    - Field-level masking
    - Configurable masking rules
    """
    
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
        'password', 'token', 'secret', 'api_key',
        'first_name', 'last_name', 'address'
    ]
    
    def __init__(self, custom_patterns: Dict[str, str] = None):
        """
        Initialize PII masker.
        
        Args:
            custom_patterns: Additional PII patterns
        """
        self.patterns = self.PATTERNS.copy()
        if custom_patterns:
            self.patterns.update(custom_patterns)
    
    def mask(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Mask PII in data.
        
        Args:
            data: Input data dictionary
            
        Returns:
            Masked data dictionary
        """
        masked = data.copy()
        
        # Mask known PII fields
        for field in self.PII_FIELDS:
            if field in masked:
                masked[field] = self._mask_value(str(masked[field]))
        
        # Mask string values with PII patterns
        for key, value in masked.items():
            if isinstance(value, str):
                masked[key] = self._mask_patterns(value)
            elif isinstance(value, dict):
                masked[key] = self.mask(value)
            elif isinstance(value, list):
                masked[key] = [
                    self.mask(item) if isinstance(item, dict) else item
                    for item in value
                ]
        
        return masked
    
    def _mask_value(self, value: str) -> str:
        """Mask a single value."""
        if not value or len(value) < 4:
            return "***"
        return value[:2] + "***" + value[-2:]
    
    def _mask_patterns(self, text: str) -> str:
        """Mask PII patterns in text."""
        masked = text
        for pii_type, pattern in self.patterns.items():
            masked = re.sub(
                pattern,
                f'[{pii_type.upper()}_MASKED]',
                masked
            )
        return masked
    
    def detect(self, data: Dict[str, Any]) -> Dict[str, List[str]]:
        """
        Detect PII in data without masking.
        
        Args:
            data: Input data dictionary
            
        Returns:
            Dictionary of detected PII by field
        """
        detected = {}
        
        for key, value in data.items():
            if isinstance(value, str):
                for pii_type, pattern in self.patterns.items():
                    if re.search(pattern, value):
                        if key not in detected:
                            detected[key] = []
                        detected[key].append(pii_type)
        
        return detected
    
    def has_pii(self, data: Dict[str, Any]) -> bool:
        """
        Check if data contains PII.
        
        Args:
            data: Input data dictionary
            
        Returns:
            True if PII detected
        """
        detected = self.detect(data)
        return len(detected) > 0
