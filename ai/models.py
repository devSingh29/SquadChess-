from pydantic import BaseModel


class MoveOption(BaseModel):
    uci: str
    san: str


class MoveRequest(BaseModel):
    fen: str
    seat: str
    tier: str
    legal_moves: list[MoveOption]


class MoveResponse(BaseModel):
    uci: str


class OpenRouterConfig(BaseModel):
    api_key: str | None
    model: str | None
