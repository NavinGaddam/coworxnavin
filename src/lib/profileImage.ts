const readDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(Error("Could not read this photo."));
    reader.readAsDataURL(file);
  });

const loadImage = (source: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(Error("Choose a valid JPG, PNG or WebP photo."));
    image.src = source;
  });

export async function prepareProfileImage(file: File) {
  if (!file.type.startsWith("image/")) throw Error("Choose an image file.");
  if (file.size > 8 * 1024 * 1024) throw Error("Choose a photo smaller than 8 MB.");
  const image = await loadImage(await readDataUrl(file));
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  if (!side) throw Error("This photo could not be opened.");
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 320;
  const context = canvas.getContext("2d");
  if (!context) throw Error("Photo editing is unavailable on this device.");
  context.fillStyle = "#eef3f1";
  context.fillRect(0, 0, 320, 320);
  context.drawImage(
    image,
    Math.floor((image.naturalWidth - side) / 2),
    Math.floor((image.naturalHeight - side) / 2),
    side,
    side,
    0,
    0,
    320,
    320,
  );
  const result = canvas.toDataURL("image/jpeg", 0.82);
  if (result.length > 350_000)
    throw Error("The compressed photo is still too large. Choose a simpler image.");
  return result;
}
