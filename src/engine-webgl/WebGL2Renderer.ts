import { Point2D, RenderLinePrimitive } from '../core/interfaces/ICadEntity';
import {
  IRenderEngine,
  PdfBackgroundTexture,
  RenderFramePayload,
  ViewportTransform,
} from '../core/interfaces/IRenderEngine';
import { buildClipSpaceMatrix, screenToWorld, worldToScreen } from '../core/math/Mat3Camera';
import { LINE_INSTANCED_FRAG, LINE_INSTANCED_VERT } from './shaders/lineInstanced';
import { PDF_QUAD_FRAG, PDF_QUAD_VERT } from './shaders/pdfTile';

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('Failed to create WebGL shader');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`Shader compile error: ${info}`);
  }
  return sh;
}

function linkProgram(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram();
  if (!prog) throw new Error('Failed to create WebGL program');
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`Program link error: ${info}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return prog;
}

export class WebGL2Renderer implements IRenderEngine {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private cssW = 800;
  private cssH = 600;
  private dpr = 1;

  private lineProg: WebGLProgram | null = null;
  private lineVao: WebGLVertexArrayObject | null = null;
  private instanceBuf: WebGLBuffer | null = null;

  private pdfProg: WebGLProgram | null = null;
  private pdfVao: WebGLVertexArrayObject | null = null;
  private pdfTexture: WebGLTexture | null = null;
  private uploadedPdfVersion = -1;

  public mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    if (!gl) {
      throw new Error('WebGL2 is not supported in this browser.');
    }
    this.gl = gl;
    this.initPrograms(gl);
  }

  private initPrograms(gl: WebGL2RenderingContext): void {
    // 1. Line instanced program
    this.lineProg = linkProgram(gl, LINE_INSTANCED_VERT, LINE_INSTANCED_FRAG);
    this.lineVao = gl.createVertexArray();
    gl.bindVertexArray(this.lineVao);

    const quadVerts = new Float32Array([
      0, -0.5,
      1, -0.5,
      1, 0.5,
      0, -0.5,
      1, 0.5,
      0, 0.5,
    ]);
    const quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Instance buffer: 11 floats per line = 44 bytes
    // p1(2), p2(2), color(4), width(1), screenSpace(1), dash(2) -> 12 floats = 48 bytes
    this.instanceBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuf);
    const stride = 12 * 4;

    const attrs: Array<[number, number, number]> = [
      [1, 2, 0],
      [2, 2, 2 * 4],
      [3, 4, 4 * 4],
      [4, 1, 8 * 4],
      [5, 1, 9 * 4],
      [6, 2, 10 * 4],
    ];
    for (const [loc, size, offset] of attrs) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
      gl.vertexAttribDivisor(loc, 1);
    }
    gl.bindVertexArray(null);

    // 2. PDF quad program
    this.pdfProg = linkProgram(gl, PDF_QUAD_VERT, PDF_QUAD_FRAG);
    this.pdfVao = gl.createVertexArray();
    gl.bindVertexArray(this.pdfVao);
    const unitQuad = new Float32Array([
      0, 0,
      1, 0,
      1, 1,
      0, 0,
      1, 1,
      0, 1,
    ]);
    const pdfBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pdfBuf);
    gl.bufferData(gl.ARRAY_BUFFER, unitQuad, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.pdfTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.pdfTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  public resize(widthCss: number, heightCss: number, dpr: number): void {
    this.cssW = Math.max(1, widthCss);
    this.cssH = Math.max(1, heightCss);
    this.dpr = Math.max(1, dpr);
    if (this.canvas && this.gl) {
      this.canvas.width = Math.round(this.cssW * this.dpr);
      this.canvas.height = Math.round(this.cssH * this.dpr);
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  public render(frame: RenderFramePayload): void {
    const gl = this.gl;
    if (!gl) return;

    const isLight = typeof document !== 'undefined' && document.documentElement.classList.contains('light');
    if (isLight) {
      gl.clearColor(0.886, 0.91, 0.941, 1.0); // #e2e8f0 light CAD canvas
    } else {
      gl.clearColor(0.067, 0.094, 0.153, 1.0); // #111827 slate dark CAD canvas
    }
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const clipMatrix = buildClipSpaceMatrix(frame.viewport, this.cssW, this.cssH);

    // 1. Draw PDF Underlay
    if (frame.pdfPage) {
      this.drawPdfPage(gl, frame.pdfPage, clipMatrix);
    }

    // 2. Build grid lines + entity lines
    const allLines: RenderLinePrimitive[] = [];
    if (frame.gridVisible) {
      this.appendGridLines(allLines, frame.viewport, frame.isometricGrid);
    }
    for (const l of frame.lines) {
      allLines.push(l);
    }

    if (allLines.length > 0) {
      this.drawLines(gl, allLines, clipMatrix, frame.viewport.zoom);
    }
  }

  private drawPdfPage(
    gl: WebGL2RenderingContext,
    pdf: PdfBackgroundTexture,
    clipMatrix: Float32Array,
  ): void {
    if (!this.pdfProg || !this.pdfVao || !this.pdfTexture) return;
    gl.bindTexture(gl.TEXTURE_2D, this.pdfTexture);
    if (this.uploadedPdfVersion !== pdf.version) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pdf.canvas);
      this.uploadedPdfVersion = pdf.version;
    }

    gl.useProgram(this.pdfProg);
    gl.uniformMatrix3fv(gl.getUniformLocation(this.pdfProg, 'u_clipMatrix'), false, clipMatrix);
    gl.uniform2f(gl.getUniformLocation(this.pdfProg, 'u_pageSize'), pdf.widthPt, pdf.heightPt);
    gl.bindVertexArray(this.pdfVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  private drawLines(
    gl: WebGL2RenderingContext,
    lines: RenderLinePrimitive[],
    clipMatrix: Float32Array,
    zoom: number,
  ): void {
    if (!this.lineProg || !this.lineVao || !this.instanceBuf) return;

    const data = new Float32Array(lines.length * 12);
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const o = i * 12;
      data[o] = l.x1;
      data[o + 1] = l.y1;
      data[o + 2] = l.x2;
      data[o + 3] = l.y2;
      data[o + 4] = l.colorRgba[0];
      data[o + 5] = l.colorRgba[1];
      data[o + 6] = l.colorRgba[2];
      data[o + 7] = l.colorRgba[3];
      data[o + 8] = l.width;
      data[o + 9] = l.screenSpaceWidth ? 1.0 : 0.0;
      data[o + 10] = l.dashPattern?.[0] ?? 0;
      data[o + 11] = l.dashPattern?.[1] ?? 0;
    }

    gl.useProgram(this.lineProg);
    gl.uniformMatrix3fv(gl.getUniformLocation(this.lineProg, 'u_clipMatrix'), false, clipMatrix);
    gl.uniform1f(gl.getUniformLocation(this.lineProg, 'u_zoom'), zoom);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);

    gl.bindVertexArray(this.lineVao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, lines.length);
    gl.bindVertexArray(null);
  }

  private appendGridLines(
    out: RenderLinePrimitive[],
    vp: ViewportTransform,
    isometric: boolean,
  ): void {
    const tl = screenToWorld({ x: 0, y: 0 }, vp);
    const br = screenToWorld({ x: this.cssW, y: this.cssH }, vp);
    const rawStep = 64 / Math.max(vp.zoom, 0.05);
    const step = Math.pow(2, Math.round(Math.log2(rawStep))) * 2;
    const clampedStep = Math.max(16, Math.min(512, step));
    const color: [number, number, number, number] = [0.18, 0.25, 0.36, 0.32];

    const startX = Math.floor(tl.x / clampedStep) * clampedStep;
    const endX = Math.ceil(br.x / clampedStep) * clampedStep;
    const startY = Math.floor(tl.y / clampedStep) * clampedStep;
    const endY = Math.ceil(br.y / clampedStep) * clampedStep;

    for (let x = startX; x <= endX; x += clampedStep) {
      out.push({ x1: x, y1: startY, x2: x, y2: endY, colorRgba: color, width: 1, screenSpaceWidth: true });
    }
    if (!isometric) {
      for (let y = startY; y <= endY; y += clampedStep) {
        out.push({ x1: startX, y1: y, x2: endX, y2: y, colorRgba: color, width: 1, screenSpaceWidth: true });
      }
    } else {
      const tan30 = Math.tan(Math.PI / 6);
      const spanX = endX - startX;
      for (let y = startY - spanX * tan30; y <= endY + spanX * tan30; y += clampedStep) {
        out.push({
          x1: startX,
          y1: y,
          x2: endX,
          y2: y + spanX * tan30,
          colorRgba: [0.0, 0.9, 1.0, 0.14],
          width: 1,
          screenSpaceWidth: true,
        });
        out.push({
          x1: startX,
          y1: y,
          x2: endX,
          y2: y - spanX * tan30,
          colorRgba: [0.0, 0.9, 1.0, 0.14],
          width: 1,
          screenSpaceWidth: true,
        });
      }
    }
  }

  public screenToWorld(screenPt: Point2D, viewport: ViewportTransform): Point2D {
    return screenToWorld(screenPt, viewport);
  }

  public worldToScreen(worldPt: Point2D, viewport: ViewportTransform): Point2D {
    return worldToScreen(worldPt, viewport);
  }

  public dispose(): void {
    const gl = this.gl;
    if (!gl) return;
    if (this.lineProg) gl.deleteProgram(this.lineProg);
    if (this.pdfProg) gl.deleteProgram(this.pdfProg);
    if (this.lineVao) gl.deleteVertexArray(this.lineVao);
    if (this.pdfVao) gl.deleteVertexArray(this.pdfVao);
    if (this.instanceBuf) gl.deleteBuffer(this.instanceBuf);
    if (this.pdfTexture) gl.deleteTexture(this.pdfTexture);
    this.gl = null;
  }
}
