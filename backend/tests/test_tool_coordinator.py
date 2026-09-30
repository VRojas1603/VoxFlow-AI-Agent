import asyncio
import unittest

from app.services.tool_coordinator import ToolCallCoordinator
from app.services.assemblyai_proxy import (
    END_FEEDBACK_PENDING,
    END_PLAYBACK_PENDING,
    END_TOOL_PENDING,
    finish_end_session,
    finish_tool_reply,
)


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
        self.coordinator.set_client_result(
            "call-1",
            {"status": "success", "applied": True, "tip_type": "lip_trill"},
        )
        self.assertEqual(self.sent, [])

        await self.coordinator.finish_reply()

        self.assertEqual(self.sent, [{
            "type": "tool.result",
            "call_id": "call-1",
            "result": '{"status": "success", "applied": true, "tip_type": "lip_trill"}',
            "is_error": False,
        }])

    async def test_reply_done_flushes_all_pending_calls(self):
        self.coordinator.register("call-2", "select_exercise", {})
        self.coordinator.register("call-3", "adjust_accompaniment", {})
        self.coordinator.set_client_result("call-2", {"status": "success"})
        self.coordinator.set_client_result("call-3", {"status": "success"})

        await self.coordinator.finish_reply()

        self.assertEqual([event["call_id"] for event in self.sent], ["call-2", "call-3"])

    async def test_interruption_discards_pending_calls(self):
        self.coordinator.register("call-4", "adjust_accompaniment", {})

        await self.coordinator.finish_reply(interrupted=True)
        await asyncio.sleep(0)

        self.assertEqual(self.sent, [])

    async def test_timeout_sends_error_after_reply_done(self):
        coordinator = ToolCallCoordinator(self.capture, timeout_seconds=0.01)
        coordinator.register("call-5", "select_exercise", {})

        await asyncio.sleep(0.03)
        await coordinator.finish_reply()

        self.assertEqual(self.sent[0]["type"], "tool.result")
        self.assertEqual(self.sent[0]["call_id"], "call-5")
        self.assertTrue(self.sent[0]["is_error"])
        self.assertIn('"applied": false', self.sent[0]["result"])
        coordinator.cancel_all()

    async def test_cancel_all_prevents_timeout_result(self):
        coordinator = ToolCallCoordinator(self.capture, timeout_seconds=0.01)
        coordinator.register("call-6", "show_vocal_tip", {})
        coordinator.cancel_all()

        await asyncio.sleep(0.03)

        self.assertEqual(self.sent, [])

    async def test_end_session_is_sent_after_final_feedback_playback(self):
        self.coordinator.register("call-7", "end_session", {})
        self.coordinator.set_client_result("call-7", {"status": "success", "applied": True})
        client_events = []

        async def capture_client(event):
            client_events.append(event)

        state = await finish_tool_reply(
            self.coordinator,
            self.capture,
            capture_client,
            end_session_state=END_TOOL_PENDING,
            interrupted=False,
        )

        self.assertEqual(state, END_FEEDBACK_PENDING)
        self.assertEqual([event["type"] for event in self.sent], ["tool.result"])
        self.assertEqual(client_events, [])

        state = await finish_tool_reply(
            self.coordinator,
            self.capture,
            capture_client,
            end_session_state=state,
            interrupted=False,
        )

        self.assertEqual(state, END_PLAYBACK_PENDING)
        self.assertEqual(client_events, [{"type": "proxy.playback_drain_requested"}])

        state = await finish_end_session(
            self.capture,
            end_session_state=state,
        )

        self.assertIsNone(state)
        self.assertEqual([event["type"] for event in self.sent], ["tool.result", "session.end"])

    async def test_interrupted_farewell_does_not_end_session(self):
        self.coordinator.register("call-8", "end_session", {})

        state = await finish_tool_reply(
            self.coordinator,
            self.capture,
            self.capture,
            end_session_state=END_TOOL_PENDING,
            interrupted=True,
        )

        self.assertIsNone(state)
        self.assertEqual(self.sent, [{"type": "proxy.session_end_cancelled"}])

    async def test_playback_confirmation_without_pending_end_is_ignored(self):
        state = await finish_end_session(
            self.capture,
            end_session_state=None,
        )

        self.assertIsNone(state)
        self.assertEqual(self.sent, [])

    async def test_pending_tool_name_is_available_for_result_validation(self):
        self.coordinator.register("call-summary", "end_session", {})

        self.assertEqual(self.coordinator.get_pending_name("call-summary"), "end_session")
        self.assertIsNone(self.coordinator.get_pending_name("missing"))

    async def test_client_error_is_forwarded_to_agent(self):
        self.coordinator.register("call-9", "control_accompaniment", {"action": "play"})
        self.coordinator.set_client_result(
            "call-9",
            {"status": "error", "applied": False, "message": "Audio unavailable"},
            is_error=True,
        )

        await self.coordinator.finish_reply()

        self.assertTrue(self.sent[0]["is_error"])
        self.assertIn("Audio unavailable", self.sent[0]["result"])

    async def test_reply_waits_for_client_execution_result(self):
        self.coordinator.register("call-11", "control_accompaniment", {"action": "stop"})

        finish_task = asyncio.create_task(self.coordinator.finish_reply())
        await asyncio.sleep(0)

        self.assertFalse(finish_task.done())
        self.assertEqual(self.sent, [])

        self.coordinator.set_client_result(
            "call-11",
            {"status": "success", "applied": True, "playback": "stopped"},
        )
        await finish_task

        self.assertEqual(self.sent[0]["call_id"], "call-11")
        self.assertIn('"playback": "stopped"', self.sent[0]["result"])

    async def test_duplicate_call_and_result_are_ignored(self):
        self.assertTrue(self.coordinator.register("call-10", "control_accompaniment", {"action": "play"}))
        self.assertFalse(self.coordinator.register("call-10", "control_accompaniment", {"action": "play"}))
        self.assertTrue(self.coordinator.set_client_result("call-10", {"status": "success"}))
        self.assertFalse(self.coordinator.set_client_result("call-10", {"status": "success"}))

        await self.coordinator.finish_reply()

        self.assertEqual(len(self.sent), 1)


if __name__ == "__main__":
    unittest.main()
