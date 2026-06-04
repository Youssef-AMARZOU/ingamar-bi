"""Graceful degradation for Project OMNI."""

import logging
from typing import Any

logger = logging.getLogger(__name__)


class GracefulDegradation:
    """
    Graceful degradation with LLM fallback.
    
    Features:
    - Primary/secondary LLM switching
    - Automatic fallback on failure
    - Error logging
    """
    
    def __init__(self, primary_llm=None, secondary_llm=None):
        """
        Initialize graceful degradation.
        
        Args:
            primary_llm: Primary LLM instance
            secondary_llm: Secondary/fallback LLM instance
        """
        self.primary_llm = primary_llm
        self.secondary_llm = secondary_llm
        self.circuit_breaker = None
        
        try:
            from .circuit_breaker import CircuitBreaker
            self.circuit_breaker = CircuitBreaker()
        except ImportError:
            logger.warning("CircuitBreaker not available")
    
    def process(self, task: str) -> str:
        """
        Process task with fallback support.
        
        Args:
            task: Task to process
            
        Returns:
            Processing result
        """
        # Try primary LLM
        if self.primary_llm:
            try:
                if self.circuit_breaker:
                    return self.circuit_breaker.call(
                        self.primary_llm.generate, task
                    )
                else:
                    return self.primary_llm.generate(task)
            except Exception as e:
                logger.warning(f"Primary LLM failed: {e}")
        
        # Fallback to secondary LLM
        if self.secondary_llm:
            logger.info("Using secondary LLM")
            try:
                return self.secondary_llm.generate(task)
            except Exception as e:
                logger.error(f"Secondary LLM failed: {e}")
                raise
        
        raise RuntimeError("No LLM available for processing")
    
    def process_with_fallback(
        self,
        task: str,
        fallback_value: Any = None
    ) -> Any:
        """
        Process with fallback value.
        
        Args:
            task: Task to process
            fallback_value: Value to return on failure
            
        Returns:
            Processing result or fallback value
        """
        try:
            return self.process(task)
        except Exception as e:
            logger.error(f"Processing failed: {e}")
            return fallback_value
