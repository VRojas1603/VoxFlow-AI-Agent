import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Optional


SendEvent = Callable[[dict], Awaitable[None]]


@dataclass
class PendingToolCall:
    name: str
    arguments: Any
    result: Any = None
    is_error: bool = False
    result_ready: asyncio.Event = field(default_factory=asyncio.Event)
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

    def register(self, call_id: str, name: str, arguments: Any) -> bool:
        if call_id in self._pending:
            self._logger.warning("Ignoring duplicate tool.call [id=%s]", call_id)
            return False

        pending = PendingToolCall(name=name, arguments=arguments)
        pending.timeout_task = asyncio.create_task(self._timeout(call_id))
        self._pending[call_id] = pending
        self._logger.info("Queued tool.call [tool=%s, id=%s]", name, call_id)
        return True

    def set_client_result(
        self,
        call_id: str,
        result: Any,
        *,
        is_error: bool = False,
    ) -> bool:
        pending = self._pending.get(call_id)
        if pending is None:
            self._logger.warning("Ignoring result for unknown tool call [id=%s]", call_id)
            return False
        if pending.result_ready.is_set():
            self._logger.warning("Ignoring duplicate tool result [id=%s]", call_id)
            return False

        pending.result = result
        pending.is_error = is_error
        pending.result_ready.set()
        self._logger.info("Received client tool result [tool=%s, id=%s]", pending.name, call_id)
        return True

    def get_pending_name(self, call_id: str) -> str | None:
        pending = self._pending.get(call_id)
        return pending.name if pending else None

    async def finish_reply(self, *, interrupted: bool = False) -> None:
        if interrupted:
            self._logger.info(
                "Discarding %s pending tool call(s) after interruption",
                len(self._pending),
            )
            self.cancel_all()
            return

        await asyncio.gather(*(
            self._send_result(call_id)
            for call_id in list(self._pending)
        ))

    async def _timeout(self, call_id: str) -> None:
        try:
            await asyncio.sleep(self._timeout_seconds)
        except asyncio.CancelledError:
            return

        pending = self._pending.get(call_id)
        if pending is None or pending.result_ready.is_set():
            return

        self._logger.warning(
            "Client tool execution timed out [id=%s]",
            call_id,
        )
        pending.result = {
            "status": "error",
            "applied": False,
            "message": "The browser did not confirm that the action was applied.",
        }
        pending.is_error = True
        pending.result_ready.set()

    async def _send_result(self, call_id: str) -> None:
        async with self._lock:
            pending = self._pending.get(call_id)
            if pending is None:
                return

            await pending.result_ready.wait()

            await self._send_event({
                "type": "tool.result",
                "call_id": call_id,
                "result": json.dumps(pending.result),
                "is_error": pending.is_error,
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
