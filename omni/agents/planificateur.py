"""Agent Planificateur - Resource allocation and scheduling."""

import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class AgentPlanificateur:
    """
    Agent responsible for:
    1. Resource allocation optimization
    2. Schedule planning
    3. Constraint validation
    4. Historical context integration (RAG)
    """
    
    def __init__(self, llm=None, vector_db=None):
        self.llm = llm
        self.vector_db = vector_db
        self.constraints = []
    
    def plan(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate optimal resource plan.
        
        Args:
            task: Task to plan
            
        Returns:
            Optimized plan with resources, schedule, and timeline
        """
        logger.info(f"Planning task: {task.get('summary', 'Unknown')}")
        
        # Step 1: Get historical context
        context = self._get_historical_context(task)
        
        # Step 2: Generate initial plan
        initial_plan = self._generate_plan(task, context)
        
        # Step 3: Optimize with constraints
        optimized_plan = self._optimize(initial_plan)
        
        # Step 4: Validate feasibility
        if not self._validate_feasibility(optimized_plan):
            logger.warning("Plan not feasible, re-planning...")
            return self._replan(task, optimized_plan)
        
        logger.info(f"Plan generated: {len(optimized_plan.get('resources', []))} resources")
        return optimized_plan
    
    def _get_historical_context(self, task: Dict[str, Any]) -> str:
        """Query RAG for similar historical tasks."""
        if not self.vector_db:
            return "No historical context available"
        
        try:
            task_text = f"{task.get('summary', '')} {task.get('description', '')}"
            embedding = self._get_embedding(task_text)
            
            similar_tasks = self.vector_db.search(
                collection_name="task_history",
                query_vector=embedding,
                limit=5
            )
            
            context_parts = []
            for t in similar_tasks:
                context_parts.append(
                    f"- {t.payload.get('summary', 'Unknown')}: "
                    f"Duration={t.payload.get('duration', 30)}min, "
                    f"Resources={t.payload.get('resources', [])}, "
                    f"Success={t.payload.get('success', True)}"
                )
            
            return "\n".join(context_parts) if context_parts else "No similar tasks found"
            
        except Exception as e:
            logger.error(f"Error getting historical context: {e}")
            return "Error retrieving historical context"
    
    def _get_embedding(self, text: str) -> List[float]:
        """Generate embedding for text."""
        # Use Groq or OpenAI for embeddings
        if self.llm:
            try:
                return self.llm.get_embedding(text)
            except:
                pass
        
        # Fallback: simple hash-based embedding
        import hashlib
        hash_obj = hashlib.md5(text.encode())
        hash_hex = hash_obj.hexdigest()
        return [float(int(hash_hex[i:i+2], 16)) / 255.0 for i in range(0, 32, 2)]
    
    def _generate_plan(
        self, task: Dict[str, Any], context: str
    ) -> Dict[str, Any]:
        """Generate plan using LLM or fallback logic."""
        if self.llm:
            return self._generate_plan_with_llm(task, context)
        else:
            return self._generate_plan_default(task, context)
    
    def _generate_plan_with_llm(
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
        - schedule: proposed schedule with start/end times
        - dependencies: list of dependencies
        - risk_level: low/medium/high
        - contingency: backup plan
        """
        
        try:
            response = self.llm.generate(prompt)
            return json.loads(response)
        except Exception as e:
            logger.error(f"LLM plan generation failed: {e}")
            return self._generate_plan_default(task, context)
    
    def _generate_plan_default(
        self, task: Dict[str, Any], context: str
    ) -> Dict[str, Any]:
        """Generate default plan without LLM."""
        priority = task.get('priority', 'Medium')
        
        # Default resource allocation based on priority
        if priority == 'Highest':
            resources = ['cpu-high', 'memory-high', 'storage-ssd']
            duration = 60
        elif priority == 'High':
            resources = ['cpu-medium', 'memory-medium']
            duration = 45
        elif priority == 'Medium':
            resources = ['cpu-low', 'memory-low']
            duration = 30
        else:
            resources = ['cpu-minimal']
            duration = 15
        
        # Generate schedule
        start_time = datetime.now()
        end_time = start_time + timedelta(minutes=duration)
        
        return {
            'resources': resources,
            'duration': duration,
            'schedule': {
                'start': start_time.isoformat(),
                'end': end_time.isoformat()
            },
            'dependencies': [],
            'risk_level': 'low',
            'contingency': 'Retry with increased resources'
        }
    
    def _optimize(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        """Optimize plan with constraints."""
        optimized = plan.copy()
        
        # Apply constraint optimization
        for constraint in self.constraints:
            optimized = constraint.apply(optimized)
        
        return optimized
    
    def _validate_feasibility(self, plan: Dict[str, Any]) -> bool:
        """Validate plan feasibility."""
        # Check resource constraints
        resources = plan.get('resources', [])
        if len(resources) > 8:
            logger.warning("Too many resources requested")
            return False
        
        # Check timeline overlaps
        schedule = plan.get('schedule', {})
        if self._has_overlaps(schedule):
            logger.warning("Schedule overlap detected")
            return False
        
        # Check budget constraints
        budget = plan.get('budget', 0)
        if budget > 10000:
            logger.warning("Budget exceeds limit")
            return False
        
        return True
    
    def _has_overlaps(self, schedule: Dict[str, Any]) -> bool:
        """Check for schedule overlaps."""
        # Simple overlap check
        start = schedule.get('start')
        end = schedule.get('end')
        
        if start and end:
            start_dt = datetime.fromisoformat(start)
            end_dt = datetime.fromisoformat(end)
            return start_dt >= end_dt
        
        return False
    
    def _replan(
        self, task: Dict[str, Any], failed_plan: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Re-plan with adjusted parameters."""
        logger.info("Re-planning with adjusted parameters...")
        
        # Reduce resource requirements
        reduced_plan = failed_plan.copy()
        reduced_plan['resources'] = reduced_plan['resources'][:4]
        reduced_plan['duration'] = reduced_plan['duration'] * 2
        
        return reduced_plan
    
    def add_constraint(self, constraint):
        """Add planning constraint."""
        self.constraints.append(constraint)
    
    def estimate_duration(self, task: Dict[str, Any]) -> int:
        """Estimate task duration using historical data."""
        if not self.vector_db:
            return 30  # Default 30 minutes
        
        try:
            context = self._get_historical_context(task)
            # Parse duration from context
            if "Duration=" in context:
                durations = []
                for line in context.split("\n"):
                    if "Duration=" in line:
                        try:
                            duration = int(line.split("Duration=")[1].split("min")[0])
                            durations.append(duration)
                        except:
                            pass
                
                if durations:
                    return sum(durations) // len(durations)
        except Exception as e:
            logger.error(f"Duration estimation failed: {e}")
        
        return 30  # Default fallback
