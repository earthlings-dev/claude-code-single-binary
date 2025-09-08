export const SAMPLE_ALT = `#!/usr/bin/env node\n(function(){\nprocess.env.CLAUDE_CODE_ENTRYPOINT=\"cli\";\n// Simpler shell error only (no preceding let J=...)
if(!J){let F=\"No suitable shell found. Claude CLI requires a Posix shell environment. Please ensure you have a valid shell installed and the SHELL environment variable set.\";throw h1(new Error(F)),new Error(F)}\nB=\"./ripgrep.node\";\n})();\n`;

