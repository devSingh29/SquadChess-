import random
from typing import List

import chess
import httpx

from .models import MoveOption, OpenRouterConfig


def pick_random(legal_moves: List[MoveOption]) -> MoveOption:
    return random.choice(legal_moves)


async def pick_llm(
    board: chess.Board,
    legal_moves: List[MoveOption],
    seat: str,
    config: OpenRouterConfig,
) -> MoveOption:
    if not config.api_key or not config.model:
        return pick_random(legal_moves)

    prompt = "\n".join(
        [
            "You are the teammate AI in a 2v2 chess game.",
            f"Your seat is {seat}.",
            f"Current FEN: {board.fen()}",
            "Choose the best supportive move for your team.",
            "Reply with exactly one UCI move from this list:",
            ", ".join(move.uci for move in legal_moves),
        ]
    )

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {config.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": config.model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
            },
        )

    if response.status_code >= 400:
        return pick_random(legal_moves)

    data = response.json()
    content = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
    choice = content.strip().split()[0] if content else ""

    match = next((move for move in legal_moves if move.uci == choice), None)
    return match if match else pick_random(legal_moves)
