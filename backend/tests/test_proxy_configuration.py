import unittest

from app.core.prompt import GREETINGS, VOICE_LANGUAGES, VOICE_TOOLS, get_session_update_payload
from app.services.assemblyai_proxy import handle_agent_proxy, resolve_voice_config


class ProxyConfigurationTests(unittest.TestCase):
    def test_proxy_module_imports(self):
        self.assertTrue(callable(handle_agent_proxy))

    def test_every_tool_has_valid_response_instructions(self):
        self.assertTrue(VOICE_TOOLS)
        for tool in VOICE_TOOLS:
            instructions = tool.get("response_instructions")

            self.assertIsInstance(instructions, dict, tool["name"])
            self.assertEqual(set(instructions), {"success", "error"}, tool["name"])
            self.assertTrue(instructions["success"].strip(), tool["name"])
            self.assertTrue(instructions["error"].strip(), tool["name"])

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

    def test_end_session_tool_has_no_arguments(self):
        end_tool = next(tool for tool in VOICE_TOOLS if tool["name"] == "end_session")

        self.assertEqual(end_tool["parameters"]["properties"], {})
        self.assertEqual(end_tool["parameters"]["required"], [])
        self.assertEqual(end_tool["execution_mode"], "hold")
        self.assertIn("final measured coaching feedback", get_session_update_payload()["session"]["system_prompt"])
        self.assertIn("Use only performance_summary", end_tool["response_instructions"]["success"])

    def test_accompaniment_control_supports_play_and_stop(self):
        tool = next(tool for tool in VOICE_TOOLS if tool["name"] == "control_accompaniment")

        self.assertEqual(tool["parameters"]["required"], ["action"])
        self.assertEqual(
            tool["parameters"]["properties"]["action"]["enum"],
            ["play", "stop"],
        )
        self.assertIn("three-second visual countdown", tool["description"])
        self.assertIn("finish within three seconds", tool["response_instructions"]["success"])

    def test_notes_practice_has_dedicated_controls_and_tool_enums(self):
        tools = {tool["name"]: tool for tool in VOICE_TOOLS}
        notes_tool = tools["control_notes_practice"]
        selection_tool = tools["select_exercise"]
        tip_tool = tools["show_vocal_tip"]

        self.assertEqual(
            notes_tool["parameters"]["properties"]["action"]["enum"],
            ["start", "stop"],
        )
        self.assertIn(
            "notes_practice",
            selection_tool["parameters"]["properties"]["exercise_id"]["enum"],
        )
        self.assertIn(
            "notes_practice",
            tip_tool["parameters"]["properties"]["tip_type"]["enum"],
        )
        self.assertIn("no accompaniment", notes_tool["description"].lower())

    def test_accompaniment_adjustment_distinguishes_relative_and_absolute_changes(self):
        tool = next(tool for tool in VOICE_TOOLS if tool["name"] == "adjust_accompaniment")
        properties = tool["parameters"]["properties"]
        prompt = get_session_update_payload()["session"]["system_prompt"]

        self.assertEqual(tool["parameters"]["required"], ["control", "operation"])
        self.assertEqual(properties["control"]["enum"], ["pitch", "speed", "volume"])
        self.assertEqual(properties["operation"]["enum"], ["increase", "decrease", "set"])
        self.assertNotIn("adjust_music_playback", {tool["name"] for tool in VOICE_TOOLS})
        self.assertIn("increase the volume a little bit", prompt)
        self.assertIn("louder, quieter, softer", tool["description"])

    def test_tip_guidance_requires_an_explicit_request(self):
        session = get_session_update_payload()["session"]
        prompt = session["system_prompt"]
        tip_tool = next(tool for tool in VOICE_TOOLS if tool["name"] == "show_vocal_tip")

        self.assertIn("Explicit visual guidance only", prompt)
        self.assertIn("Do NOT invoke 'show_vocal_tip' merely because an exercise was selected", prompt)
        self.assertIn("how can I do this properly?", prompt)
        self.assertIn("exercise selection alone", tip_tool["description"])

    def test_isolated_practice_sounds_do_not_trigger_agent_feedback(self):
        prompt = get_session_update_payload()["session"]["system_prompt"]

        self.assertIn("lip trill vibrations", prompt)
        self.assertIn("Do not reply to these isolated practice sounds", prompt)
        self.assertIn("provides their results at session end", prompt)

    def test_exercise_selection_stops_playback_without_automatic_tip(self):
        tool = next(tool for tool in VOICE_TOOLS if tool["name"] == "select_exercise")

        self.assertIn("stops the current accompaniment", tool["description"])
        self.assertIn("Do not show a new tip", tool["description"])
        self.assertIn("Do not mention playback unless", tool["response_instructions"]["success"])

    def test_proxy_validates_voice_and_derives_language(self):
        self.assertEqual(resolve_voice_config("LOLA"), ("lola", "es"))
        self.assertEqual(resolve_voice_config("unknown"), ("eve", "en"))


if __name__ == "__main__":
    unittest.main()
