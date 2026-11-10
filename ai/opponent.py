import random
from typing import List

import chess
import httpx

from .models import MoveOption, OpenRouterConfig


def evaluate_material(board: chess.Board) -> int:
    values = {
        chess.PAWN: 1,
        chess.KNIGHT: 3,
        chess.BISHOP: 3,
        chess.ROOK: 5,
        chess.QUEEN: 9,
        chess.KING: 0,
    }
    score = 0
    for piece_type, value in values.items():
        score += len(board.pieces(piece_type, chess.WHITE)) * value
        score -= len(board.pieces(piece_type, chess.BLACK)) * value
    return score


def pick_random(legal_moves: List[MoveOption]) -> MoveOption:
    return random.choice(legal_moves)


def pick_material(board: chess.Board, legal_moves: List[MoveOption], seat: str) -> MoveOption:
    is_white = seat.startswith("W")
    best_score = -10_000 if is_white else 10_000
    best_moves = []

    for move_option in legal_moves:
        candidate = chess.Move.from_uci(move_option.uci)
        if candidate not in board.legal_moves:
            continue
        clone = board.copy()
        clone.push(candidate)
        score = evaluate_material(clone)
        is_better = score > best_score if is_white else score < best_score
        if is_better:
            best_score = score
            best_moves = [move_option]
        elif score == best_score:
            best_moves.append(move_option)

    return random.choice(best_moves) if best_moves else pick_random(legal_moves)


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
            "You are a chess engine playing as the opposing team.",
            f"Your seat is {seat}.",
            f"Current FEN: {board.fen()}",
            "Choose the best legal move for your side.",
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
