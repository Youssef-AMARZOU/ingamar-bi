"""Semantic routing for Project OMNI."""

import json
import logging
from typing import Dict, Any, Literal

logger = logging.getLogger(__name__)

FlowCategory = Literal["critical", "standard", "complex"]


class SemanticRouter:
    """
    Semantic routing for intelligent task triage.
    
    Features:
    - Fast classification with secondary LLM
    - Category-based routing
    - Fallback handling
    """
    
    def __init__(self, llm=None):
        """
        Initialize semantic router.
        
        Args:
            llm: LLM instance for classification
        """
        self.llm = llm
        self.categories = ["critical", "standard", "complex"]
    
    def classify(self, task: Dict[str, Any]) -> FlowCategory:
        """
        Classify task into category.
        
        Args:
            task: Task to classify
            
        Returns:
            Task category
        """
        if self.llm:
            return self._classify_with_llm(task)
        else:
            return self._classify_default(task)
    
    def _classify_with_llm(self, task: Dict[str, Any]) -> FlowCategory:
        """Classify using LLM."""
        prompt = f"""
        Classify this task into one of: {self.categories}
        
        Task: {task.get('summary', '')}
        Description: {task.get('description', '')}
        Priority: {task.get('priority', 'Medium')}
        
        Rules:
        - critical: Time-sensitive, high-priority, system failures
        - standard: Normal priority, routine tasks
        - complex: Requires data enrichment, multi-step processing
        
        Return only the category name.
        """
        
        try:
            response = self.llm.generate(prompt).strip().lower()
            if response in self.categories:
                return response
            else:
                logger.warning(f"Invalid category: {response}")
                return "standard"
        except Exception as e:
            logger.error(f"LLM classification failed: {e}")
            return self._classify_default(task)
    
    def _classify_default(self, task: Dict[str, Any]) -> FlowCategory:
        """Default classification based on rules."""
        priority = task.get('priority', 'Medium').lower()
        summary = task.get('summary', '').lower()
        
        # Critical: Highest priority or failure-related
        if priority == 'highest' or 'failure' in summary or 'error' in summary:
            return "critical"
        
        # Complex: Multi-step or analysis tasks
        if any(word in summary for word in ['analysis', 'report', 'generate', 'process']):
            return "complex"
        
        # Standard: Everything else
        return "standard"
    
    def route(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """
        Route task to appropriate handler.
        
        Args:
            task: Task to route
            
        Returns:
            Routing decision with category and handler
        """
        category = self.classify(task)
        
        routing_decision = {
            'category': category,
            'task': task,
            'handler': self._get_handler(category),
            'priority': self._get_priority(category)
        }
        
        logger.info(f"Routed task to {category}: {task.get('summary', '')}")
        return routing_decision
    
    def _get_handler(self, category: FlowCategory) -> str:
        """Get handler name for category."""
        handlers = {
            "critical": "alert_handler",
            "standard": "planner_handler",
            "complex": "enrichment_handler"
        }
        return handlers.get(category, "planner_handler")
    
    def _get_priority(self, category: FlowCategory) -> int:
        """Get priority number for category."""
        priorities = {
            "critical": 1,
            "standard": 2,
            "complex": 3
        }
        return priorities.get(category, 2)
