// postinstall de OurBook: tras `npm i ourbook` avisa de cómo registrar el MCP
// en tus agentes. Si hay terminal interactiva (y no es CI), lanza el asistente.
import { runSetup } from "./setup/wizard.js";

const isInteractive =
  Boolean(process.stdin.isTTY) && !process.env.CI && !process.env.OURBOOK_SKIP_SETUP;

async function main(): Promise<void> {
  if (isInteractive) {
    await runSetup({});
  } else {
    console.log(
      [
        "",
        "╭──────────────────────────────────────────────────────────────╮",
        "│  🌙 OurBook instalado.                                       │",
        "│                                                              │",
        "│  Detecta tus agentes (Claude, Cursor, OpenCode...) y elige   │",
        "│  en cuáles registrar el MCP con:                             │",
        "│                                                              │",
        "│      npx ourbook setup                                       │",
        "│                                                              │",
        "│  O instala en todos sin preguntar: npx ourbook setup --yes   │",
        "│  Revisar detección:            npx ourbook agents            │",
        "│  Retirar de un agente:         npx ourbook uninstall         │",
        "╰──────────────────────────────────────────────────────────────╯",
        "",
      ].join("\n"),
    );
  }
}

main().catch((e) => {
  console.error(`[ourbook] postinstall: ${(e as Error).message}`);
  process.exit(1);
});
