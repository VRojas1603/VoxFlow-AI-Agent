import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Optional


SendEvent = Callable[[dict], Awaitable[None]]


@dataclass
class PendingToolCall:
    name: str
    arguments: Any
    timeout_task: Optional[asyncio.Task] = None


class ToolCallCoordinator:
    """Queues tool calls until AssemblyAI finishes the reply that requested them."""

    def __init__(
        self,
        send_event: SendEvent,
        *,
        timeout_seconds: float = 5.0,
        logger: Optional[logging.Logger] = None,
    ) -> None:
        self._send_event = send_event
        self._timeout_seconds = timeout_seconds
        self._logger = logger or logging.getLogger(__name__)
        self._pending: dict[str, PendingToolCall] = {}
        self._lock = asyncio.Lock()

    def register(self, call_id: str, name: str, arguments: Any) -> None:
        previous = self._pending.pop(call_id, None)
        if previous and previous.timeout_task:
            previous.timeout_task.cancel()

        pending = PendingToolCall(name=name, arguments=arguments)
        pending.timeout_task = asyncio.create_task(self._timeout(call_id))
        self._pending[call_id] = pending
        self._logger.info("Queued tool.call [tool=%s, id=%s]", name, call_id)

    async def finish_reply(self, *, interrupted: bool = False) -> None:
        if interrupted:
            self._logger.info(
                "Discarding %s pending tool call(s) after interruption",
                len(self._pending),
            )
            self.cancel_all()
            return

        for call_id in list(self._pending):
            await self._send_result(call_id)

    async def _timeout(self, call_id: str) -> None:
        try:
            await asyncio.sleep(self._timeout_seconds)
        except asyncio.CancelledError:
            return

        if call_id not in self._pending:
            return

        self._logger.warning(
            "Sending tool.result through safety timeout [id=%s]",
            call_id,
        )
        await self._send_result(call_id)

    async def _send_result(self, call_id: str) -> None:
        async with self._lock:
            pending = self._pending.get(call_id)
            if pending is None:
                return

            await self._send_event({
                "type": "tool.result",
                "call_id": call_id,
                "result": json.dumps({"status": "success", "applied": True}),
                "is_error": False,
            })

            self._pending.pop(call_id, None)
            current_task = asyncio.current_task()
            if pending.timeout_task and pending.timeout_task is not current_task:
                pending.timeout_task.cancel()
            self._logger.info("Sent tool.result [tool=%s, id=%s]", pending.name, call_id)

    def cancel_all(self) -> None:
        for pending in self._pending.values():
            if pending.timeout_task:
                pending.timeout_task.cancel()
        self._pending.clear()
