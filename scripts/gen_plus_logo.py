"""One-off: generate a premium 'Quick Wing Plus' logo via Nano Banana."""
import asyncio, os, base64
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

load_dotenv("/app/backend/.env")

SRC = "/app/frontend/public/quick-wing-logo.png"
OUT = "/app/frontend/public/quick-wing-plus-logo.png"

PROMPT = (
    "Take this Quick Wing car fleet management logo and re-render it as a premium, "
    "ultra-luxury 'Quick Wing Plus' edition. Keep the SAME wing + stylised car silhouette "
    "and the SAME 'QUICK WING' wordmark, but: (1) replace the blue metallic finish on the "
    "wing and car with rich brushed gold + champagne highlights, subtle holographic sheen, "
    "and a very thin dark navy outline for definition; (2) render 'QUICK WING' wordmark in "
    "the same brushed-gold gradient with soft champagne highlights; (3) REPLACE the 'CAR FLEET "
    "MANAGEMENT' tagline underneath with a bold uppercase 'PLUS' badge — a small pill-shaped "
    "gold plaque with the word PLUS in dark navy, positioned neatly under the 'WING' part; "
    "(4) transparent background, high resolution, crisp edges, no photorealistic environment, "
    "no extra icons, no text besides 'QUICK WING' and the 'PLUS' badge. Output looks like a "
    "premium tier version of the same brand."
)


async def main():
    with open(SRC, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode("utf-8")

    api_key = os.getenv("EMERGENT_LLM_KEY")
    chat = LlmChat(
        api_key=api_key,
        session_id="qw-plus-logo-gen",
        system_message="You are an expert brand designer.",
    ).with_model("gemini", "gemini-3.1-flash-image-preview").with_params(
        modalities=["image", "text"]
    )

    msg = UserMessage(text=PROMPT, file_contents=[ImageContent(img_b64)])
    text, images = await chat.send_message_multimodal_response(msg)
    print(f"Text: {text[:200] if text else '(none)'}")
    if not images:
        raise SystemExit("No image returned")
    image_bytes = base64.b64decode(images[0]["data"])
    with open(OUT, "wb") as f:
        f.write(image_bytes)
    print(f"Saved {OUT} ({len(image_bytes)} bytes)")


if __name__ == "__main__":
    asyncio.run(main())
