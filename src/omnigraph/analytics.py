"""CPU-friendly GNN risk scoring over Neo4j-derived supply-chain topology."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import torch
from torch import Tensor, nn


@dataclass(frozen=True)
class GraphTensorData:
    """Minimal graph representation that avoids a heavy graph-learning dependency."""

    node_ids: list[str]
    features: Tensor
    edge_index: Tensor  # shape [2, edge_count], with source then destination indices
    labels: Tensor | None = None


class MeanMessageLayer(nn.Module):
    """One lightweight directed message-passing layer implemented in plain PyTorch."""

    def __init__(self, in_features: int, out_features: int) -> None:
        super().__init__()
        self.linear = nn.Linear(in_features * 2, out_features)

    def forward(self, features: Tensor, edge_index: Tensor) -> Tensor:
        source, destination = edge_index
        aggregate = torch.zeros_like(features)
        aggregate.index_add_(0, destination, features[source])
        degree = torch.zeros(features.size(0), device=features.device)
        degree.index_add_(0, destination, torch.ones_like(destination, dtype=torch.float))
        return torch.relu(self.linear(torch.cat([features, aggregate / degree.clamp(min=1).unsqueeze(1)], dim=1)))


class SupplyRiskGNN(nn.Module):
    """Two-hop model: sufficient for demoable upstream/downstream risk propagation."""

    def __init__(self, feature_count: int, hidden_size: int = 16) -> None:
        super().__init__()
        # CODEX_DECISION: A two-layer mean aggregator is more explainable and
        # CPU-friendly than adding PyTorch Geometric for a hackathon prototype.
        self.message_one = MeanMessageLayer(feature_count, hidden_size)
        self.message_two = MeanMessageLayer(hidden_size, hidden_size)
        self.classifier = nn.Linear(hidden_size, 1)

    def forward(self, features: Tensor, edge_index: Tensor) -> Tensor:
        hidden = self.message_one(features, edge_index)
        hidden = self.message_two(hidden, edge_index)
        return self.classifier(hidden).squeeze(1)


def train_risk_model(data: GraphTensorData, epochs: int = 120, learning_rate: float = 0.02) -> SupplyRiskGNN:
    """Train deterministic full-graph binary risk scoring on local CPU."""
    if data.labels is None:
        raise ValueError("Risk labels are required for supervised training.")
    torch.manual_seed(7)
    model = SupplyRiskGNN(data.features.size(1))
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)
    loss_fn = nn.BCEWithLogitsLoss()
    model.train()
    for _ in range(epochs):
        optimizer.zero_grad()
        loss_fn(model(data.features, data.edge_index), data.labels.float()).backward()
        optimizer.step()
    return model


@torch.no_grad()
def predict_high_risk_nodes(model: SupplyRiskGNN, data: GraphTensorData, threshold: float = 0.5) -> list[dict[str, Any]]:
    """Return scores sorted so a UI can foreground the riskiest supply-chain steps."""
    model.eval()
    probabilities = torch.sigmoid(model(data.features, data.edge_index)).tolist()
    return sorted(
        [{"node_id": node_id, "risk_score": round(score, 4), "high_risk": score >= threshold} for node_id, score in zip(data.node_ids, probabilities)],
        key=lambda row: row["risk_score"], reverse=True,
    )
