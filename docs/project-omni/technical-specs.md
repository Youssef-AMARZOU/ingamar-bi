# Project OMNI - Technical Specifications

## 1. Recommended Technology Stack

### Orchestration Layer

| Tool | Use Case | Pros | Cons |
|------|----------|------|------|
| **n8n** | Visual workflow editor | Easy to use, visual UI | Limited scalability |
| **Apache Airflow** | Code-based DAGs | Highly scalable, Python-native | Steeper learning curve |
| **Python Scripts** | Custom orchestration | Full control, lightweight | More development time |

**Recommendation**: Start with n8n for rapid prototyping, migrate to Airflow for production.

### LLM Models

| Model | Role | API | Cost |
|-------|------|-----|------|
| **GPT-4o** | Complex reasoning, validation | OpenAI | $0.005/1K tokens |
| **Llama 3.3-70b** | Fast routing, classification | Groq | Free tier |
| **Claude 3.5 Haiku** | Fallback, simple tasks | Anthropic | $0.00025/1K tokens |

**Recommendation**: Use Groq for fast routing, GPT-4o for complex tasks.

### Vector Databases

| Database | Type | Pros | Cons |
|----------|------|------|------|
| **Qdrant** | Self-hosted | Open-source, fast | Self-managed |
| **Pinecone** | Managed | Easy setup, scalable | Costly at scale |
| **Milvus** | Distributed | Highly scalable | Complex setup |

**Recommendation**: Qdrant for self-hosted, Pinecone for managed.

### Operational Databases

| Database | Use Case | Schema |
|----------|----------|--------|
| **PostgreSQL** | Structured data | Relational |
| **MongoDB** | Logs, unstructured JSON | Document |

## 2. Implementation Details

### Agent Extracteur

```python
# omni/agents/extracteur.py
import pandas as pd
from typing import Dict, Any

class AgentExtracteur:
    """Data cleaning and schema conversion agent."""
    
    def __init__(self, schema: Dict[str, Any]):
        self.schema = schema
        self.pii_fields = ['email', 'phone', 'ssn', 'credit_card']
    
    def extract(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract and clean data from raw input.
        
        Steps:
        1. Mask PII data
        2. Clean and normalize
        3. Validate against schema
        4. Convert to standard format
        """
        # Step 1: Mask PII
        masked_data = self._mask_pii(raw_data)
        
        # Step 2: Clean
        cleaned_data = self._clean(masked_data)
        
        # Step 3: Validate
        self._validate(cleaned_data)
        
        # Step 4: Convert
        return self._convert_to_schema(cleaned_data)
    
    def _mask_pii(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Mask personally identifiable information."""
        masked = data.copy()
        for field in self.pii_fields:
            if field in masked:
                masked[field] = self._mask_value(masked[field])
        return masked
    
    def _mask_value(self, value: str) -> str:
        """Mask a PII value."""
        if not value or len(str(value)) < 4:
            return "***"
        return str(value)[:2] + "***" + str(value)[-2:]
    
    def _clean(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Clean and normalize data."""
        cleaned = {}
        for key, value in data.items():
            if value is not None:
                # Normalize strings
                if isinstance(value, str):
                    value = value.strip().lower()
                # Remove null values
                cleaned[key] = value
        return cleaned
    
    def _validate(self, data: Dict[str, Any]) -> bool:
        """Validate data against schema."""
        for field, field_type in self.schema.items():
            if field in data:
                if not isinstance(data[field], field_type):
                    raise ValueError(
                        f"Field {field} expected {field_type}, "
                        f"got {type(data[field])}"
                    )
        return True
    
    def _convert_to_schema(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Convert data to standard schema format."""
        converted = {}
        for field in self.schema:
            if field in data:
                converted[field] = data[field]
        return converted
```

### Agent Planificateur

