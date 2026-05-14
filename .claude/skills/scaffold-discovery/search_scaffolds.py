"""Skill-side scaffold search.

Runs inside the cloned target repo (workspace). Cannot import from the deck-app
codebase — this script is copied into `~/.claude/skills/scaffold-discovery/` by
`ensure_skills_installed` and invoked via Bash from the ENGINEER subagent.

Output contract:
    A single JSON object on stdout, even on failure:
        {
            "query": "<the input query>",
            "results": [<ScaffoldMetadata>, ...],
            "errors":  [{"code": "...", "message": "..."}, ...]
        }

Exit codes:
    0  success (results may be empty; check `errors`)
    2  invalid input
    3  configuration error (missing env vars)
    4  upstream error (OpenAI / Qdrant unreachable or rejected the request)
"""

import argparse
import json
import os
import sys
from typing import Any, Optional

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, Field
from qdrant_client import QdrantClient
from qdrant_client.models import FieldCondition, Filter, MatchValue

load_dotenv()


# MIRROR: keep field set and types in sync with the deck-app's
# scaffolds/registry.py:ScaffoldMetadata. The skill executes inside the
# target repo's cwd and cannot import from the deck-app package.
class ScaffoldMetadata(BaseModel):
    id: str = Field(default="", description="Unique identifier of the scaffold")
    slug: str = Field(description="Name Identifier of the scaffold (Unique Identifier Name)")
    name: str = Field(default="", description="Display name of the scaffold")
    description: str = Field(default="", description="Short description of the scaffold")
    is_active: bool = Field(default=True)
    created_at: Optional[str] = Field(default=None)
    updated_at: Optional[str] = Field(default=None)
    score: Optional[float] = Field(default=None, description="Similarity score, only populated during semantic search")


def _emit(envelope: dict[str, Any], exit_code: int) -> None:
    print(json.dumps(envelope, default=str))
    sys.exit(exit_code)


def search_scaffolds(query: str, limit: int = 10) -> None:
    envelope: dict[str, Any] = {"query": query, "results": [], "errors": []}

    if not query or not query.strip():
        envelope["errors"].append({"code": "invalid_input", "message": "query must be non-empty"})
        _emit(envelope, 2)

    openai_api_key = os.getenv("OPENAI_API_KEY")
    qdrant_url = os.getenv("QDRANT_URL")
    qdrant_name = os.getenv("QDRANT_NAME", "qb_scaffolds")
    embedding_model = os.getenv("SCAFFOLD_EMBEDDING_MODEL", "text-embedding-3-small")

    if not openai_api_key:
        envelope["errors"].append({"code": "config_error", "message": "OPENAI_API_KEY is not set"})
        _emit(envelope, 3)
    if not qdrant_url:
        envelope["errors"].append({"code": "config_error", "message": "QDRANT_URL is not set"})
        _emit(envelope, 3)

    try:
        openai_client = OpenAI(api_key=openai_api_key)
        qdrant_client = QdrantClient(url=qdrant_url)

        try:
            resp = openai_client.embeddings.create(model=embedding_model, input=query)
        except Exception as e:
            envelope["errors"].append({"code": "openai_error", "message": f"embedding request failed: {e}"})
            _emit(envelope, 4)
        vector = resp.data[0].embedding

        query_filter = Filter(must=[FieldCondition(key="is_active", match=MatchValue(value=True))])

        try:
            points = qdrant_client.query_points(
                collection_name=qdrant_name,
                query=vector,
                limit=limit,
                query_filter=query_filter,
            ).points
        except Exception as e:
            envelope["errors"].append({"code": "qdrant_error", "message": f"query_points failed: {e}"})
            _emit(envelope, 4)

        for pt in points:
            payload = pt.payload or {}
            payload["id"] = pt.id if hasattr(pt, "id") else payload.get("id")
            if hasattr(pt, "score"):
                payload["score"] = pt.score

            try:
                metadata = ScaffoldMetadata(**payload)
                envelope["results"].append(metadata.model_dump())
            except Exception as e:
                envelope["errors"].append({"code": "parse_error", "message": f"could not parse scaffold {pt.id}: {e}"})

        _emit(envelope, 0)

    except Exception as e:
        envelope["errors"].append({"code": "unexpected_error", "message": str(e)})
        _emit(envelope, 4)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Search for scaffolds in Qdrant registry.")
    parser.add_argument("query", type=str, help="The semantic search query.")
    parser.add_argument("--limit", type=int, default=10, help="Max number of results.")
    args = parser.parse_args()

    search_scaffolds(args.query, args.limit)
