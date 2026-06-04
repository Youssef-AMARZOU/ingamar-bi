# Project OMNI - Functional Specifications

## 1. Semantic Intelligent Routing (Triage)

When receiving new data or task, the system doesn't process uniformly. A fast classification model analyzes the request:

### Flow Categories

| Category | Description | Action |
|----------|-------------|--------|
| **Critical** | Time-sensitive, high-priority | Immediate routing to alert agent, synchronous notification |
| **Standard** | Normal priority | Async queue for planning agent |
| **Complex** | Requires enrichment | Data enrichment pipeline before execution |

### Implementation

```python
class SemanticRouter:
    def __init__(self):
        self.classifier = GroqLLM(model="llama-3.3-70b")
        self.categories = ["critical", "standard", "complex"]
    
    def classify(self, task: dict) -> str:
        prompt = f"""
        Classify this task into one of: {self.categories}
        
        Task: {task['summary']}
        Description: {task['description']}
        Priority: {task['priority']}
        
        Return only the category name.
        """
        return self.classifier.generate(prompt).strip().lower()
    
    def route(self, task: dict):
        category = self.classify(task)
        
        if category == "critical":
            return self.route_to_alert(task)
        elif category == "standard":
            return self.route_to_planner(task)
        else:  # complex
            return self.route_to_enrichment(task)
```

## 2. Contextual Memory (RAG)

The planning agent doesn't rely solely on general training. Before planning, it queries a vector database containing company task history.

### RAG Process

1. **Embedding Generation**: Convert task to vector representation
2. **Similarity Search**: Find similar historical tasks
3. **Context Extraction**: Extract relevant information
4. **Estimation Adjustment**: Adjust duration based on historical data

```python
class RAGPlanner:
    def __init__(self):
        self.vector_db = QdrantClient("localhost", port=6333)
        self.llm = OpenAI(model="gpt-4o")
    
    def plan_with_context(self, task: dict) -> dict:
        # Generate embedding for task
        task_text = f"{task['summary']} {task['description']}"
        embedding = get_embedding(task_text)
        
        # Find similar historical tasks
        similar_tasks = self.vector_db.search(
            collection_name="task_history",
            query_vector=embedding,
            limit=5
        )
        
        # Extract context
        context = self.build_context(similar_tasks)
        
        # Generate plan with historical context
        prompt = f"""
        Plan this task considering historical context:
        
        Task: {task}
        
        Similar historical tasks:
        {context}
        
        Generate optimal resource allocation and timeline.
        """
        
        return self.llm.generate(prompt)
    
    def build_context(self, similar_tasks: list) -> str:
        context = []
        for task in similar_tasks:
            context.append(
                f"- {task.payload['summary']}: "
                f"Duration={task.payload['duration']}min, "
                f"Resources={task.payload['resources']}, "
                f"Success={task.payload['success']}"
            )
        return "\n".join(context)
```

### Example RAG Query

```
User: "Extract data from SAP system"

RAG Process:
1. Embed query → [0.12, -0.45, 0.78, ...]
2. Search vector DB → Find 5 similar tasks
3. Extract context:
   - "SAP data extraction Q1 2025": 45min, 2 CPUs, Success
   - "SAP inventory sync": 30min, 1 CPU, Success
   - "SAP report generation": 60min, 4 CPUs, Failed (timeout)
4. Adjust estimation: Average 45min, recommend 3 CPUs
```

## 3. Multi-Agent System (Separation of Concerns)

Processing is divided between specialized roles:

### Agent Extracteur (Data Engineering)

**Role**: Clean raw data and convert to strict schema

```python
class AgentExtracteur:
    def __init__(self):
        self.schema_validator = SchemaValidator()
        self.pii_masker = PIIMasker()
    
    def extract(self, raw_data: dict) -> dict:
        # Step 1: Mask PII data
        masked_data = self.pii_masker.mask(raw_data)
        
        # Step 2: Clean and normalize
        cleaned_data = self.clean(masked_data)
        
        # Step 3: Validate against schema
        if not self.schema_validator.validate(cleaned_data):
            raise SchemaValidationError("Data doesn't match expected schema")
        
        # Step 4: Convert to standard format
        return self.convert_to_schema(cleaned_data)
    
    def clean(self, data: dict) -> dict:
        # Remove null values
        cleaned = {k: v for k, v in data.items() if v is not None}
        
        # Normalize strings
        for key, value in cleaned.items():
            if isinstance(value, str):
                cleaned[key] = value.strip().lower()
        
        return cleaned
```

