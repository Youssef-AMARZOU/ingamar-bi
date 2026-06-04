# Project OMNI - Architecture

## System Architecture Overview

The system is built around an event-driven architecture with ETL flows managed by a central orchestrator.

### Layer 1: Ingestion (Event Listeners)

Replaces temporal triggers (CRON) with real-time event detection:

- **Webhooks**: HTTP callbacks from external systems
- **CDC (Change Data Capture)**: Database change monitoring
- **Message Queues**: RabbitMQ/Kafka for async processing

```python
# Example: Webhook listener
@app.route('/webhook/jira', methods=['POST'])
def jira_webhook():
    event = request.json
    if event['issue']['fields']['priority']['name'] == 'Highest':
        route_to_critical_flow(event)
    else:
        route_to_standard_flow(event)
```

### Layer 2: Orchestration (n8n / Apache Airflow)

Coordinates sub-agents through workflow definitions:

```yaml
# n8n workflow example
nodes:
  - name: "Extract Data"
    type: "python-function"
    parameters:
      script: "extract_and_clean(data)"
  
  - name: "Semantic Routing"
    type: "ai-classifier"
    parameters:
      model: "llama-3.3-70b"
      categories: ["critical", "standard", "complex"]
  
  - name: "Plan Resources"
    type: "gpt-4o"
    parameters:
      prompt: "Optimize resource allocation for: {{data}}"
```

### Layer 3: Cognitive (LLM & NLP)

AI models for natural language processing:

- **Primary**: GPT-4o (complex reasoning, validation)
- **Secondary**: Llama 3.3-70b (fast routing, classification)

```python
class CognitiveRouter:
    def __init__(self):
        self.primary_llm = OpenAI(model="gpt-4o")
        self.secondary_llm = Groq(model="llama-3.3-70b")
    
    def route(self, task: str) -> str:
        # Fast classification with secondary LLM
        category = self.secondary_llm.classify(task)
        
        if category == "complex":
            # Use primary LLM for complex tasks
            return self.primary_llm.process(task)
        else:
            return self.secondary_llm.process(task)
```

### Layer 4: Memory (Vector Database)

RAG (Retrieval-Augmented Generation) for historical context:

```python
class VectorMemory:
    def __init__(self):
        self.client = QdrantClient("localhost", port=6333)
        self.collection = "task_history"
    
    def find_similar(self, task_embedding: list, limit: int = 5):
        results = self.client.search(
            collection_name=self.collection,
            query_vector=task_embedding,
            limit=limit
        )
        return results
    
    def estimate_duration(self, task: str) -> int:
        # Find similar historical tasks
        embedding = get_embedding(task)
        similar = self.find_similar(embedding)
        
        # Calculate average duration from similar tasks
        durations = [r.payload['duration'] for r in similar]
        return sum(durations) / len(durations) if durations else 30
```

### Layer 5: Execution & Writing

API destinations for final output:

- **ERP Systems**: SAP, Oracle
- **Google Workspace**: Sheets, Docs, Calendar
- **Databases**: PostgreSQL (structured), MongoDB (logs)

## Data Flow Diagram

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   External  │    │   Webhook   │    │   Event     │
│   System    │───▶│   Listener  │───▶│   Queue     │
└─────────────┘    └─────────────┘    └─────────────┘
                                            │
                                            ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Vector    │◀───│  Semantic   │◀───│  Agent      │
│   Database  │    │  Router     │    │  Extracteur │
└─────────────┘    └─────────────┘    └─────────────┘
                          │
                          ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Agent     │───▶│   Agent     │───▶│   Output    │
│   Planif.   │    │   Valid.    │    │   APIs      │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Component Interaction

| Component | Input | Output | Technology |
|-----------|-------|--------|-----------|
| Ingestion | Raw events | Structured events | Webhooks, Kafka |
| Router | Events | Category + Priority | LLM, Rules |
| Extracteur | Raw data | Clean schema | Python, Pandas |
| Planificateur | Clean data + context | Resource plan | GPT-4o, Optimization |
| Validateur | Plan | Validated plan | Rules, LLM |
| Executor | Validated plan | API calls | Python, HTTP |

## Scalability Considerations

- **Horizontal Scaling**: Each agent can be scaled independently
- **Load Balancing**: Round-robin for stateless agents
- **Queue Management**: RabbitMQ for async processing
- **Caching**: Redis for frequent queries
- **Monitoring**: Prometheus + Grafana for metrics
