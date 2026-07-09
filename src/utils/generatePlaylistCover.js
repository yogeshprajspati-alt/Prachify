/**
 * 4 image URLs se ek 2x2 grid canvas banao aur base64 return karo.
 * Kam images hone par solid color fallback.
 */
export async function generatePlaylistCover(imageUrls, size = 400) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const urls = imageUrls.slice(0, 4);
  if (urls.length === 0) return null;

  const half = size / 2;

  const loadImage = (url) => new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });

  const images = await Promise.all(urls.map(loadImage));
  const validImages = images.filter(Boolean);

  if (validImages.length === 0) return null;
  if (validImages.length === 1) {
    // Sirf ek image hai — full size
    ctx.drawImage(validImages[0], 0, 0, size, size);
  } else if (validImages.length < 4) {
    // 2-3 images — pehli full, baaki half
    ctx.drawImage(validImages[0], 0, 0, half, size);
    const remaining = validImages.slice(1);
    const cellH = size / remaining.length;
    remaining.forEach((img, i) => {
      ctx.drawImage(img, half, i * cellH, half, cellH);
    });
  } else {
    // 4 images — 2x2 grid
    const positions = [
      [0, 0], [half, 0],
      [0, half], [half, half],
    ];
    positions.forEach(([x, y], i) => {
      ctx.drawImage(validImages[i], x, y, half, half);
    });
  }

  return canvas.toDataURL('image/jpeg', 0.85);
}
