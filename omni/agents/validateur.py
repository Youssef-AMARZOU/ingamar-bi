"""Agent Validateur - Audit and anomaly detection."""

import json
import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """Validation result container."""
    valid: bool
    errors: List[str]
    suggestion: Optional[str] = None
    confidence: float = 1.0


class AgentValidateur:
    """
    Agent responsible for:
    1. Rule-based validation
    2. LLM-based validation
    3. Cross-reference validation
    4. Anomaly detection
    """
    
    def __init__(self, llm=None, rule_engine=None):
        self.llm = llm
        self.rule_engine = rule_engine
        self.validation_rules = self._load_default_rules()
    
    def validate(self, plan: Dict[str, Any]) -> ValidationResult:
        """
        Validate plan for anomalies.
        
        Args:
            plan: Plan to validate
            
        Returns:
            ValidationResult with validity status and errors
        """
        logger.info("Validating plan...")
        
        # Step 1: Rule-based validation
        rule_errors = self._validate_rules(plan)
        if rule_errors:
            logger.warning(f"Rule validation failed: {rule_errors}")
            return ValidationResult(
                valid=False,
                errors=rule_errors,
                suggestion="Fix rule violations",
                confidence=0.9
            )
        
        # Step 2: LLM-based validation
        if self.llm:
            llm_validation = self._validate_with_llm(plan)
            if not llm_validation.valid:
                logger.warning(f"LLM validation failed: {llm_validation.errors}")
                return llm_validation
        
        # Step 3: Cross-reference validation
        cross_validation = self._validate_cross_references(plan)
        if not cross_validation.valid:
            logger.warning(f"Cross-reference validation failed: {cross_validation.errors}")
            return cross_validation
        
        # Step 4: Anomaly detection
        anomaly_result = self._detect_anomalies(plan)
        if not anomaly_result.valid:
            logger.warning(f"Anomaly detected: {anomaly_result.errors}")
            return anomaly_result
        
        logger.info("Validation passed")
        return ValidationResult(valid=True, errors=[], confidence=1.0)
    
    def _load_default_rules(self) -> List[Dict[str, Any]]:
        """Load default validation rules."""
        return [
            {
                'name': 'resource_limit',
                'check': lambda p: len(p.get('resources', [])) <= 8,
                'error': 'Resource overallocation: max 8 resources'
            },
            {
                'name': 'budget_limit',
                'check': lambda p: p.get('budget', 0) <= 10000,
                'error': 'Budget exceeds maximum limit of 10000'
            },
            {
                'name': 'duration_limit',
                'check': lambda p: p.get('duration', 0) <= 480,  # 8 hours
                'error': 'Duration exceeds maximum of 8 hours'
            },
            {
                'name': 'schedule_exists',
                'check': lambda p: 'schedule' in p,
                'error': 'Schedule is required'
            },
            {
                'name': 'resources_exist',
                'check': lambda p: len(p.get('resources', [])) > 0,
                'error': 'At least one resource is required'
            }
        ]
    
    def _validate_rules(self, plan: Dict[str, Any]) -> List[str]:
        """Validate against business rules."""
        errors = []
        
        for rule in self.validation_rules:
            try:
                if not rule['check'](plan):
                    errors.append(rule['error'])
            except Exception as e:
                logger.error(f"Rule {rule['name']} failed: {e}")
                errors.append(f"Rule {rule['name']} execution error")
        
        return errors
    
    def _validate_with_llm(self, plan: Dict[str, Any]) -> ValidationResult:
        """Validate using LLM for complex checks."""
        prompt = f"""
        Validate this plan for potential issues:
        
        Plan: {json.dumps(plan, indent=2)}
        
        Check for:
        1. Resource conflicts
        2. Timeline overlaps
        3. Business rule violations
        4. Potential bottlenecks
        5. Missing dependencies
        
        Return JSON: {{"valid": bool, "errors": [], "suggestion": str, "confidence": float}}
        """
        
        try:
            response = self.llm.generate(prompt)
            result = json.loads(response)
            
            return ValidationResult(
                valid=result.get('valid', True),
                errors=result.get('errors', []),
                suggestion=result.get('suggestion'),
                confidence=result.get('confidence', 0.8)
            )
        except Exception as e:
            logger.error(f"LLM validation failed: {e}")
            return ValidationResult(
                valid=True,  # Assume valid if LLM fails
                errors=[],
                confidence=0.5
            )
    
    def _validate_cross_references(self, plan: Dict[str, Any]) -> ValidationResult:
        """Validate cross-references between plan components."""
        errors = []
        
        # Check dependencies exist
        dependencies = plan.get('dependencies', [])
        for dep in dependencies:
            if not self._dependency_exists(dep):
                errors.append(f"Dependency {dep} not found")
        
        # Check resource availability
        resources = plan.get('resources', [])
        for resource in resources:
            if not self._resource_available(resource):
                errors.append(f"Resource {resource} not available")
        
        # Check schedule consistency
        schedule = plan.get('schedule', {})
        if not self._schedule_consistent(schedule):
            errors.append("Schedule inconsistency detected")
        
        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            suggestion="Check cross-references" if errors else None,
            confidence=0.9 if not errors else 0.7
        )
    
    def _dependency_exists(self, dependency: str) -> bool:
        """Check if dependency exists."""
        # In real implementation, check against dependency registry
        return True
    
    def _resource_available(self, resource: str) -> bool:
        """Check if resource is available."""
        # In real implementation, check against resource pool
        return True
    
    def _schedule_consistent(self, schedule: Dict[str, Any]) -> bool:
        """Check schedule consistency."""
        start = schedule.get('start')
        end = schedule.get('end')
        
        if start and end:
            try:
                start_dt = datetime.fromisoformat(start)
                end_dt = datetime.fromisoformat(end)
                return start_dt < end_dt
            except:
                return False
        
        return True
    
    def _detect_anomalies(self, plan: Dict[str, Any]) -> ValidationResult:
        """Detect anomalies in plan."""
        anomalies = []
        
        # Check for unusual resource patterns
        resources = plan.get('resources', [])
        if len(resources) > 6:
            anomalies.append("Unusually high resource count")
        
        # Check for unusual duration
        duration = plan.get('duration', 0)
        if duration > 360:  # 6 hours
            anomalies.append("Unusually long duration")
        
        # Check for unusual budget
        budget = plan.get('budget', 0)
        if budget > 5000:
            anomalies.append("Unusually high budget")
        
        return ValidationResult(
            valid=len(anomalies) == 0,
            errors=anomalies,
            suggestion="Review anomalies" if anomalies else None,
            confidence=0.8 if not anomalies else 0.6
        )
    
    def add_rule(self, name: str, check_fn, error_msg: str):
        """Add custom validation rule."""
        self.validation_rules.append({
            'name': name,
            'check': check_fn,
            'error': error_msg
        })
    
    def audit_decision(
        self,
        agent: str,
        action: str,
        input_data: Dict[str, Any],
        output_data: Dict[str, Any],
        confidence: float
    ):
        """Audit agent decision for compliance."""
        audit_entry = {
            'timestamp': datetime.now().isoformat(),
            'agent': agent,
            'action': action,
            'input': input_data,
            'output': output_data,
            'confidence': confidence,
            'validation': 'passed'
        }
        
        logger.info(f"Audit: {agent} - {action} - confidence={confidence}")
        
        # Store in audit log (MongoDB)
        # self.audit_collection.insert_one(audit_entry)