```python
# omni/agents/planificateur.py
from typing import Dict, Any, List
import json

class AgentPlanificateur:
    """Resource allocation and scheduling agent."""
    
    def __init__(self, llm, vector_db):
        self.llm = llm
        self.vector_db = vector_db
        self.constraints = []
    
    def plan(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate optimal resource plan.
        
        Steps:
        1. Query RAG for historical context
        2. Generate initial plan with LLM
        3. Optimize with constraints
        4. Validate feasibility
        """
        # Step 1: Get historical context
        context = self._get_historical_context(task)
        
        # Step 2: Generate initial plan
        initial_plan = self._generate_plan(task, context)
        
        # Step 3: Optimize
        optimized_plan = self._optimize(initial_plan)
        
        # Step 4: Validate
        if not self._validate_feasibility(optimized_plan):
            return self._replan(task, optimized_plan)
        
        return optimized_plan
    
    def _get_historical_context(self, task: Dict[str, Any]) -> str:
        """Query RAG for similar historical tasks."""
        task_text = f"{task['summary']} {task['description']}"
        embedding = self._get_embedding(task_text)
        
        similar_tasks = self.vector_db.search(
            collection_name="task_history",
            query_vector=embedding,
            limit=5
        )
        
        context_parts = []
        for t in similar_tasks:
            context_parts.append(
                f"- {t.payload['summary']}: "
                f"Duration={t.payload['duration']}min, "
                f"Resources={t.payload['resources']}, "
                f"Success={t.payload['success']}"
            )
        
        return "\n".join(context_parts)
    
    def _generate_plan(
        self, task: Dict[str, Any], context: str
    ) -> Dict[str, Any]:
        """Generate plan using LLM."""
        prompt = f"""
        Generate optimal resource plan for this task:
        
        Task: {json.dumps(task, indent=2)}
        
        Historical Context:
        {context}
        
        Return JSON with:
        - resources: list of required resources
        - duration: estimated duration in minutes
        - schedule: proposed schedule
        - dependencies: list of dependencies
        """
        
        response = self.llm.generate(prompt)
        return json.loads(response)
    
    def _optimize(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        """Optimize plan with constraints."""
        # Apply constraint optimization
        optimized = plan.copy()
        
        # Check resource constraints
        for constraint in self.constraints:
            optimized = constraint.apply(optimized)
        
        return optimized
    
    def _validate_feasibility(self, plan: Dict[str, Any]) -> bool:
        """Validate plan feasibility."""
        # Check for resource conflicts
        if plan.get('resources', []) > 8:
            return False
        
        # Check timeline overlaps
        if self._has_overlaps(plan.get('schedule', [])):
            return False
        
        return True
    
    def _has_overlaps(self, schedule: List[Dict]) -> bool:
        """Check for schedule overlaps."""
        for i, slot1 in enumerate(schedule):
            for slot2 in schedule[i+1:]:
                if (slot1['start'] < slot2['end'] and 
                    slot2['start'] < slot1['end']):
                    return True
        return False
```

### Agent Validateur

```python
# omni/agents/validateur.py
from typing import Dict, Any, List
import json

class AgentValidateur:
    """Audit and anomaly detection agent."""
    
    def __init__(self, llm, rule_engine):
        self.llm = llm
        self.rule_engine = rule_engine
    
    def validate(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate plan for anomalies.
        
        Steps:
        1. Rule-based validation
        2. LLM-based validation
        3. Cross-reference validation
        """
        # Step 1: Rule-based validation
        rule_errors = self._validate_rules(plan)
        if rule_errors:
            return {
                'valid': False,
                'errors': rule_errors,
                'suggestion': 'Fix rule violations'
            }
        
        # Step 2: LLM-based validation
        llm_validation = self._validate_with_llm(plan)
        if not llm_validation['valid']:
            return llm_validation
        
        # Step 3: Cross-reference validation
        cross_validation = self._validate_cross_references(plan)
        if not cross_validation['valid']:
            return cross_validation
        
        return {'valid': True, 'errors': [], 'suggestion': None}
    
    def _validate_rules(self, plan: Dict[str, Any]) -> List[str]:
        """Validate against business rules."""
        errors = []
        
        # Rule 1: No resource overallocation
        if len(plan.get('resources', [])) > 8:
            errors.append("Resource overallocation: max 8 resources")
        
        # Rule 2: No schedule overlaps
        if self._has_overlaps(plan.get('schedule', [])):
            errors.append("Schedule overlap detected")
        
        # Rule 3: Budget constraints
        if plan.get('budget', 0) > 10000:
            errors.append("Budget exceeds maximum limit")
        
        return errors
    
    def _validate_with_llm(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        """Validate using LLM for complex checks."""
        prompt = f"""
        Validate this plan for potential issues:
        
        Plan: {json.dumps(plan, indent=2)}
        
        Check for:
        1. Resource conflicts
        2. Timeline overlaps
        3. Business rule violations
        4. Potential bottlenecks
        
        Return JSON: {{"valid": bool, "errors": [], "suggestion": str}}
        """
        
        response = self.llm.generate(prompt)
        return json.loads(response)
    
    def _validate_cross_references(
        self, plan: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Validate cross-references between plan components."""
        # Check dependencies exist
        for dep in plan.get('dependencies', []):
            if not self._dependency_exists(dep):
                return {
                    'valid': False,
                    'errors': [f"Dependency {dep} not found"],
                    'suggestion': 'Check dependency references'
                }
        
        return {'valid': True, 'errors': [], 'suggestion': None}
```

