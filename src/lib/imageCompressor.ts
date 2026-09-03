// src/lib/imageCompressor.ts

/**
 * Kompresuje zdjęcia (JPG/PNG/HEIC) do WebP/JPEG 320px.
 * Jeśli plik to SVG (wektor) - przepuszcza go bez kompresji, zachowując 100% ostrości.
 */
export function compressImage(
  file: File,
  maxWidth = 320,
  maxHeight = 320,
  quality = 0.88
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const result = event.target?.result as string;

      // Jeśli wgrano wektor SVG, zostawiamy go nienaruszonego
      if (file.type === 'image/svg+xml' || result.startsWith('data:image/svg+xml')) {
        resolve(result);
        return;
      }

      const img = new Image();
      img.src = result;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(img.src);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(img, 0, 0, width, height);

        let compressedBase64 = canvas.toDataURL('image/webp', quality);
        if (!compressedBase64.startsWith('data:image/webp')) {
          compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(compressedBase64);
      };

      img.onerror = (err) => reject(err);
    };

    reader.onerror = (err) => reject(err);
  });
}