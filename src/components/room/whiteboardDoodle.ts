/** where this visitor's whiteboard doodle is kept (in their browser only) */
export const DOODLE_KEY = "portfolio-room-plain:whiteboard-doodle";

/** the saved doodle, as an image ready to draw onto the board, or null */
export const loadDoodle = () =>
  new Promise<HTMLImageElement | null>((resolve) => {
    let url: string | null = null;
    try {
      url = localStorage.getItem(DOODLE_KEY);
    } catch {
      // no storage
    }
    if (!url) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
