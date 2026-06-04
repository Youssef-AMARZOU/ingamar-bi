# Project OMNI - Multi-Agent Orchestration System

## Overview

Project OMNI (Orchestration and Optimization of Operations) is an enterprise-grade multi-agent system for intelligent task processing, ETL optimization, and autonomous error management. It transforms basic automation into a resilient architecture capable of dynamic reasoning and advanced data engineering.

## Key Features

- **Cognitive Automation**: Semantic qualification of incoming data
- **High Availability (99.9%)**: Fallback mechanisms and Circuit Breakers
- **Temporal Optimization**: Historical data (Vector RAG) for accurate planning
- **Scalability**: Decoupled micro-agents driven by events

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    EVENT-DRIVEN ARCHITECTURE                 │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Ingestion  │  │ Orchestration│  │   Cognitive  │     │
│  │   Layer      │──│   Layer      │──│   Layer      │     │
│  │  (Webhooks)  │  │  (n8n/Airflow│  │  (LLM/NLP)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
│                    ┌──────┴──────┐                          │
│                    │   Memory    │                          │
│                    │   Layer     │                          │
│                    │  (Qdrant)   │                          │
│                    └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

## Multi-Agent System

| Agent | Role | Technology |
|-------|------|-----------|
| **Agent Extracteur** | Data cleaning & schema conversion | Python, Pandas |
| **Agent Planificateur** | Resource allocation & scheduling | GPT-4o, Constraint optimization |
| **Agent Validateur** | Audit & anomaly detection | Rule engine, LLM validation |

## Quick Start

```bash
# Clone repository
git clone https://github.com/Youssef-AMARZOU/ingamar-bi.git
cd ingamar-bi

# Start OMNI stack
cd omni
docker-compose up -d

# Access n8n workflow editor
open http://localhost:5678
```

## Documentation

- [Architecture](architecture.md) - System design and data flow
- [Specifications](specifications.md) - Functional requirements
- [Technical Specs](technical-specs.md) - Implementation details
- [Security](security.md) - Security and governance
- [Deliverables](deliverables.md) - Deployment and deliverables

## Integration

Project OMNI integrates with:
- **INGAMAR BI** - Main BI platform
- **Jira** - Issue tracking and project management
- **Notion** - Documentation and knowledge base
- **GitHub/GitLab** - Source control and CI/CD
- **Hugging Face** - Model deployment

## License

GPL-2.0 License - See [LICENSE](../../LICENSE) for details
