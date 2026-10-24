from datetime import datetime
from pydantic import AwareDatetime, BaseModel, Field, StrictBool


class PirUsbReading(BaseModel):
    received_at: AwareDatetime
    motion: StrictBool


class PirUsbBatch(BaseModel):
    readings: list[PirUsbReading] = Field(min_length=1, max_length=50)


class PirUsbRecord(BaseModel):
    id: int
    received_at: datetime
    motion: bool


class PirUsbSaveResult(BaseModel):
    saved_count: int
