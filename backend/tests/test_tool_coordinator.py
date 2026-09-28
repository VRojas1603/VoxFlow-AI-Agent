import asyncio
import unittest

from app.services.tool_coordinator import ToolCallCoordinator


class ToolCallCoordinatorTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.sent = []

        async def capture(event):
            self.sent.append(event)

        self.capture = capture
        self.coordinator = ToolCallCoordinator(capture, timeout_seconds=1)

    async def asyncTearDown(self):
        self.coordinator.cancel_all()
        await asyncio.sleep(0)

    async def test_reply_done_sends_exact_tool_result(self):
        self.coordinator.register("call-1", "show_vocal_tip", {"tip_type": "lip_trill"})
        self.assertEqual(self.sent, [])

        await self.coordinator.finish_reply()

        self.assertEqual(self.sent, [{
            "type": "tool.result",
            "call_id": "call-1",
            "result": '{"status": "success", "applied": true}',
            "is_error": False,
        }])

    async def test_reply_done_flushes_all_pending_calls(self):
        self.coordinator.register("call-2", "select_exercise", {})
        self.coordinator.register("call-3", "adjust_music_playback", {})

        await self.coordinator.finish_reply()

        self.assertEqual([event["call_id"] for event in self.sent], ["call-2", "call-3"])

    async def test_interruption_discards_pending_calls(self):
        self.coordinator.register("call-4", "adjust_music_playback", {})

        await self.coordinator.finish_reply(interrupted=True)
        await asyncio.sleep(0)

        self.assertEqual(self.sent, [])

    async def test_safety_timeout_sends_result_without_reply_done(self):
        coordinator = ToolCallCoordinator(self.capture, timeout_seconds=0.01)
        coordinator.register("call-5", "select_exercise", {})

        await asyncio.sleep(0.03)

        self.assertEqual(self.sent[0]["type"], "tool.result")
        self.assertEqual(self.sent[0]["call_id"], "call-5")
        coordinator.cancel_all()

    async def test_cancel_all_prevents_timeout_result(self):
        coordinator = ToolCallCoordinator(self.capture, timeout_seconds=0.01)
        coordinator.register("call-6", "show_vocal_tip", {})
        coordinator.cancel_all()

        await asyncio.sleep(0.03)

        self.assertEqual(self.sent, [])


if __name__ == "__main__":
    unittest.main()
