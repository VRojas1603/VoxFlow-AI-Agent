import unittest

from app.core.prompt import VOICE_TOOLS
from app.services.assemblyai_proxy import handle_agent_proxy


class ProxyConfigurationTests(unittest.TestCase):
    def test_proxy_module_imports(self):
        self.assertTrue(callable(handle_agent_proxy))

    def test_every_tool_has_response_instructions(self):
        self.assertTrue(VOICE_TOOLS)
        for tool in VOICE_TOOLS:
            self.assertTrue(tool.get("response_instructions"), tool["name"])


if __name__ == "__main__":
    unittest.main()
