"""Audit logging for Project OMNI."""

import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


class AuditLogger:
    """
    Audit logging for AI decisions.
    
    Features:
    - Decision tracking
    - Confidence logging
    - Input/output recording
    - Query capabilities
    """
    
    def __init__(self, mongodb_client=None):
        """
        Initialize audit logger.
        
        Args:
            mongodb_client: MongoDB client for storage
        """
        self.mongodb_client = mongodb_client
        self.collection = None
        
        if mongodb_client:
            try:
                db = mongodb_client['audit_logs']
                self.collection = db['agent_decisions']
                logger.info("Audit logger connected to MongoDB")
            except Exception as e:
                logger.error(f"Failed to connect to MongoDB: {e}")
        
        # Fallback to in-memory storage
        self.memory_logs: List[Dict[str, Any]] = []
    
    def log_decision(
        self,
        agent: str,
        action: str,
        input_data: Dict[str, Any],
        output_data: Dict[str, Any],
        confidence: float,
        prompt: Optional[str] = None
    ):
        """
        Log agent decision.
        
        Args:
            agent: Agent name
            action: Action performed
            input_data: Input data
            output_data: Output data
            confidence: Confidence score (0-1)
            prompt: LLM prompt used
        """
        log_entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'agent': agent,
            'action': action,
            'input': self._sanitize(input_data),
            'output': self._sanitize(output_data),
            'confidence': confidence,
            'prompt': prompt,
            'metadata': {
                'version': '1.0',
                'environment': os.environ.get('ENVIRONMENT', 'dev')
            }
        }
        
        # Store in MongoDB if available
        if self.collection:
            try:
                self.collection.insert_one(log_entry)
                logger.debug(f"Audit log stored: {agent} - {action}")
            except Exception as e:
                logger.error(f"Failed to store audit log: {e}")
                self.memory_logs.append(log_entry)
        else:
            # Store in memory
            self.memory_logs.append(log_entry)
            logger.debug(f"Audit log (memory): {agent} - {action}")
    
    def _sanitize(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize data for logging."""
        sanitized = {}
        for key, value in data.items():
            if isinstance(value, (str, int, float, bool)):
                sanitized[key] = value
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize(value)
            elif isinstance(value, list):
                sanitized[key] = [
                    self._sanitize(item) if isinstance(item, dict) else item
                    for item in value[:10]  # Limit list size
                ]
        return sanitized
    
    def query_logs(
        self,
        agent: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        min_confidence: Optional[float] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Query audit logs.
        
        Args:
            agent: Filter by agent name
            start_date: Filter by start date
            end_date: Filter by end date
            min_confidence: Filter by minimum confidence
            limit: Maximum results
            
        Returns:
            List of matching log entries
        """
        if self.collection:
            return self._query_mongodb(
                agent, start_date, end_date, min_confidence, limit
            )
        else:
            return self._query_memory(
                agent, start_date, end_date, min_confidence, limit
            )
    
    def _query_mongodb(
        self,
        agent: Optional[str],
        start_date: Optional[datetime],
        end_date: Optional[datetime],
        min_confidence: Optional[float],
        limit: int
    ) -> List[Dict[str, Any]]:
        """Query MongoDB for audit logs."""
        query = {}
        
        if agent:
            query['agent'] = agent
        if start_date or end_date:
            query['timestamp'] = {}
            if start_date:
                query['timestamp']['$gte'] = start_date.isoformat()
            if end_date:
                query['timestamp']['$lte'] = end_date.isoformat()
        if min_confidence:
            query['confidence'] = {'$gte': min_confidence}
        
        try:
            cursor = self.collection.find(query).limit(limit)
            return list(cursor)
        except Exception as e:
            logger.error(f"MongoDB query failed: {e}")
            return []
    
    def _query_memory(
        self,
        agent: Optional[str],
        start_date: Optional[datetime],
        end_date: Optional[datetime],
        min_confidence: Optional[float],
        limit: int
    ) -> List[Dict[str, Any]]:
        """Query in-memory logs."""
        results = []
        
        for log in self.memory_logs:
            # Filter by agent
            if agent and log.get('agent') != agent:
                continue
            
            # Filter by date
            log_time = datetime.fromisoformat(log['timestamp'])
            if start_date and log_time < start_date:
                continue
            if end_date and log_time > end_date:
                continue
            
            # Filter by confidence
            if min_confidence and log.get('confidence', 0) < min_confidence:
                continue
            
            results.append(log)
            
            if len(results) >= limit:
                break
        
        return results
    
    def get_stats(self) -> Dict[str, Any]:
        """Get audit log statistics."""
        if self.collection:
            try:
                total = self.collection.count_documents({})
                agents = self.collection.distinct('agent')
                return {
                    'total_logs': total,
                    'agents': agents,
                    'storage': 'mongodb'
                }
            except:
                pass
        
        return {
            'total_logs': len(self.memory_logs),
            'agents': list(set(log.get('agent') for log in self.memory_logs)),
            'storage': 'memory'
        }
