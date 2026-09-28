import unittest

from app.core.prompt import VOICE_TOOLS, get_session_update_payload
from app.services.assemblyai_proxy import handle_agent_proxy


class ProxyConfigurationTests(unittest.TestCase):
    def test_proxy_module_imports(self):
        self.assertTrue(callable(handle_agent_proxy))

    def test_every_tool_has_response_instructions(self):
        self.assertTrue(VOICE_TOOLS)
        for tool in VOICE_TOOLS:
            self.assertTrue(tool.get("response_instructions"), tool["name"])

    def test_session_uses_low_latency_transcription(self):
        session = get_session_update_payload()["session"]

        self.assertEqual(session["input"]["transcription_mode"], "min_latency")
        self.assertNotIn("language_codes", session["input"])
        self.assertNotIn("turn_detection", session["input"])


if __name__ == "__main__":
    unittest.main()
