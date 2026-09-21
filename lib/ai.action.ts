import puter from "@heyputer/puter.js";
import { GENERATION_TIMEOUT_MS, ARCHIFY_RENDER_PROMPT } from "./constants";

export const fetchAsDataUrl = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Failed to fetch image: ${response.status}`);

  const blob = await response.blob();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
};

export const generate3DView = async ({ sourceImage }: Generate3DViewParams) => {
  const dataUrl = sourceImage.startsWith("data:")
    ? sourceImage
    : await fetchAsDataUrl(sourceImage);
  const base64Data = dataUrl.split(",")[1];
  const mimeType = dataUrl.split(";")[0].split(":")[1];
  if (!mimeType || !base64Data) throw new Error("Invalid source image payload");

  // puter.ai has no timeout of its own, so a stalled call would hang the
  // render overlay indefinitely.
  const response = await Promise.race([
    puter.ai.txt2img(ARCHIFY_RENDER_PROMPT, {
      provider: "gemini",
      model: "gemini-2.5-flash-image-preview",
      input_image: base64Data,
      input_image_mime_type: mimeType,
      ratio: { w: 1024, h: 1024 },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Render timed out. Please try again.")),
        GENERATION_TIMEOUT_MS,
      ),
    ),
  ]);

  const rawImageUrl = (response as HTMLImageElement).src ?? null;

  if (!rawImageUrl)
    return {
      renderedImage: null,
      renderedPath: undefined,
    };

  const renderedImage = rawImageUrl.startsWith("data:")
    ? rawImageUrl
    : await fetchAsDataUrl(rawImageUrl);
  return {
    renderedImage,
    renderedPath: undefined,
  };
};
