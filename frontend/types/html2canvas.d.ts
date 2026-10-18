declare module "html2canvas" {
  interface Html2CanvasOptions {
    scale?: number;
    width?: number;
    height?: number;
    windowWidth?: number;
    windowHeight?: number;
    backgroundColor?: string | null;
    logging?: boolean;
    useCORS?: boolean;
    allowTaint?: boolean;
    scrollX?: number;
    scrollY?: number;
    x?: number;
    y?: number;
  }

  function html2canvas(element: HTMLElement, options?: Html2CanvasOptions): Promise<HTMLCanvasElement>;

  export default html2canvas;
}
