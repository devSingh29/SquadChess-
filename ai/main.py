import os

import chess
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException

from .models import MoveRequest, MoveResponse, OpenRouterConfig
from .opponent import pick_material as opponent_material, pick_random as opponent_random, pick_llm as opponent_llm
from .teammate import pick_llm as teammate_llm

load_dotenv()

app = FastAPI()

OPENROUTER_CONFIG = OpenRouterConfig(
    api_key=os.getenv("OPENROUTER_API_KEY"),
    model=os.getenv("OPENROUTER_MODEL"),
)


async def pick_move_for_teammate(board: chess.Board, payload: MoveRequest) -> str:
    return (await teammate_llm(board, payload.legal_moves, payload.seat, OPENROUTER_CONFIG)).uci


async def pick_move_for_opponent(board: chess.Board, payload: MoveRequest) -> str:
    if payload.tier == "easy":
        return opponent_random(payload.legal_moves).uci
    if payload.tier == "medium":
        return opponent_material(board, payload.legal_moves, payload.seat).uci
    if payload.tier == "hard":
        return (await opponent_llm(board, payload.legal_moves, payload.seat, OPENROUTER_CONFIG)).uci
    return opponent_random(payload.legal_moves).uci


@app.post("/move", response_model=MoveResponse)
async def move_endpoint(payload: MoveRequest):
    if not payload.legal_moves:
        raise HTTPException(status_code=400, detail="No legal moves provided.")

    board = chess.Board(payload.fen)

    if payload.seat == "W2":
        choice = await pick_move_for_teammate(board, payload)
    else:
        choice = await pick_move_for_opponent(board, payload)

    return MoveResponse(uci=choice)
