// src/lib/imageCompressor.ts

/**
 * Kompresuje zdjęcie zachowując wysoką ostrość na ekranach Retina (iPhone/Android).
 * Wynikowa waga: ok. 35 - 70 KB (zamiast 4 MB).
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
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Kadrowanie i skalowanie z zachowaniem proporcji
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

        // Wygładzanie dwuliniowe dla maksymalnej ostrości krawędzi
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(img, 0, 0, width, height);

        // WebP jeśli przeglądarka wspiera, fallback na JPEG
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