## 3. Resilience & Error Handling

### Circuit Breaker Implementation

```python
# omni/resilience/circuit_breaker.py
import time
from enum import Enum

class CircuitState(Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"

class CircuitBreaker:
    """Circuit breaker for API resilience."""
    
    def __init__(
        self,
        failure_threshold: int = 5,
        reset_timeout: int = 60
    ):
        self.failure_count = 0
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.state = CircuitState.CLOSED
        self.last_failure_time = None
    
    def call(self, func, *args, **kwargs):
        """Execute function with circuit breaker protection."""
        if self.state == CircuitState.OPEN:
            if self._should_try_reset():
                self.state = CircuitState.HALF_OPEN
            else:
                raise CircuitBreakerOpenError(
                    "Circuit breaker is OPEN"
                )
        
        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise
    
    def _should_try_reset(self) -> bool:
        """Check if we should try to reset the circuit."""
        return (
            time.time() - self.last_failure_time 
            > self.reset_timeout
        )
    
    def _on_success(self):
        """Handle successful call."""
        self.failure_count = 0
        self.state = CircuitState.CLOSED
    
    def _on_failure(self):
        """Handle failed call."""
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN
```

### Graceful Degradation

```python
# omni/resilience/degradation.py
import logging

logger = logging.getLogger(__name__)

class GracefulDegradation:
    """Graceful degradation with LLM fallback."""
    
    def __init__(self, primary_llm, secondary_llm):
        self.primary_llm = primary_llm
        self.secondary_llm = secondary_llm
        self.circuit_breaker = CircuitBreaker()
    
    def process(self, task: str) -> str:
        """Process task with fallback support."""
        try:
            # Try primary LLM
            return self.circuit_breaker.call(
                self.primary_llm.generate, task
            )
        except CircuitBreakerOpenError:
            # Fallback to secondary
            logger.warning(
                "Primary LLM unavailable, using fallback"
            )
            return self.secondary_llm.generate(task)
        except Exception as e:
            # Log and use secondary
            logger.error(f"Primary LLM error: {e}")
            return self.secondary_llm.generate(task)
```

## 4. Configuration

### Environment Variables

```bash
# .env.omni
# LLM Configuration
OPENAI_API_KEY=your_openai_key
GROQ_API_KEY=your_groq_key
ANTHROPIC_API_KEY=your_anthropic_key

# Database Configuration
POSTGRES_URL=postgresql://user:pass@localhost:5432/omni
MONGODB_URL=mongodb://localhost:27017/omni
QDRANT_URL=http://localhost:6333

# Orchestration
N8N_URL=http://localhost:5678
AIRFLOW_URL=http://localhost:8080

# Security
ENCRYPTION_KEY=your_encryption_key
PII_MASKING_ENABLED=true
```

### Docker Compose

```yaml
# docker-compose.omni.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: omni
      POSTGRES_USER: omni
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  mongodb:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage

  n8n:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
    volumes:
      - n8n_data:/home/node/.n8n

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
  mongo_data:
  qdrant_data:
  n8n_data:
```
