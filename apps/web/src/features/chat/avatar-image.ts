import type { Area } from 'react-easy-crop';

/**
 * Формирует квадратный файл аватара из выбранной области изображения.
 *
 * @param imageSource - Адрес исходного изображения.
 * @param crop - Область исходного изображения в пикселях.
 * @returns Подготовленный JPEG-файл.
 */
export async function createCroppedAvatar(imageSource: string, crop: Area): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.crossOrigin = 'anonymous';
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('Не удалось загрузить изображение'));
    element.src = imageSource;
  });
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Браузер не поддерживает обработку изображения');
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result ? resolve(result) : reject(new Error('Не удалось подготовить изображение')),
      'image/jpeg',
      0.9,
    );
  });
  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
}
