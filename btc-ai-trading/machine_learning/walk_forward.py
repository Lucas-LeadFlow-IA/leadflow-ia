"""Walk-forward splitting with purging (no training on the evaluation period).

Expanding window: fold k trains on everything before its test block and
tests on the next block. Training samples whose label window (index +
horizon) reaches into the test block are purged, and an embargo gap is
left after the train set — this prevents the classic leakage where
overlapping forward-looking labels share information across the split.
"""
from __future__ import annotations

from collections.abc import Iterator

import numpy as np


def walk_forward_splits(positions: np.ndarray, n_folds: int = 5, min_train_frac: float = 0.4,
                        horizon: int = 0, embargo: int = 0) -> Iterator[tuple[np.ndarray, np.ndarray]]:
    """positions: sorted time positions (bar index) of each sample.

    Yields (train_idx, test_idx) arrays of sample indices. Guarantees
    max(positions[train] + horizon) < min(positions[test]) - embargo.
    """
    positions = np.asarray(positions)
    n = len(positions)
    if n < 10 or n_folds < 1:
        return
    if np.any(np.diff(positions) < 0):
        raise ValueError("positions must be sorted chronologically")
    first_test = int(n * min_train_frac)
    edges = np.linspace(first_test, n, n_folds + 1).astype(int)
    for a, b in zip(edges[:-1], edges[1:]):
        if b <= a:
            continue
        test_idx = np.arange(a, b)
        test_start_pos = positions[a]
        train_mask = positions[:a] + horizon < test_start_pos - embargo
        train_idx = np.arange(a)[train_mask]
        if len(train_idx) == 0:
            continue
        yield train_idx, test_idx
