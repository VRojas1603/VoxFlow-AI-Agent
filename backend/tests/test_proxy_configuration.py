import unittest

from app.core.prompt import GREETINGS, VOICE_LANGUAGES, VOICE_TOOLS, get_session_update_payload
from app.services.assemblyai_proxy import handle_agent_proxy, resolve_voice_config


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

    def test_supported_voice_catalog_matches_expected_languages(self):
        self.assertEqual(VOICE_LANGUAGES["lola"], "es")
        self.assertEqual(len(VOICE_LANGUAGES), 12)
        self.assertTrue(all(
            language == "en"
            for voice, language in VOICE_LANGUAGES.items()
            if voice != "lola"
        ))

    def test_spanish_voice_builds_a_spanish_initial_session(self):
        session = get_session_update_payload(voice="lola", language="es")["session"]

        self.assertEqual(session["output"]["voice"], "lola")
        self.assertEqual(session["greeting"], GREETINGS["es"])
        self.assertIn("default language is Spanish", session["system_prompt"])

        with self.assertRaises(ValueError):
            get_session_update_payload(voice="lola", language="en")

    def test_language_tool_does_not_offer_voice_changes(self):
        language_tool = next(tool for tool in VOICE_TOOLS if tool["name"] == "switch_language")

        self.assertEqual(language_tool["parameters"]["required"], ["language"])
        self.assertNotIn("voice", language_tool["parameters"]["properties"])

    def test_proxy_validates_voice_and_derives_language(self):
        self.assertEqual(resolve_voice_config("LOLA"), ("lola", "es"))
        self.assertEqual(resolve_voice_config("unknown"), ("eve", "en"))


if __name__ == "__main__":
    unittest.main()
