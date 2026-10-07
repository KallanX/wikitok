/** Downscale a Wikimedia thumbnail URL for the blurred backdrop. */
export function ambientThumb(url: string): string {
  const next = url.replace(/\/\d+px-([^/?#]+)(?=[?#]|$)/, "/40px-$1");
  return next || url;
}
