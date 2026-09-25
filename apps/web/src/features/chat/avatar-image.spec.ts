import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCroppedAvatar } from './avatar-image';

describe('Подготовка изображения аватара', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('создаёт квадратный JPEG размером 512 на 512 пикселей', async () => {
    class TestImage {
      naturalWidth = 1200;
      naturalHeight = 800;
      crossOrigin = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', TestImage);
    const drawImage = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName !== 'canvas') return originalCreateElement(tagName);
      return {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage }),
        toBlob: (callback: BlobCallback, type: string) =>
          callback(new Blob(['avatar'], { type })),
      } as unknown as HTMLCanvasElement;
    });

    const file = await createCroppedAvatar('blob:avatar', {
      x: 100,
      y: 50,
      width: 400,
      height: 400,
    });

    expect(file.name).toBe('avatar.jpg');
    expect(file.type).toBe('image/jpeg');
    expect(drawImage).toHaveBeenCalledWith(
      expect.any(TestImage),
      100,
      50,
      400,
      400,
      0,
      0,
      512,
      512,
    );
  });
});