### Agent Planificateur (Resource Optimization)

**Role**: Apply business constraints and optimization theory

```python
class AgentPlanificateur:
    def __init__(self):
        self.llm = OpenAI(model="gpt-4o")
        self.rag = RAGPlanner()
        self.optimizer = ConstraintOptimizer()
    
    def plan(self, task: dict, context: dict) -> dict:
        # Step 1: Get historical context via RAG
        historical_context = self.rag.get_context(task)
        
        # Step 2: Generate initial plan with LLM
        initial_plan = self.llm.generate_plan(task, historical_context)
        
        # Step 3: Optimize with constraints
        optimized_plan = self.optimizer.optimize(
            plan=initial_plan,
            constraints=self.get_constraints(task)
        )
        
        # Step 4: Validate feasibility
        if not self.validate_feasibility(optimized_plan):
            return self.replan(task, optimized_plan, "Infeasible plan")
        
        return optimized_plan
    
    def get_constraints(self, task: dict) -> list:
        return [
            ResourceConstraint(max_cpu=8, max_memory="16GB"),
            TimeConstraint(deadline=task['deadline']),
            BusinessConstraint(no_overlap=True),
            CostConstraint(max_budget=task['budget'])
        ]
```

### Agent Validateur (Audit & Anomaly Detection)

**Role**: Audit output and detect anomalies

```python
class AgentValidateur:
    def __init__(self):
        self.rule_engine = RuleEngine()
        self.llm = OpenAI(model="gpt-4o")
    
    def validate(self, plan: dict) -> ValidationResult:
        # Step 1: Rule-based validation
        rule_errors = self.rule_engine.validate(plan)
        if rule_errors:
            return ValidationResult(
                valid=False,
                errors=rule_errors,
                suggestion="Fix rule violations"
            )
        
        # Step 2: LLM-based validation
        llm_validation = self.llm_validate(plan)
        if not llm_validation['valid']:
            return ValidationResult(
                valid=False,
                errors=llm_validation['errors'],
                suggestion=llm_validation['suggestion']
            )
        
        # Step 3: Cross-reference validation
        cross_validation = self.cross_validate(plan)
        if not cross_validation['valid']:
            return ValidationResult(
                valid=False,
                errors=cross_validation['errors'],
                suggestion="Check cross-references"
            )
        
        return ValidationResult(valid=True, errors=[], suggestion=None)
    
    def llm_validate(self, plan: dict) -> dict:
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
        return json.loads(self.llm.generate(prompt))
```

## 4. Error Handling & Resilience

### Circuit Breaker Pattern

```python
class CircuitBreaker:
    def __init__(self, failure_threshold=5, reset_timeout=60):
        self.failure_count = 0
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
        self.last_failure_time = None
    
    def call(self, func, *args, **kwargs):
        if self.state == "OPEN":
            if time.time() - self.last_failure_time > self.reset_timeout:
                self.state = "HALF_OPEN"
            else:
                raise CircuitBreakerOpenError("Circuit breaker is OPEN")
        
        try:
            result = func(*args, **kwargs)
            self.on_success()
            return result
        except Exception as e:
            self.on_failure()
            raise
    
    def on_success(self):
        self.failure_count = 0
        self.state = "CLOSED"
    
    def on_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
```

### Graceful Degradation

```python
class GracefulDegradation:
    def __init__(self):
        self.primary_llm = OpenAI(model="gpt-4o")
        self.secondary_llm = Groq(model="llama-3.3-70b")
        self.circuit_breaker = CircuitBreaker()
    
    def process(self, task: str) -> str:
        try:
            # Try primary LLM first
            return self.circuit_breaker.call(
                self.primary_llm.generate, task
            )
        except CircuitBreakerOpenError:
            # Fallback to secondary LLM
            logger.warning("Primary LLM unavailable, using fallback")
            return self.secondary_llm.generate(task)
        except Exception as e:
            # Log error and use secondary
            logger.error(f"Primary LLM error: {e}")
            return self.secondary_llm.generate(task)
```
