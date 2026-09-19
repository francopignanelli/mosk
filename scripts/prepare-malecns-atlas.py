"""Create a small, reproducible annotation atlas from the official MaleCNS table.

Usage: python scripts/prepare-malecns-atlas.py [path/to/source.feather]
Requires pyarrow. No synaptic connectivity or activity is inferred here.
"""

from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
LOCAL_PACKAGES = ROOT / "artifacts/research/python-packages"
if LOCAL_PACKAGES.exists():
    sys.path.insert(0, str(LOCAL_PACKAGES))

import pyarrow.feather as feather

SOURCE_NAME = "body-annotations-male-cns-v1.0-minconf-0.5.feather"
SOURCE_URL = f"https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/{SOURCE_NAME}"
SOURCE_SHA256 = "2177e246113e4cfbf1e7772ec37c6da1955ff22e8063d0b1f833101f99a9a3b2"
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "artifacts/research" / SOURCE_NAME
GROUPS = [
    ("olfactory", "Olfactory sensory neurons", "class", "olfactory"),
    ("alpn", "Antennal-lobe projection neurons", "class", "ALPN"),
    ("kenyon", "Kenyon cells", "class", "Kenyon_Cell"),
    ("dan", "Dopaminergic neurons", "class", "DAN"),
    ("mbon", "Mushroom-body output neurons", "class", "MBON"),
    ("descending", "Descending neurons", "superclass", "descending_neuron"),
    ("gustatory", "Gustatory sensory neurons", "class", "gustatory"),
    ("visual", "Visual projection neurons", "superclass", "visual_projection"),
]
SAMPLE_PER_GROUP = 12


def prepare():
    source_bytes = SOURCE.read_bytes()
    digest = sha256(source_bytes).hexdigest()
    if SOURCE_SHA256 and digest != SOURCE_SHA256:
        raise ValueError("The input does not match the pinned official source checksum.")
    rows = feather.read_table(SOURCE).to_pylist()
    groups = []
    for group_id, label, field, value in GROUPS:
        matches = [row for row in rows if row[field] == value]
        traced = sorted(
            (row for row in matches if row["status"] == "Traced" and row["type"]),
            key=lambda row: row["bodyId"],
        )
        sample = traced[:SAMPLE_PER_GROUP]
        groups.append({
            "id": group_id,
            "label": label,
            "annotationField": field,
            "annotationValue": value,
            "totalMatches": len(matches),
            "eligibleTracedTypedMatches": len(traced),
            "sampledCount": len(sample),
            "cells": [{
                "bodyId": str(row["bodyId"]),
                "type": row["type"],
                "instance": row["instance"],
                "class": row["class"],
                "superclass": row["superclass"],
                "somaSide": row["somaSide"],
                "status": row["status"],
                "statusLabel": row["statusLabel"],
                "flywireType": row["flywireType"],
                "hemibrainType": row["hemibrainType"],
            } for row in sample],
        })
    atlas = {
        "schemaVersion": 1,
        "dataset": "MaleCNS",
        "version": "v1.0",
        "retrievedAt": "2026-09-19",
        "purpose": "Read-only anatomical reference; these cells do not drive MOSK and no neural activity or connectivity is provided.",
        "source": {
            "url": SOURCE_URL,
            "file": SOURCE_NAME,
            "bytes": len(source_bytes),
            "sha256": digest,
            "annotationRows": len(rows),
            "statusCounts": dict(sorted(Counter(row["status"] or "unassigned" for row in rows).items())),
            "projectUrl": "https://male-cns.janelia.org/",
            "downloadUrl": "https://male-cns.janelia.org/download/",
            "paperUrl": "https://doi.org/10.1016/j.cell.2026.08.015",
            "exploreUrl": "https://neuprint.janelia.org/",
            "license": "CC BY 4.0",
            "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
            "attribution": "MaleCNS v1.0: FlyEM / HHMI Janelia Research Campus, University of Cambridge, MRC Laboratory of Molecular Biology, and Google Research; Berg et al. (2026).",
        },
        "selection": {
            "perGroupLimit": SAMPLE_PER_GROUP,
            "rule": "For each listed exact source annotation, count all matching rows; retain status=Traced rows with a nonempty type, sort by numeric bodyId ascending, and take the first 12. This is a deterministic teaching sample, not a representative or complete circuit.",
            "transformations": "Select listed fields; convert bodyId to a decimal string; preserve nulls and original annotation labels; add readable group headings and exact counts. No activity, synapses, transmitter probabilities, functional valence, or learned memories are inferred.",
            "preparationScript": "scripts/prepare-malecns-atlas.py",
        },
        "sampledRows": sum(group["sampledCount"] for group in groups),
        "groups": groups,
    }
    destination = ROOT / "public/data/malecns-v1.0-atlas.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(atlas, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(destination), "sha256": digest, "sourceRows": len(rows), "sampledRows": atlas["sampledRows"], "bytes": destination.stat().st_size, "groups": [{"id": group["id"], "total": group["totalMatches"], "tracedTyped": group["eligibleTracedTypedMatches"]} for group in groups]}, indent=2))


if __name__ == "__main__":
    prepare()
