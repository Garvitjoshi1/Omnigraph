import sys
from pathlib import Path
from typing import List, Dict, Any

# Dynamically find the absolute project root by stepping exactly one level up from 'backend'
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.pipeline import EntityNode, RelationshipEdge, KnowledgeGraphExtraction

def normalize_string(text: str) -> str:
    """Standardizes string characters for uniform key token matching."""
    return "".join(c for col in text.lower().split() for c in col if c.isalnum())

def resolve_and_merge_graphs(current_store: Dict[str, List[Any]], incoming_extraction: KnowledgeGraphExtraction) -> Dict[str, List[Any]]:
    """
    Executes Step 3: Graph Cross-Referencing & Disambiguation.
    Compares incoming nodes against the current store, normalizes entity names 
    to prevent duplication, updates risks recursively, and remaps edge references.
    """
    resolution_map: Dict[str, str] = {}
    
    # 1. Processing Node Disambiguation & Merging
    for incoming_node in incoming_extraction.nodes:
        incoming_norm = normalize_string(incoming_node.name)
        matched_master_id = None
        
        for existing_node in current_store["nodes"]:
            existing_norm = normalize_string(existing_node["name"])
            
            if (incoming_norm == existing_norm or 
                (len(incoming_norm) > 4 and incoming_norm in existing_norm) or 
                (len(existing_norm) > 4 and existing_norm in incoming_norm)):
                matched_master_id = existing_node["id"]
                
                if incoming_node.risk_score > existing_node["risk_score"]:
                    existing_node["risk_score"] = incoming_node.risk_score
                
                if incoming_node.evidence and incoming_node.evidence not in existing_node["evidence"]:
                    existing_node["evidence"] += f" | {incoming_node.evidence}"
                break
        
        if matched_master_id:
            resolution_map[incoming_node.id] = matched_master_id
        else:
            current_store["nodes"].append(incoming_node.model_dump())
            resolution_map[incoming_node.id] = incoming_node.id

    # 2. Processing Edge Re-mapping & Graph Invariance Handling
    for incoming_edge in incoming_extraction.edges:
        resolved_source = resolution_map.get(incoming_edge.source, incoming_edge.source)
        resolved_target = resolution_map.get(incoming_edge.target, incoming_edge.target)
        
        if resolved_source == resolved_target:
            continue
            
        duplicate_edge = False
        for existing_edge in current_store["edges"]:
            if (existing_edge["source"] == resolved_source and 
                existing_edge["target"] == resolved_target and 
                existing_edge["relationship"] == incoming_edge.relationship):
                duplicate_edge = True
                break
                
        if not duplicate_edge:
            current_store["edges"].append({
                "source": resolved_source,
                "target": resolved_target,
                "relationship": incoming_edge.relationship
            })
            
    return current_store