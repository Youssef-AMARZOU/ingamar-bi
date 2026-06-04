"""Agent Extracteur - Data cleaning and schema conversion."""

import re
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)


class AgentExtracteur:
    """
    Agent responsible for:
    1. Data cleaning and normalization
    2. PII masking
    3. Schema validation
    4. Format conversion
    """
    
    def __init__(self, schema: Dict[str, Any] = None):
        self.schema = schema or {}
        self.pii_patterns = {
            'email': r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
            'phone': r'[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}',
            'ssn': r'\d{3}[-]?\d{2}[-]?\d{4}',
            'credit_card': r'\d{4}[-]?\d{4}[-]?\d{4}[-]?\d{4}',
        }
        self.pii_fields = [
            'email', 'phone', 'ssn', 'credit_card',
            'password', 'token', 'secret', 'api_key'
        ]
    
    def extract(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main extraction pipeline.
        
        Args:
            raw_data: Raw input data
            
        Returns:
            Cleaned and validated data
            
        Raises:
            ValueError: If data doesn't match schema
        """
        logger.info(f"Extracting data: {list(raw_data.keys())}")
        
        # Step 1: Mask PII
        masked_data = self._mask_pii(raw_data)
        
        # Step 2: Clean and normalize
        cleaned_data = self._clean(masked_data)
        
        # Step 3: Validate against schema
        if self.schema:
            self._validate(cleaned_data)
        
        # Step 4: Convert to standard format
        result = self._convert_to_schema(cleaned_data)
        
        logger.info(f"Extraction complete: {list(result.keys())}")
        return result
    
    def _mask_pii(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Mask personally identifiable information."""
        masked = data.copy()
        
        # Mask known PII fields
        for field in self.pii_fields:
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
        for pii_type, pattern in self.pii_patterns.items():
            masked = re.sub(
                pattern, 
                f'[{pii_type.upper()}_MASKED]', 
                masked
            )
        return masked
    
    def _clean(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Clean and normalize data."""
        cleaned = {}
        
        for key, value in data.items():
            if value is not None:
                # Normalize strings
                if isinstance(value, str):
                    value = value.strip()
                    if not value:  # Skip empty strings
                        continue
                
                # Remove null values
                cleaned[key] = value
        
        return cleaned
    
    def _validate(self, data: Dict[str, Any]) -> bool:
        """Validate data against schema."""
        errors = []
        
        for field, field_type in self.schema.items():
            if field in data:
                if not isinstance(data[field], field_type):
                    errors.append(
                        f"Field {field} expected {field_type.__name__}, "
                        f"got {type(data[field]).__name__}"
                    )
        
        if errors:
            raise ValueError(f"Schema validation failed: {'; '.join(errors)}")
        
        return True
    
    def _convert_to_schema(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Convert data to standard schema format."""
        if not self.schema:
            return data
        
        converted = {}
        for field in self.schema:
            if field in data:
                converted[field] = data[field]
        
        return converted
    
    def detect_pii(self, data: Dict[str, Any]) -> Dict[str, List[str]]:
        """Detect PII in data without masking."""
        detected = {}
        
        for key, value in data.items():
            if isinstance(value, str):
                for pii_type, pattern in self.pii_patterns.items():
                    if re.search(pattern, value):
                        if key not in detected:
                            detected[key] = []
                        detected[key].append(pii_type)
        
        return detected
