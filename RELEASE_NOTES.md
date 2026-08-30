## Nutrideel v1.0.0 — Multi-Provider AI, Encrypted Keys, Current Models & a Real Type System

The biggest update since the initial build. Nutrideel is no longer locked to a single AI provider, API keys are now encrypted instead of sitting in plain storage, the annoying vibration-on-every-tap is gone for good, the whole app now renders in a proper typeface instead of your phone's default system font, and the AI model lists have been brought up to date with what each provider actually offers today.

### 🤖 13 AI providers instead of 1

Nutrideel was Gemini-only. Now you can pick from:

- Google Gemini
- OpenAI
- Anthropic Claude
- Groq
- xAI Grok
- OpenRouter
- Mistral AI
- DeepSeek
- Together AI
- Fireworks AI
- DeepInfra
- Perplexity
- Any custom OpenAI-compatible endpoint (self-hosted, Ollama, LM Studio, etc.)

...or skip all of it and run the built-in **Offline Engine**, which needs no key and no connection at all.

Switch providers anytime from **Profile → AI Access**. Each provider remembers its own model choice, so flipping back and forth doesn't make you re-pick every time.

### 🆕 Model lists brought current

Every provider's model list was quietly out of date and has been refreshed to what's actually available right now:

- **Gemini**: 3.7 Flash, 3.1 Pro, 3.6 Flash, 3.5 Flash, 3.5 Flash-Lite, and 3.1 Flash-Lite, with 2.5 Flash kept as a legacy fallback. The old picker only offered 2.x models — some of which are already shut down on Google's end.
- **OpenAI**: GPT-5.6 Sol, Terra, and Luna, plus GPT-5.4 Nano for text-only high-volume use. GPT-4o and o4-mini have been retired by OpenAI and are gone from the list.
- **Anthropic Claude**: Claude Opus 5, Sonnet 5, and Haiku 4.5.
- **xAI Grok**: Grok 4.6, Grok 4.3, and Grok 4.1 Fast.
- **OpenRouter**: routed model IDs updated to match the refreshed provider lineups above.

### 🔒 API keys are now encrypted

Keys used to sit in plain AsyncStorage. They're now stored with `expo-secure-store`, backed by the Android Keystore, and never touch plain-text storage. Keys are wiped automatically if you use the "Reset All Data" option.

### 📸 Smarter photo logging

Photo-based food logging now works across every vision-capable provider, not just Gemini. If you're on a text-only model, the app automatically falls back to estimating from your typed note instead of just failing.

### 🎨 Black & Red theme, actually fixed

The Black & Red theme used to be five different shades of red with no black in the surfaces at all — cards, borders, and even the "black" background had a heavy red tint baked in, and the accent colors used for macros/fasting/protein were all variations of the same red-pink hue, so nothing stood out from anything else. It's been rebuilt with genuinely neutral black/charcoal/gray surfaces and a single, deliberate red accent, so it actually reads as black-and-red instead of all-red.

### 🔕 Haptics removed

No more buzzing on every single tap. Vibration feedback has been fully stripped out — the app is quiet by design now.

### 🖋 Real typography

The app previously rendered in your phone's default system font everywhere. It now uses **Plus Jakarta Sans** throughout, with proper weight variation (semibold/bold/extrabold) instead of one flat look.

### 🛠 Under the hood

- Rebuilt the AI request layer around a single `callAIProvider()` dispatcher that speaks Gemini-format, OpenAI-format, and Anthropic-format requests, so adding a 14th provider later is a one-file change
- Per-model (not just per-provider) vision-support detection, since some providers offer both vision and text-only models
- Cleaned up leftover Gemini-specific type unions and function signatures across the codebase
- Removed a stale, out-of-sync lockfile that could have broken CI/EAS builds
- README rewritten to reflect the new architecture, including a guide for adding new AI providers

### 📝 Notes

- This is a source-level release. Build your own APK with `eas build -p android --profile preview` — see the README for full steps.
- No account, no backend, no analytics — still 100% on-device, same as always.
- iOS is untested; this targets Android via EAS Build.
- AI model lineups move fast — if a provider retires or renames a model listed here after this release, swap the ID in `src/services/aiProviders.ts`; no other file needs to change.

**Full list of changes:** see the [README](https://github.com/adeelnotfound/Nutrideel/blob/main/README.md) for the complete feature set and architecture notes.
