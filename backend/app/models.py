from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=8000)]
Criterion = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]
ModelID = Annotated[str, StringConstraints(pattern=r'^[a-zA-Z0-9_-]{1,64}$')]


class EvaluationRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    engine: Literal['native', 'inspect'] = 'native'
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    models: list[ModelID] = Field(min_length=2, max_length=8)
    criteria: list[Criterion] = Field(min_length=1, max_length=12)
    scenarios: list[Text] = Field(min_length=1, max_length=200)
    max_runtime_seconds: int = Field(default=3600, ge=300, le=14400)
    response_tokens: int = Field(default=1024, ge=128, le=4096)
    seed: int = Field(default=42, ge=0, le=2**31-1)

    @model_validator(mode='after')
    def unique_inputs(self):
        for key in ('models', 'scenarios', 'criteria'):
            values = getattr(self, key)
            if len(values) != len(set(values)):
                raise ValueError(f'{key} must be unique')
        if sum(map(len, self.scenarios)) > 400_000:
            raise ValueError('Total scenario text exceeds 400,000 characters')
        return self


class WorkerUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    stage: Annotated[str, StringConstraints(pattern=r'^(starting|collecting|analyzing|uploading)$')]


class WorkerFinish(BaseModel):
    model_config = ConfigDict(extra='forbid')
    success: bool
    # Generic codes, never provider errors or traces that could contain credentials.
    error_code: Annotated[str, StringConstraints(pattern=r'^[a-z_]{1,64}$')] | None = None
